const { Collection } = require("discord.js");
require("dotenv").config({ quiet: true });
const path = require("path");
const { client, ticketsDB, guildDB } = require(path.join(__dirname, "init.js"));
const { getGuildConfig } = require(path.join(__dirname, "utils/guildConfig.js"));
const {
  cleanBlacklist,
  logError,
  lastChannelMsgTimestamp,
} = require(path.join(__dirname, "utils/mainUtils.js"));
const { autoCloseTicket } = require(path.join(__dirname, "utils/ticketAutoClose.js"));
const { autoDeleteTicket } = require(path.join(__dirname, "utils/ticketAutoDelete.js"));
const fs = require("fs");
const yaml = require("yaml");

let config;
try {
  const configFile = fs.readFileSync(path.join(__dirname, "config.yml"), "utf8");
  config = yaml.parse(configFile);
  globalThis.config = config;
} catch (error) {
  console.error("CRITICAL ERROR: Failed to load config.yml. Make sure it exists and is valid YAML.");
  process.exit(1);
}

client.startingTime = Date.now();

const blacklistInterval = 30; // Check every 30 seconds for higher accuracy
// Schedule the blacklist cleanup check every blacklistInterval seconds
setInterval(cleanBlacklist, blacklistInterval * 1000);

async function autoCloseTickets() {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const tickets = (await ticketsDB.all()) || [];
  const openTickets = tickets.filter(
    (ticket) => ticket.value.status === "Open",
  );
  const globalAutoCloseTime = config?.autoCloseTickets?.time || 86400; // Time in seconds

  if (openTickets.length > 0) {
    for (const ticket of openTickets) {
      const channelID = ticket.id;
      const guildId = ticket.value.guildID;
      const ticketData = ticket.value;
      
      // Get per-server auto-close settings
      let autoCloseTime = globalAutoCloseTime;
      let autoCloseEnabled = config?.autoCloseTickets?.enabled ?? true;
      
      if (guildId) {
        try {
          const guildConfig = await getGuildConfig(guildId);
          if (guildConfig && guildConfig.autoClose) {
            autoCloseEnabled = guildConfig.autoClose.enabled;
            autoCloseTime = guildConfig.autoClose.time || globalAutoCloseTime;
          }
        } catch (error) {
          // Use global settings if guild config fails
        }
      }
      
      if (!autoCloseEnabled) {
        continue;
      }
      
      // First check if there's a lastMessageSent timestamp (set when a message is sent)
      let lastMsgTime = ticketData.lastMessageSent;
      
      // Fallback: Check the channel's actual last message if no timestamp is in DB
      if (!lastMsgTime) {
        lastMsgTime = await lastChannelMsgTimestamp(channelID);
      }
      
      if (lastMsgTime === null) {
        // If still null, we might want to use the creation time as a last resort
        lastMsgTime = ticketData.openedAt || Date.now();
      }

      const lastMsgTimeSeconds = Math.floor(lastMsgTime / 1000);
      const timeDifference = currentTime - lastMsgTimeSeconds;

      if (timeDifference > autoCloseTime) {
        await autoCloseTicket(channelID);
      }
    }
  }
}

async function autoDeleteTickets() {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const tickets = (await ticketsDB.all()) || [];
  const closedTickets = tickets.filter(
    (ticket) => ticket.value.status === "Closed",
  );
  const autoDeleteTime = config?.autoDeleteTickets?.time || 86400; // Time in seconds

  if (closedTickets.length > 0) {
    for (const ticket of closedTickets) {
      const channelID = ticket.id;
      const { closedAt } = ticket.value;

      if (closedAt === 0 || closedAt === undefined) {
        continue;
      }

      const closedAtSeconds = Math.floor(closedAt / 1000);
      const timeDifference = currentTime - closedAtSeconds;

      if (timeDifference > autoDeleteTime) {
        await autoDeleteTicket(channelID);
      }
    }
  }
}

async function alertBasedDeleteTickets() {
  const currentTime = Date.now();
  const tickets = (await ticketsDB.all()) || [];

  for (const ticket of tickets) {
    const channelID = ticket.id;
    const alertDueTime = ticket.value.alertDueTime;

    if (alertDueTime && currentTime >= alertDueTime) {
      try {
        await autoDeleteTicket(channelID);
        await ticketsDB.delete(`${channelID}.alertDueTime`).catch(() => {});
      } catch (error) {
        console.error(`Error deleting ticket ${channelID} due to alert expiration:`, error);
      }
    }
  }
}

if (config.autoCloseTickets.enabled) {
  const autoCloseInterval = config?.autoCloseTickets?.interval || 60;
  setInterval(autoCloseTickets, autoCloseInterval * 1000);
}

if (config.autoDeleteTickets.enabled) {
  const autoDeleteInterval = config?.autoDeleteTickets?.interval || 60;
  setInterval(autoDeleteTickets, autoDeleteInterval * 1000);
}

const alertDeleteInterval = config?.alertDeleteInterval || 30;
setInterval(alertBasedDeleteTickets, alertDeleteInterval * 1000);

// Stats channels feature disabled until updateStatsChannels is implemented
// if (config.statsChannels.enabled) {
//   const statsInterval = parseInt(config?.statsChannels?.interval, 10) || 600;
//   const statsIntervalMs = Math.max(statsInterval * 1000, 600 * 1000);
//   setInterval(updateStatsChannels, statsIntervalMs);
// }

// Holding commands cooldown data
client.cooldowns = new Collection();

// Reading command files
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(commandsPath);
for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if (command.enabled) {
      if (!config.silentStartup) {
        console.log(`The slash command [${file}] has been loaded!`);
      }
      client.commands.set(command.data.name, command);
    }
  }
}

// Reading event files
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Error handlers
client.on("warn", async (error) => {
  console.log(error);
  await logError("WARN", error);
});

client.on("error", async (error) => {
  console.log(error);
  await logError("ERROR", error);
});

process.on("unhandledRejection", async (error) => {
  console.log(error);
  await logError("unhandledRejection", error);
});

process.on("uncaughtException", async (error) => {
  console.log(error);
  await logError("uncaughtException", error);
});

// Log in to Discord with your app's token
client.login(process.env.BOT_TOKEN).catch(async (error) => {
  if (error.message.includes("An invalid token was provided")) {
    console.log(error);
    await logError("INVALID_TOKEN", error);
    process.exit();
  } else if (
    error.message.includes(
      "Privileged intent provided is not enabled or whitelisted.",
    )
  ) {
    console.log(error);
    await logError("DISALLOWED_INTENTS", error);
    process.exit();
  } else {
    console.log(error);
    await logError("ERROR", error);
    process.exit();
  }
});
