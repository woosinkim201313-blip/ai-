import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getCounselingAdvice(worry: string) {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    당신은 따뜻하고 공감 능력이 뛰어난 전문 AI 상담사입니다. 
    사용자가 자신의 고민을 이야기하면, 다음의 원칙에 따라 조언을 해주세요:
    1. 사용자의 감정을 먼저 깊이 공감하고 위로해주세요.
    2. 비난하거나 판단하지 않는 비심판적 태도를 유지하세요.
    3. 실질적이고 구체적인 해결책이나 마음가짐에 대한 조언을 1~2가지 제안해주세요.
    4. 너무 길지 않게, 따뜻한 어조로 답변해주세요.
    5. 답변은 한국어로 작성해주세요.
    6. 답변은 마크다운 형식을 사용하여 가독성 있게 작성해주세요.
    7. 당신이 AI 상담사임을 자연스럽게 녹여내어 신뢰감을 주세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: worry,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "죄송합니다. 조언을 생성하는 중에 문제가 발생했습니다. 다시 시도해주세요.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "상담사와 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.";
  }
}
