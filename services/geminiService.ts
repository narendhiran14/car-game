
import { GoogleGenAI } from "@google/genai";

export const getPitBossCommentary = async (
  event: string, 
  score: number, 
  speed: number
): Promise<string> => {
  try {
    // Instantiate right before usage to ensure current API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a high-energy AI Pit Boss for a futuristic neon car racing game. 
      The player just experienced this event: "${event}". 
      Current Score: ${score}, Current Speed: ${Math.round(speed * 10)} mph.
      Provide a very short, punchy, witty radio transmission (max 15 words) that sounds futuristic and cool. 
      Use slang like "nitro", "cyber-grid", "redline", "zero-point".`,
      config: {
        temperature: 0.9,
      }
    });
    
    return response.text || "Keep your eyes on the grid, pilot!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The signal is breaking up! Just drive!";
  }
};
