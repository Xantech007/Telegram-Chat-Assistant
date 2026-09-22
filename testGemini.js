const { processIncomingMessage } = require("./geminiService");

async function runTest() {
  console.log("🧪 Testing Gemini Lead Scoring & Response Engine...\n");

  const sampleMessages = [
    {
      sender: "John",
      text: "Does anyone know a good forex broker with low spreads for gold trading?",
      topic: "Forex",
      initialScore: 20,
    },
    {
      sender: "Sarah",
      text: "Crypto is dead, everything is a scam.",
      topic: "Crypto",
      initialScore: 30,
    },
    {
      sender: "Alex",
      text: "We are organizing a local health drive for maternal care and looking for partners.",
      topic: "Healthcare / NGO",
      initialScore: 45,
    },
  ];

  for (const item of sampleMessages) {
    console.log(`--------------------------------------------------`);
    console.log(`📩 Sender: ${item.sender} | Group Topic: ${item.topic}`);
    console.log(`💬 Message: "${item.text}"`);

    const output = await processIncomingMessage(item.text, item.sender, item.topic, item.initialScore);

    console.log(`\n📊 Evaluation:`);
    console.log(`   - Previous Score: ${output.evaluation.previousScore}%`);
    console.log(`   - Score Delta: ${output.evaluation.intentScoreDelta > 0 ? "+" : ""}${output.evaluation.intentScoreDelta}%`);
    console.log(`   - Updated Score: ${output.evaluation.updatedScore}% (${output.evaluation.tier} Lead)`);
    console.log(`   - Reasoning: ${output.evaluation.reasoning}`);

    if (output.botReply.shouldReply) {
      console.log(`\n🤖 Bot Suggested Reply:`);
      console.log(`   "${output.botReply.responseText}"`);
    } else {
      console.log(`\n🤖 Bot Decision: Do not reply.`);
    }
    console.log(`--------------------------------------------------\n`);
  }
}

runTest();
