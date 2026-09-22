const { authenticateAccount, getJoinedGroups, refreshAdminCache } = require("./telegramService");

async function main() {
  console.log("🚀 Starting Telegram Chat Assistant Engine...");
  
  // Test authentication for Account 1
  const accountId = "Account_1";
  const { client } = await authenticateAccount(accountId);

  // Fetch groups
  console.log("\n📦 Fetching joined groups...");
  const groups = await getJoinedGroups(client);
  console.table(groups);

  // Pick the first group and fetch admins
  if (groups.length > 0) {
    const targetGroup = groups[0];
    console.log(`\n🛡️ Caching admin blacklist for: ${targetGroup.title} (${targetGroup.id})`);
    await refreshAdminCache(client, targetGroup.id);
  }
}

main().catch(console.error);
