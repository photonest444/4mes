
import { GoogleGenAI } from "@google/genai";

declare const process: any;

const API_KEY = process.env.API_KEY || ''; // In a real app, never expose this client-side if not using a proxy.

let ai: GoogleGenAI | null = null;

if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

export const generateAIResponse = async (prompt: string, persona: 'gemini' | 'deepseek' | 'chatgpt' = 'gemini'): Promise<string> => {
  if (!ai) {
    return "I'm currently offline (API Key missing). Please configure the environment variable.";
  }

  let systemInstruction = "You are the 4 Messenger AI Assistant. Be helpful, concise, and friendly. Keep responses short enough for a chat interface.";
  
  if (persona === 'deepseek') {
      systemInstruction = "You are DeepSeek AI, an intelligent assistant focused on deep reasoning and coding. You are precise, logical, and slightly formal. Keep responses concise.";
  } else if (persona === 'chatgpt') {
      systemInstruction = "You are ChatGPT, a helpful and creative AI assistant. You are conversational, empathetic, and knowledgeable. Keep responses natural and concise.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Using Flash for speed in chat
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, I encountered an error processing your request.";
  }
};
