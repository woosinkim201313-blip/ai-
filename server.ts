import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("counseling.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // Socket.io connection
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/announcements", (req, res) => {
    const announcements = db.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
    res.json(announcements);
  });

  app.post("/api/announcements", (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }
    const info = db.prepare("INSERT INTO announcements (title, content) VALUES (?, ?)").run(title, content);
    const newAnnouncement = { id: info.lastInsertRowid, title, content, created_at: new Date().toISOString() };
    
    // Broadcast to all clients
    io.emit("new_announcement", newAnnouncement);
    
    res.json(newAnnouncement);
  });

  app.delete("/api/announcements/:id", (req, res) => {
    const { id } = req.params;
    const info = db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    // Optional: Broadcast deletion to all clients
    io.emit("delete_announcement", id);
    res.json({ success: true });
  });

  app.post("/api/ratings", (req, res) => {
    const { message_id, rating } = req.body;
    if (!message_id || !rating) {
      return res.status(400).json({ error: "Message ID and rating are required" });
    }
    const info = db.prepare("INSERT INTO ratings (message_id, rating) VALUES (?, ?)").run(message_id, rating);
    res.json({ id: info.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
