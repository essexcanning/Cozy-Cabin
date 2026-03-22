import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. Cozy Bear messages will not be generated.");
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

export const generateBearMessage = async (sharedState: any): Promise<string | null> => {
  const fallbackMessages = [
    "I love it when you two spend time together!",
    "Don't forget to check your tasks for the day.",
    "The cabin feels so cozy today.",
    "Teamwork makes the dream work!",
    "Sending you both a big bear hug!"
  ];
  const randomFallback = () => fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];

  try {
    const ai = getAIClient();
    if (!ai) return randomFallback();

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

    return response.text?.trim() || randomFallback();
  } catch (error) {
    console.error("Error generating bear message:", error);
    return randomFallback();
  }
};
