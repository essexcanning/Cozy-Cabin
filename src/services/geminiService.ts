import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API
// The platform injects process.env.GEMINI_API_KEY automatically
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateBearMessage = async (sharedState: any): Promise<string | null> => {
  try {
    const lastInteraction = sharedState.lastInteractionAt || Date.now();
    const hoursSince = (Date.now() - lastInteraction) / (1000 * 60 * 60);
    const completedTasks = sharedState.tasks.filter((t: any) => t.completed).length;
    const pendingTasks = sharedState.tasks.filter((t: any) => !t.completed).length;

    const prompt = `
      You are the "Cozy Bear", a friendly, cute, and supportive companion in a multiplayer virtual cabin game for couples.
      Your job is to observe the couple's current game state and provide a short, single-sentence comment, tip, or encouragement.
      
      Current Game State:
      - Wood collected: ${sharedState.wood}
      - Cozy Coins: ${sharedState.cozyCoins}
      - Tasks completed: ${completedTasks}
      - Tasks pending: ${pendingTasks}
      - Hearts sent to each other: ${sharedState.heartsSent || 0}
      - Hours since last interaction: ${hoursSince.toFixed(1)}
      
      Guidelines:
      - Keep it to ONE short sentence (max 15 words).
      - Be warm, cute, and encouraging.
      - If they have a lot of coins, suggest buying furniture.
      - If they haven't interacted in a while (hours > 4), suggest sending a heart or a compliment.
      - If they have pending tasks, gently encourage them.
      - If they have completed tasks, praise their teamwork.
      - Occasionally just say something cute about being a bear (e.g., loving honey, being cozy).
      - Do not use quotes around your response.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error("Error generating bear message:", error);
    return null;
  }
};
