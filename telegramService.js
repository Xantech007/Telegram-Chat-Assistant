require("dotenv").config();
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // For interactive CLI login prompts
const { SocksProxyAgent } = require("socks-proxy-agent");

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

// In-Memory Caches
// adminCache: { "groupId": Set(adminUserIds) }
const adminCache = new Map();
// activeClients: Map of account identifier -> TelegramClient instance
const activeClients = new Map();

/**
 * Authenticates and initializes a Telegram account session.
 * @param {string} accountId - Unique identifier (e.g., phone number or account name)
 * @param {string} savedSessionString - Existing StringSession token (if available)
 * @param {string} proxyUrl - Optional SOCKS5 proxy (e.g. "socks5://user:pass@ip:port")
 */
async function authenticateAccount(accountId, savedSessionString = "", proxyUrl = null) {
  const session = new StringSession(savedSessionString);
  
  const clientOptions = {
    connectionRetries: 5,
  };

  // Bind SOCKS5 proxy if provided for IP isolation
  if (proxyUrl) {
    clientOptions.agent = new SocksProxyAgent(proxyUrl);
  }

  const client = new TelegramClient(session, apiId, apiHash, clientOptions);

  await client.start({
    phoneNumber: async () => await input.text(`[${accountId}] Enter phone number: `),
    password: async () => await input.text(`[${accountId}] Enter 2FA password (if enabled): `),
    phoneCode: async () => await input.text(`[${accountId}] Enter Telegram OTP code: `),
    onError: (err) => console.error(`[${accountId}] Auth Error:`, err.message),
  });

  const sessionString = client.session.save();
  console.log(`\n✅ Account [${accountId}] successfully authenticated!`);
  console.log(`🔑 Save this Session String for ${accountId}:\n${sessionString}\n`);

  activeClients.set(accountId, client);
  return { client, sessionString };
}

/**
 * Fetches all channels and groups the account is currently in.
 * @param {TelegramClient} client 
 */
async function getJoinedGroups(client) {
  const dialogs = await client.getDialogs({});
  const groups = dialogs.filter((dialog) => dialog.isGroup || dialog.isChannel);

  return groups.map((g) => ({
    id: g.id.toString(),
    title: g.title,
    unreadCount: g.unreadCount,
    isChannel: g.isChannel,
    isGroup: g.isGroup,
  }));
}

/**
 * Updates in-memory admin cache for a group to prevent messaging admins.
 * @param {TelegramClient} client 
 * @param {string|number} groupId 
 */
async function refreshAdminCache(client, groupId) {
  try {
    const admins = await client.getParticipants(groupId, {
      filter: new Api.ChannelParticipantsAdmins(),
    });

    const adminIds = new Set(admins.map((user) => user.id.toString()));
    adminCache.set(groupId.toString(), adminIds);
    console.log(`🛡️ Cached ${adminIds.size} admins/bots for group: ${groupId}`);
    return adminIds;
  } catch (error) {
    console.error(`⚠️ Failed to fetch admins for group ${groupId}:`, error.message);
    return new Set();
  }
}

/**
 * Checks if a message sender is an admin or bot.
 * @param {string|number} groupId 
 * @param {string|number} senderId 
 */
function isSenderAdmin(groupId, senderId) {
  const admins = adminCache.get(groupId.toString());
  if (!admins) return false;
  return admins.has(senderId.toString());
}

/**
 * Emulates human typing status in a group before sending a message.
 * @param {TelegramClient} client 
 * @param {string|number} groupId 
 * @param {number} durationMs 
 */
async function simulateTyping(client, groupId, durationMs = 3000) {
  try {
    await client.invoke(
      new Api.messages.SetTyping({
        peer: groupId,
        action: new Api.SendMessageTypingAction(),
      })
    );
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  } catch (err) {
    console.warn("Typing simulation error:", err.message);
  }
}

module.exports = {
  authenticateAccount,
  getJoinedGroups,
  refreshAdminCache,
  isSenderAdmin,
  simulateTyping,
  activeClients,
};
