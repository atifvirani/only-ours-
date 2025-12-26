
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Fix: Obtained API key exclusively from process.env.API_KEY as per the library guidelines.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async enhanceText(text: string, instruction: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${instruction}\n\nText to process:\n${text}`,
        config: {
          systemInstruction: "You are a professional writing assistant. Keep the formatting clean. Return ONLY the processed text.",
          temperature: 0.7,
        }
      });
      // Fix: Direct access to the .text property of GenerateContentResponse.
      return response.text || text;
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
