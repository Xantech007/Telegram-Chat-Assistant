require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("⚠️ GEMINI_API_KEY is missing in your .env file!");
}

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey });

/**
 * System prompt instructing Gemini on how to evaluate group messages and formulate friendly replies.
 */
const SYSTEM_INSTRUCTION = `
You are an AI assistant analyzing group messages for an automated account.
Your goal is twofold:
1. Evaluate whether the sender exhibits interest or intent related to specific target topics (e.g., Crypto, Forex, Investments, Healthcare, NGOs).
2. Generate a natural, friendly, human-like reply to contribute value to the conversation WITHOUT sounding like a bot, sales pitch, or spam.

Guidelines for Evaluation:
- Analyze buying intent, questions asked, problem statements, and general sentiment.
- Output a score delta (-40 to +35) based on intent strength:
  * +25 to +35: Direct questions about trading, investment tools, healthcare advice, NGO participation, or asking for recommendations.
  * +10 to +20: Casual interest, expressing problems, or relevant group topic discussion.
  * -10 to -40: Off-topic spam, hostility, generic noise, or bot-like messages.

Guidelines for Bot Reply:
- Be warm, helpful, and conversational.
- Mention subtle insights or facts related to what they said that people rarely think about.
- DO NOT post external links, promo codes, or aggressive DM requests in group chats.
- Keep responses brief (1-3 sentences max) to sound natural.
- Set 'shouldReply' to false if the message is off-topic, spam, or doesn't warrant an interaction.

YOU MUST RESPOND ONLY WITH A VALID JSON OBJECT matching this exact structure:
{
  "evaluation": {
    "intentScoreDelta": 25,
    "detectedNiche": "Crypto",
    "sentiment": "curious",
    "reasoning": "User expressed frustration with current exchange fees and asked for alternatives."
  },
  "botReply": {
    "shouldReply": true,
    "responseText": "Fee spikes during volatile hours are painful. Most people miss checking liquidity depth on order books before placing market orders—what exchange are you currently using?"
  }
}
`;

/**
 * Analyzes an incoming Telegram message and returns structured lead scoring + response generation.
 * @param {string} userMessage - Text content of the received message
 * @param {string} senderName - Name/Username of the sender
 * @param {string} targetTopic - Group niche context (e.g., "Crypto", "Forex", "Healthcare", "NGO")
 * @param {number} currentScore - Existing prospect percentage for this user (0 - 100)
 */
async function processIncomingMessage(userMessage, senderName = "User", targetTopic = "General", currentScore = 20) {
  try {
    const prompt = `
Context:
- Target Group Niche: ${targetTopic}
- Sender Name: ${senderName}
- Sender's Current Lead Prospect %: ${currentScore}%
- Incoming Message: "${userMessage}"

Evaluate this message, update the score delta, and formulate a reply if appropriate.
`;

    // Request structured response from Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text);

    // Calculate updated Lead Prospect Percentage (capped between 0% and 100%)
    const rawDelta = result.evaluation?.intentScoreDelta || 0;
    const updatedScore = Math.min(100, Math.max(0, currentScore + rawDelta));

    // Determine Prospect Tier
    let tier = "Cold";
    if (updatedScore >= 80) tier = "Hot";
    else if (updatedScore >= 40) tier = "Warm";

    return {
      evaluation: {
        ...result.evaluation,
        previousScore: currentScore,
        updatedScore: updatedScore,
        tier: tier,
      },
      botReply: result.botReply || { shouldReply: false, responseText: "" },
    };
  } catch (error) {
    console.error("❌ Gemini Processing Error:", error.message);
    return {
      evaluation: {
        intentScoreDelta: 0,
        previousScore: currentScore,
        updatedScore: currentScore,
        tier: currentScore >= 80 ? "Hot" : currentScore >= 40 ? "Warm" : "Cold",
        reasoning: "Error processing request",
      },
      botReply: { shouldReply: false, responseText: "" },
    };
  }
}

module.exports = { processIncomingMessage };
