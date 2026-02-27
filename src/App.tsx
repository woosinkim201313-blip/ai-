/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, Heart, Sparkles, RefreshCcw, Quote, User, Bot, Bell, X, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { getCounselingAdvice } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { io } from 'socket.io-client';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  rating?: number;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

type View = 'start' | 'home' | 'chat' | 'admin';

export default function App() {
  const [view, setView] = useState<View>('start');
  const [worry, setWorry] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [adminTitle, setAdminTitle] = useState('');
  const [adminContent, setAdminContent] = useState('');
  const [newAnnouncementAlert, setNewAnnouncementAlert] = useState<Announcement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnnouncements();

    // Socket.io connection
    let socket: any;
    try {
      socket = io({
        reconnectionAttempts: 5,
        timeout: 10000,
      });
      
      socket.on('new_announcement', (announcement: Announcement) => {
        setAnnouncements(prev => [announcement, ...prev]);
        setNewAnnouncementAlert(announcement);
      });

      socket.on('delete_announcement', (id: string) => {
        setAnnouncements(prev => prev.filter(a => a.id !== parseInt(id)));
      });

      socket.on('connect_error', (err: any) => {
        console.error('Socket connection error:', err);
      });
    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      setAnnouncements(data);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: adminTitle, content: adminContent }),
      });
      if (res.ok) {
        setAdminTitle('');
        setAdminContent('');
        fetchAnnouncements();
        alert("공지사항이 등록되었습니다.");
      }
    } catch (error) {
      console.error("Failed to post announcement:", error);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm("정말 이 공지사항을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error("Failed to delete announcement:", error);
    }
  };

  const handleRate = async (messageId: string, rating: number) => {
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, rating }),
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, rating } : m));
    } catch (error) {
      console.error("Failed to submit rating:", error);
    }
  };

  useEffect(() => {
    let timer: number;
    if (isLoading) {
      setElapsedTime(0);
      timer = window.setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worry.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: worry,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setWorry('');
    setIsLoading(true);

    try {
      const advice = await getCounselingAdvice(worry);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: advice,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setView('start');
  };

  return (
    <div className="relative min-h-screen bg-warm-bg">
      {/* Real-time Announcement Alert */}
      <AnimatePresence>
        {newAnnouncementAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] w-[90%] max-w-md bg-white border-2 border-brand-orange rounded-2xl shadow-2xl p-4 flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange flex-shrink-0">
              <Bell size={20} className="animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 text-sm truncate">새 공지사항이 등록되었습니다!</h4>
              <p className="text-xs text-slate-600 font-medium truncate mt-0.5">{newAnnouncementAlert.title}</p>
              <button 
                onClick={() => {
                  setView('home');
                  setNewAnnouncementAlert(null);
                }}
                className="mt-2 text-[10px] text-brand-orange font-bold uppercase tracking-wider hover:underline"
              >
                지금 확인하기
              </button>
            </div>
            <button 
              onClick={() => setNewAnnouncementAlert(null)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'start' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-md w-full text-center space-y-8"
          >
            <div className="space-y-4 pt-12">
              <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">
                AI 고민 상담소
              </h1>
              <p className="text-lg text-slate-600 font-light leading-relaxed">
                누구에게도 말하지 못했던 당신의 속마음,<br />
                따뜻한 AI의 위로와 지혜로운 조언이 기다리고 있습니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('chat')}
                className="w-full px-8 py-4 bg-brand-green text-white rounded-full font-medium text-lg shadow-lg hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
              >
                상담 시작하기
                <Heart size={20} fill="currentColor" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('home')}
                className="w-full px-8 py-3 bg-white text-brand-green border-2 border-brand-green rounded-full font-medium shadow-md hover:bg-brand-green/5 transition-all flex items-center justify-center gap-2"
              >
                공지사항 보기
              </motion.button>
            </div>
            
            <div className="pt-8 border-t border-slate-200">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                AI Counselor Powered by{' '}
                <button 
                  onClick={() => setView('admin')}
                  className="hover:text-brand-orange transition-colors font-bold cursor-pointer"
                >
                  Gemini
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {view === 'home' && (
        <div className="min-h-screen flex flex-col bg-warm-bg max-w-2xl mx-auto shadow-2xl border-x border-slate-100">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('start')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Quote size={20} className="text-brand-green" />
              </button>
              <h2 className="font-serif font-bold text-slate-800 text-xl">공지사항</h2>
            </div>
            <button onClick={() => setView('chat')} className="px-4 py-2 bg-brand-green text-white rounded-full text-sm font-medium">
              상담하러 가기
            </button>
          </header>
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            {announcements.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                등록된 공지사항이 없습니다.
              </div>
            ) : (
              announcements.map((a) => (
                <motion.div 
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-slate-800">{a.title}</h3>
                    <span className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {a.content}
                  </div>
                </motion.div>
              ))
            )}
          </main>
        </div>
      )}

      {view === 'admin' && (
        <div className="min-h-screen flex flex-col bg-warm-bg max-w-2xl mx-auto shadow-2xl border-x border-slate-100">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('start')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Quote size={20} className="text-brand-orange" />
              </button>
              <h2 className="font-serif font-bold text-slate-800 text-xl">관리자 모드</h2>
            </div>
          </header>
          <main className="flex-1 p-6 space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-lg font-bold text-slate-800">새 공지사항 등록</h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                <input 
                  type="text" 
                  placeholder="제목" 
                  value={adminTitle}
                  onChange={(e) => setAdminTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-orange/20"
                  required
                />
                <textarea 
                  placeholder="내용" 
                  value={adminContent}
                  onChange={(e) => setAdminContent(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-orange/20 min-h-[150px] resize-none"
                  required
                />
                <button 
                  type="submit"
                  className="w-full py-3 bg-brand-orange text-white rounded-xl font-bold shadow-md hover:bg-opacity-90 transition-all"
                >
                  등록하기
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">공지사항 관리</h3>
              {announcements.length === 0 ? (
                <p className="text-center py-4 text-slate-400 text-sm">등록된 공지사항이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="font-bold text-slate-800 truncate">{a.title}</p>
                        <p className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-4">
              <button onClick={() => setView('start')} className="text-slate-400 text-sm underline">
                메인으로 돌아가기
              </button>
            </div>
          </main>
        </div>
      )}

      {view === 'chat' && (
        <div className="min-h-screen flex flex-col bg-warm-bg max-w-2xl mx-auto shadow-2xl border-x border-slate-100">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('start')} className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green hover:scale-105 transition-transform">
                <Bot size={24} />
              </button>
              <div>
                <h2 className="font-serif font-bold text-slate-800">AI 고민 상담소</h2>
                <p className="text-[10px] text-brand-green uppercase font-bold tracking-tighter">AI Counselor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setView('home')}
                className="p-2 text-slate-400 hover:text-brand-green transition-colors"
                title="공지사항"
              >
                <Quote size={20} />
              </button>
              <button 
                onClick={resetChat}
                className="p-2 text-slate-400 hover:text-brand-orange transition-colors"
                title="상담 초기화"
              >
                <RefreshCcw size={20} />
              </button>
            </div>
          </header>

          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 py-20">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <MessageCircle size={32} />
                </div>
                <p className="text-slate-500 font-light">
                  무엇이 당신을 힘들게 하나요?<br />
                  마음속 이야기를 들려주세요.
                </p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex w-full gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-brand-green flex-shrink-0 flex items-center justify-center text-white mt-1">
                      <Bot size={16} />
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl shadow-sm relative group",
                    msg.role === 'user' 
                      ? "bg-brand-orange text-white rounded-tr-none" 
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                  )}>
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="markdown-body prose prose-slate prose-sm max-w-none">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                        {/* Satisfaction Rating */}
                        <div className="mt-4 pt-4 border-t border-slate-50 flex flex-col gap-2">
                          <p className="text-[10px] text-slate-400 font-medium">상담 결과가 만족스러우신가요?</p>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleRate(msg.id, star)}
                                className={cn(
                                  "transition-all hover:scale-125",
                                  msg.rating && msg.rating >= star ? "text-brand-orange" : "text-slate-200"
                                )}
                              >
                                <Heart size={16} fill={msg.rating && msg.rating >= star ? "currentColor" : "none"} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    <p className={cn(
                      "text-[10px] mt-2 opacity-60",
                      msg.role === 'user' ? "text-right" : "text-left"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-brand-orange flex-shrink-0 flex items-center justify-center text-white mt-1">
                      <User size={16} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-brand-green flex-shrink-0 flex items-center justify-center text-white">
                  <Bot size={16} />
                </div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 bg-brand-green rounded-full"
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 bg-brand-green rounded-full"
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      className="w-2 h-2 bg-brand-green rounded-full"
                    />
                  </div>
                  <p className="text-xs text-slate-400 font-medium animate-pulse">
                    잠시만 기다려 주세요... ({elapsedTime}초 소요 중)
                  </p>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </main>

          {/* Input Area */}
          <footer className="p-4 bg-white border-t border-slate-100 relative">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
              <textarea
                value={worry}
                onChange={(e) => setWorry(e.target.value)}
                placeholder="당신의 고민을 적어주세요..."
                className="flex-1 min-h-[50px] max-h-[150px] p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-green/20 resize-none text-slate-800 placeholder:text-slate-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!worry.trim() || isLoading}
                className={cn(
                  "p-4 rounded-2xl flex items-center justify-center transition-all",
                  worry.trim() && !isLoading 
                    ? "bg-brand-green text-white shadow-md" 
                    : "bg-slate-100 text-slate-300"
                )}
              >
                <Send size={20} />
              </motion.button>
            </form>
            <div className="flex justify-center items-center mt-3 px-1">
              <p className="text-[10px] text-slate-400">
                상담 내용은 AI에 의해 생성되며, 전문적인 의료 조언을 대체할 수 없습니다.
              </p>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
