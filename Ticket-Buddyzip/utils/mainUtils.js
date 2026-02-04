const { EmbedBuilder, AttachmentBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
const discordHtmlTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const packageJson = require("../package.json");
const {
  client,
  mainDB,
  ticketsDB,
  ticketCategories,
  blacklistDB,
} = require("../init.js");
const date = new Date();
const options = {
  timeZoneName: "short",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: true,
};
const timeString = date.toLocaleString("en-US", options);

function guildKey(guildId, key) {
  if (!guildId) throw new Error("Guild ID is required for database operations");
  return `guild:${guildId}:${key}`;
}

async function guildDBGet(db, guildId, key) {
  return db.get(guildKey(guildId, key));
}

async function guildDBSet(db, guildId, key, value) {
  return db.set(guildKey(guildId, key), value);
}

async function guildDBAdd(db, guildId, key, value) {
  return db.add(guildKey(guildId, key), value);
}

async function guildDBSub(db, guildId, key, value) {
  return db.sub(guildKey(guildId, key), value);
}

async function guildDBPush(db, guildId, key, value) {
  return db.push(guildKey(guildId, key), value);
}

async function guildDBDelete(db, guildId, key) {
  return db.delete(guildKey(guildId, key));
}

async function logMessage(message) {
  const logMessage = `[${timeString}] [Bot v${packageJson.version}] [NodeJS ${process.version}] [LOG] ${message}\n\n`;

  try {
    await fs.promises.appendFile("./logs.txt", logMessage);
  } catch (error) {
    error.errorContext = `[logMessage Function Error]: error writing to log file`;
    client.emit("error", error);
  }
}

async function checkAdminRole(interaction) {
  const guildId = interaction.guild.id;
  const guildSettings = await mainDB.get(`guildSettings.${guildId}.adminRoleIDs`);
  
  console.log(`[checkAdminRole] Guild: ${guildId} | StoredRoles: ${JSON.stringify(guildSettings)} | UserRoles: ${interaction.member.roles.cache.map(r => `${r.name}(${r.id})`).join(", ")}`);
  
  // Check if user has a role configured via /rolesettings for admin command access
  if (guildSettings && Array.isArray(guildSettings) && guildSettings.length > 0) {
    const hasRole = interaction.member.roles.cache.some((role) => {
      const isConfiguredRole = guildSettings.includes(role.id);
      if (isConfiguredRole) {
        console.log(`[checkAdminRole] User has admin role: ${role.name} (${role.id})`);
      }
      return isConfiguredRole;
    });
    return hasRole;
  }
  
  console.log(`[checkAdminRole] No admin roles configured for guild`);
  return false;
}

async function checkSupportRole(interaction) {
  const guildId = interaction.guild.id;
  const guildSettings = await mainDB.get(`guildSettings.${guildId}.supportRoleIDs`);
  
  // Also check if user has Administrator permission (fallback for admins)
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if user has a support role (for ticket notifications)
  if (guildSettings && Array.isArray(guildSettings) && guildSettings.length > 0) {
    const hasRole = interaction.member.roles.cache.some((role) => {
      const isConfiguredRole = guildSettings.includes(role.id);
      return isConfiguredRole;
    });
    return hasRole;
  }
  
  // If no server-specific roles are set, fall back to global config
  const globalSupportRoles = config.rolesThatCanBlacklist || [];
  if (globalSupportRoles.length > 0) {
    return interaction.member.roles.cache.some((role) => globalSupportRoles.includes(role.id));
  }

  return false;
}

async function addTicketCreator(userID, guildId = null) {
  const key = guildId ? guildKey(guildId, "ticketCreators") : "ticketCreators";
  let ticketCreators = (await mainDB.get(key)) || [];
  let existingCreator = ticketCreators.find(
    (creator) => String(creator.userID) === String(userID),
  );

  if (existingCreator) {
    existingCreator.ticketsCreated = (Number(existingCreator.ticketsCreated) || 0) + 1;
  } else {
    ticketCreators.push({ userID: userID, ticketsCreated: 1 });
  }

  await mainDB.set(key, ticketCreators);
}

async function getUser(id) {
  let user = client.users.cache.get(id);

  if (user) {
    return user;
  } else {
    try {
      user = await client.users.fetch(id);
      return user;
    } catch (error) {
      error.errorContext = `[getUser Function Error]: error fetching user with ID ${id}`;
      client.emit("error", error);
      return null;
    }
  }
}

async function getMember(id, guild = null) {
  if (!guild) {
    return null;
  }
  let member = guild.members.cache.get(id);

  if (member) {
    return member;
  } else {
    try {
      member = await guild.members.fetch(id);
      return member;
    } catch (error) {
      error.errorContext = `[getMember Function Error]: error fetching member with ID ${id}`;
      client.emit("error", error);
      return null;
    }
  }
}

async function getRole(id, guild = null) {
  if (!guild) {
    return null;
  }
  let role = guild.roles.cache.get(id);

  if (role) {
    return role;
  } else {
    try {
      role = await guild.roles.fetch(id);
      return role;
    } catch (error) {
      error.errorContext = `[getRole Function Error]: error fetching role with ID ${id}`;
      client.emit("error", error);
      return null;
    }
  }
}

async function getChannel(id) {
  let channel = client.channels.cache.get(id);

  if (channel) {
    return channel;
  } else {
    try {
      channel = await client.channels.fetch(id);
      return channel;
    } catch (error) {
      if (error.code === 10003) {
        return null;
      }
      error.errorContext = `[getChannel Function Error]: error fetching channel with ID ${id}`;
      client.emit("error", error);
      return null;
    }
  }
}

const findAvailableCategory = async (categoryIDs) => {
  if (!Array.isArray(categoryIDs)) {
    throw new Error(
      'categoryID and closedCategoryID of each configured ticket category must be an array, such as ["ID"]',
    );
  }
  for (const categoryID of categoryIDs) {
    const category = await getChannel(categoryID);
    const channelCount = category.children.cache.size;
    if (channelCount < 50) {
      return categoryID;
    }
  }
  return null; // No available category found
};

async function getPermissionOverwrites(
  permissions,
  type = "open",
  defaults = {},
) {
  const permissionOverwrites = {};
  const allowPermissions = permissions?.[type]?.allow || defaults?.allow || [];
  const denyPermissions = permissions?.[type]?.deny || defaults?.deny || [];
  await Promise.all(
    allowPermissions.map(async (permission) => {
      permissionOverwrites[permission] = true;
    }),
  );
  await Promise.all(
    denyPermissions.map(async (permission) => {
      permissionOverwrites[permission] = false;
    }),
  );
  return permissionOverwrites;
}

async function configEmbed(configPath, defaultValues = {}) {
  const embed = new EmbedBuilder();
  let configValue;
  if (Array.isArray(configPath) && configPath[0] === "panelEmbed") {
    const panelIndex = configPath[1];
    configValue = config.panels[panelIndex].panelEmbed;
  } else {
    configValue = config[configPath];
  }

  embed.setColor(configValue?.color || defaultValues?.color || "#2FF200");

  if (configValue?.description !== "" && configValue?.description !== null) {
    embed.setDescription(
      configValue?.description || defaultValues?.description || null,
    );
  }

  if (configValue?.title !== "" && configValue?.title !== null) {
    embed.setTitle(configValue?.title || defaultValues?.title);
  }

  if (configValue?.URL !== "" && configValue?.URL !== null) {
    embed.setURL(configValue?.URL || defaultValues?.URL);
  }

  if (configValue?.image !== "" && configValue?.image !== null) {
    embed.setImage(configValue?.image || defaultValues?.image);
  }

  if (configValue?.thumbnail !== "" && configValue?.thumbnail !== null) {
    embed.setThumbnail(configValue?.thumbnail || defaultValues?.thumbnail);
  }

  if (configValue?.timestamp === true) {
    embed.setTimestamp();
  } else if (
    configValue?.timestamp !== false &&
    defaultValues?.timestamp === true
  ) {
    embed.setTimestamp();
  }

  // Setting author and footer
  if (configValue?.author?.name !== "" && configValue?.author?.name !== null) {
    const authorValues = {
      name: configValue?.author?.name || defaultValues?.author?.name || null,
      url:
        configValue?.author?.url !== "" && configValue?.author?.url !== null
          ? configValue?.author?.url || defaultValues?.author?.url
          : undefined,
      iconURL:
        configValue?.author?.iconURL !== "" &&
        configValue?.author?.iconURL !== null
          ? configValue?.author?.iconURL || defaultValues?.author?.iconURL
          : undefined,
    };
    embed.setAuthor(authorValues);
  }

  if (configValue?.footer?.text !== "" && configValue?.footer?.text !== null) {
    const footerValues = {
      text: configValue?.footer?.text || defaultValues?.footer?.text || null,
      iconURL:
        configValue?.footer?.iconURL !== "" &&
        configValue?.footer?.iconURL !== null
          ? configValue?.footer?.iconURL || defaultValues?.footer?.iconURL
          : undefined,
    };
    embed.setFooter(footerValues);
  }

  return embed;
}

async function saveTranscript(
  interaction,
  ticketChannel,
  saveImages = false,
  user = null,
) {
  const createTranscriptOptions = {
    limit: -1,
    saveImages,
    returnType: "buffer",
    poweredBy: false,
  };

  let channel;
  if (interaction) {
    channel = interaction.channel;
  } else if (ticketChannel) {
    channel = ticketChannel;
  }

  if (channel) {
    let fileName = config.transcriptName || "{channelName}-transcript";
    fileName = fileName.replace(/\{channelName\}/g, channel.name);
    if (user) {
      const member = await getMember(user.id, channel.guild);
      fileName = fileName
        .replace(/\{username\}/g, user.username)
        .replace(
          /\{displayName\}/g,
          member ? member.displayName : user.username,
        );
    }
    const attachmentBuffer = await discordHtmlTranscripts.createTranscript(
      channel,
      {
        ...createTranscriptOptions,
        fileName,
      },
    );
    return new AttachmentBuilder(Buffer.from(attachmentBuffer), {
      name: `${fileName}.html`,
    });
  }

  return null;
}

async function saveTranscriptTxt(interaction, ticketChannel, user = null) {
  let channel;
  if (interaction) {
    channel = interaction.channel;
  } else if (ticketChannel) {
    channel = ticketChannel;
  }
  let lastId;
  let transcript = [];
  let totalFetched = 0;
  let ticketUserID = await getUser(await ticketsDB.get(`${channel.id}.userID`));
  let claimUserID = await ticketsDB.get(`${channel.id}.claimUser`);
  let claimUser;

  if (claimUserID) {
    claimUser = await getUser(claimUserID);
  }

  while (true) {
    const options = { limit: 100 };
    if (lastId) {
      options.before = lastId;
    }

    const fetched = await channel.messages.fetch(options);
    totalFetched += fetched.size;
    lastId = fetched.lastKey();

    const newLines = fetched.map((m) => {
      let messageText = `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.username}: `;

      if (m.content) {
        messageText += m.content;
        if (m.attachments.size > 0) {
          messageText += " ";
        }
      }

      if (m.attachments.size > 0) {
        const attachmentText = m.attachments
          .map((attachment) => attachment.proxyURL)
          .join("\n");
        messageText += attachmentText;
      }

      if (m.embeds.length > 0) {
        const embedText = m.embeds
          .map((embed) => {
            let embedFields = "";

            if (embed.fields && embed.fields.length > 0) {
              embedFields = embed.fields
                .map((field) => `${field.name} : ${field.value}`)
                .join("\n");
            }

            let embedContent = "";
            if (embed.title) {
              embedContent += `Embed Title: ${embed.title}\n`;
            }
            if (embed.description) {
              embedContent += `Embed Description: ${embed.description}\n`;
            }
            if (embedFields) {
              embedContent += `${embedFields}\n`;
            }

            return embedContent.trim();
          })
          .filter((embedText) => embedText !== "")
          .join("\n");

        messageText += embedText;
      }

      return messageText;
    });

    transcript.push(...newLines);

    // break when there are no more messages
    if (fetched.size < 100) break;
  }

  const deletedBy = interaction?.user?.tag || client.user.tag || "Automation";
  const guildName = interaction?.guild?.name || channel?.guild?.name || "Unknown Server";
  const additionalInfo = `Server: ${guildName}\nTicket: #${channel.name}\nCategory: ${await ticketsDB.get(`${channel.id}.ticketType`)}\nTicket Author: ${ticketUserID.tag}\nDeleted By: ${deletedBy}\nClaimed By: ${claimUser ? claimUser.tag : "None"}\n`;
  const finalTranscript = [additionalInfo, ...transcript.reverse()];
  finalTranscript.push(`\nTotal messages: ${totalFetched}`);
  let fileName = config.transcriptName || "{channelName}-transcript";
  fileName = fileName.replace(/\{channelName\}/g, channel.name);
  if (user) {
    const member = await getMember(user.id, channel.guild);
    fileName = fileName
      .replace(/\{username\}/g, user.username)
      .replace(/\{displayName\}/g, member ? member.displayName : user.username);
  }

  return new AttachmentBuilder(Buffer.from(finalTranscript.join("\n")), {
    name: `${fileName}.txt`,
  });
}

async function countMessagesInTicket(channel, lastId = null) {
  let messageCount = 0;

  while (true) {
    const options = { limit: 100 };
    if (lastId) {
      options.before = lastId;
    }

    const messages = await channel.messages.fetch(options);
    messageCount += messages.size;
    lastId = messages.lastKey();

    // break when there are no more messages
    if (messages.size < 100) break;
  }
  return messageCount;
}

function parseDurationToMilliseconds(duration) {
  if (!duration) {
    return 0;
  }

  const unitMap = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000,
  };

  const numericValue = parseInt(duration, 10);
  const unit = duration.slice(-1);

  return numericValue * unitMap[unit] || 0;
}

function isBlacklistExpired(timestamp, duration) {
  if (duration === "permanent" || duration === undefined) {
    return false; // Treat undefined or 'permanent' as permanent blacklist
  }
  const durationInMilliseconds = parseDurationToMilliseconds(duration);
  const expirationTime = timestamp + durationInMilliseconds;
  return Date.now() >= expirationTime;
}

async function cleanBlacklist() {
  const currentTime = Date.now();
  const blacklistedEntries = (await blacklistDB.all()) || [];
  
  // Filter for entries that have a duration and are not permanent
  const temporaryEntries = blacklistedEntries.filter(
    (entry) => entry.value && entry.value.duration && entry.value.duration !== "permanent"
  );

  if (temporaryEntries.length > 0) {
    for (const { id, value } of temporaryEntries) {
      const { timestamp, duration } = value;
      const expiryTime = timestamp + parseDurationToMilliseconds(duration);

      if (currentTime >= expiryTime) {
        // Blacklist has expired, remove it
        await blacklistDB.delete(id);
        
        // If it's a user entry, try to remove the blacklist roles
        if (id.includes(":user-")) {
          const parts = id.split(":");
          const guildId = parts[1];
          const userId = parts[2].split("-")[1];
          const guild = client.guilds.cache.get(guildId);
          
          if (guild) {
            try {
              const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
              if (member) {
                const blacklistRoles = config.rolesOnBlacklist || [];
                for (const roleId of blacklistRoles) {
                  const role = await getRole(roleId, guild);
                  if (role) {
                    await member.roles.remove(role).catch(() => {});
                  }
                }
              }
            } catch (error) {
              // Ignore member fetch errors
            }
          }
        }
        
        await logMessage(`[Blacklist Cleanup] Removed expired entry: ${id}`);
      }
    }
  }
}

async function getUserPreference(id, type) {
  const preference = await blacklistDB.get(`userPreference-${id}`);
  const defaultPref =
    config.commands.preference.defaultDM !== undefined
      ? config.commands.preference.defaultDM
      : true;
  if (preference === undefined || preference === null) {
    return defaultPref;
  } else if (preference[type] === undefined) {
    return defaultPref;
  } else {
    return preference[type];
  }
}

function formatTime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  let result = "";
  if (d > 0) result += `${d}d `;
  if (h > 0) result += `${h}h `;
  if (m > 0) result += `${m}m `;
  if (s > 0 || result === "") result += `${s}s`;

  return result.trim();
}

function sanitizeInput(input) {
  const formattingCharacters = ["_", "*", "`", "~", "|", "-"];
  const escapedInput = input.replace(
    new RegExp(`[${formattingCharacters.join("")}]`, "g"),
    "\\$&",
  );
  return escapedInput;
}

async function logError(errorType, error) {
  const errorContext =
    error?.errorContext !== undefined
      ? `\n[Error Context] -> ${error?.errorContext}`
      : "";
  const errorMessage = `[${timeString}] -> [Bot v${packageJson.version}] [Node.JS ${process.version}] [Type: ${errorType}]\n\n${error.stack}\n\n${errorContext}`;
  const logsFileToChannel = config?.logsFileToChannel ?? false;
  const logsFileChannelID = config?.logsFileChannelID ?? "";

  try {
    if (logsFileToChannel && logsFileChannelID) {
      const channel = await getChannel(logsFileChannelID);
      if (channel) {
        await channel.send(`\`\`\`\n${errorMessage}\n\`\`\``);
      } else {
        throw new Error("Channel not found for logging errors.");
      }
    } else {
      await fs.promises.appendFile("./logs.txt", errorMessage);
    }
  } catch (error) {
    error.errorContext = `[logError Function Error]: error writing to log file`;
    client.emit("error", error);
  }
}

async function lastUserMsgTimestamp(userId, channelId) {
  const channel = await getChannel(channelId);
  if (!channel) return null;
  let lastId;
  let lastTimestamp = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) {
      options.before = lastId;
    }

    const fetched = await channel.messages.fetch(options);
    lastId = fetched.lastKey();

    for (const msg of fetched.values()) {
      if (msg.author.id === userId) {
        lastTimestamp = msg.createdTimestamp;
        break;
      }
    }

    // break when the timestamp is found or when there are no more messages to fetch
    if (lastTimestamp) break;
    if (fetched.size < 100) break;
  }
  return lastTimestamp;
}

async function lastChannelMsgTimestamp(channelId) {
  const channel = await getChannel(channelId);
  if (!channel) return null;
  
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const lastMsg = messages.find(msg => {
      if (msg.author.bot && config.autoCloseTickets.ignoreBots) {
        return false;
      }
      return true;
    });
    
    return lastMsg ? lastMsg.createdTimestamp : null;
  } catch (error) {
    console.error(`[lastChannelMsgTimestamp] Error fetching messages for ${channelId}:`, error);
    return null;
  }
}

async function getGuildSettings(guildId) {
  const settings = {
    openCategoryID: await mainDB.get(`guildSettings.${guildId}.openCategoryID`),
    closedCategoryID: await mainDB.get(`guildSettings.${guildId}.closedCategoryID`),
    transcriptChannelID: await mainDB.get(`guildSettings.${guildId}.transcriptChannelID`),
    supportRoleIDs: await mainDB.get(`guildSettings.${guildId}.supportRoleIDs`),
  };
  return settings;
}

async function getGuildCategoryID(guildId, categoryFromConfig) {
  const guildSettings = await getGuildSettings(guildId);
  if (guildSettings.openCategoryID) {
    return [guildSettings.openCategoryID];
  }
  return categoryFromConfig;
}

async function getGuildClosedCategoryID(guildId, categoryFromConfig) {
  const guildSettings = await getGuildSettings(guildId);
  if (guildSettings.closedCategoryID) {
    return [guildSettings.closedCategoryID];
  }
  return categoryFromConfig;
}

async function getGuildTranscriptChannel(guildId) {
  const guildSettings = await getGuildSettings(guildId);
  if (guildSettings.transcriptChannelID) {
    return guildSettings.transcriptChannelID;
  }
  return null;
}

async function listUserTickets(interaction, user, isEphemeral) {
  const guildId = interaction.guild.id;
  
  // Current tickets (only those still in database)
  const allTickets = (await ticketsDB.all()) || [];
  const userTickets = allTickets.filter(t => {
    const data = t.value;
    if (!data) return false;
    // Strict ID matching as strings to avoid type issues
    return String(data.userID) === String(user.id) && (String(data.guildID) === String(guildId) || !data.guildID);
  });
  
  const openTicketsList = userTickets.filter(t => t.value && t.value.status === "Open");
  const closedTicketsList = userTickets.filter(t => t.value && t.value.status === "Closed");
  
  // Persistent lifetime stats from mainDB using a reliable key pattern
  const userStatsKey = `userLifetimeStats.${guildId}.${user.id}`;
  const rawStats = await mainDB.get(userStatsKey);
  
  const lifetimeStats = {
    created: (rawStats && typeof rawStats === 'object' && 'created' in rawStats) ? Number(rawStats.created) : 0,
    claimed: (rawStats && typeof rawStats === 'object' && 'claimed' in rawStats) ? Number(rawStats.claimed) : 0,
    closed: (rawStats && typeof rawStats === 'object' && 'closed' in rawStats) ? Number(rawStats.closed) : 0
  };

  const defaultValues = {
    color: "#2FF200",
    title: `Ticket Statistics: ${user.tag}`,
    timestamp: true,
    footer: {
      text: "Lifetime stats persist permanently even after ticket deletion.",
      iconURL: `${user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const embed = new EmbedBuilder()
    .setColor(defaultValues.color)
    .setTitle(defaultValues.title)
    .setThumbnail(user.displayAvatarURL({ extension: "png", size: 1024 }))
    .addFields(
      { 
        name: "📊 Current Status (Active)", 
        value: `> Open Tickets: **${openTicketsList.length}**\n> Closed Tickets: **${closedTicketsList.length}**`,
        inline: false 
      },
      { 
        name: "📈 Lifetime Statistics (Permanent)", 
        value: `> Total Created: **${lifetimeStats.created}**\n> Total Claimed (Staff): **${lifetimeStats.claimed}**\n> Total Closed: **${lifetimeStats.closed}**`,
        inline: false
      }
    )
    .setTimestamp();

  // If there are active tickets, list them
  if (userTickets.length > 0) {
    const ticketDetails = userTickets.map(t => {
      const statusEmoji = t.value.status === "Open" ? "🟢" : "🔴";
      return `${statusEmoji} <#${t.id}> | ${t.value.ticketType}`;
    }).join("\n");
    
    if (ticketDetails.length < 1024) {
      embed.addFields({ name: "🎫 Active Ticket Details", value: ticketDetails });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function getGuildSupportRoles(guildId, rolesFromConfig) {
  const guildSettings = await getGuildSettings(guildId);
  if (guildSettings.supportRoleIDs) {
    return guildSettings.supportRoleIDs;
  }
  return rolesFromConfig;
}

async function getFirstClosedTicket(userID) {
  const tickets = (await ticketsDB.all()) || [];
  const userTickets = tickets.filter(
    (ticket) =>
      ticket.value.userID === userID && ticket.value.status === "Closed",
  );
  return userTickets[0]?.id;
}

async function getBlacklistedEmbed(
  interaction,
  isUserBlacklisted,
  isRoleBlacklisted,
) {
  let expiryDate;
  let blacklistReason;
  let blacklistType;

  if (isUserBlacklisted) {
    const expirationTime =
      isUserBlacklisted?.timestamp +
      parseDurationToMilliseconds(isUserBlacklisted?.duration);
    expiryDate =
      isUserBlacklisted?.duration === "permanent"
        ? "Never"
        : `<t:${Math.floor(expirationTime / 1000)}:R>`;
    blacklistReason = isUserBlacklisted?.reason;
    blacklistType = "User";
  } else if (isRoleBlacklisted) {
    const expirationTime =
      isRoleBlacklisted?.timestamp +
      parseDurationToMilliseconds(isRoleBlacklisted?.duration);
    expiryDate =
      isRoleBlacklisted?.duration === "permanent"
        ? "Never"
        : `<t:${Math.floor(expirationTime / 1000)}:R>`;
    blacklistReason = isRoleBlacklisted?.reason;
    blacklistType = "Role";
  }

  const defaultblacklistedValues = {
    color: "#FF0000",
    title: "Blacklisted",
    description:
      "You are currently blacklisted from creating tickets.\nExpires: **{time}**\nReason: **{reason}**\nType: **{type}**",
    timestamp: true,
    footer: {
      text: `${interaction.user.tag}`,
      iconURL: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const blacklistedEmbed = await configEmbed(
    "blacklistedEmbed",
    defaultblacklistedValues,
  );

  if (blacklistedEmbed.data && blacklistedEmbed.data.description) {
    blacklistedEmbed.setDescription(
      blacklistedEmbed.data.description
        .replace(/\{time\}/g, expiryDate)
        .replace(/\{reason\}/g, blacklistReason)
        .replace(/\{type\}/g, blacklistType),
    );
  }

  return blacklistedEmbed;
}

async function getUserTicketCount(interaction) {
  return interaction.guild.channels.cache.reduce(async (count, channel) => {
    if (await ticketsDB.has(channel.id)) {
      const { userID, status } = await ticketsDB.get(channel.id);
      if (userID === interaction.user.id && status !== "Closed") {
        return (await count) + 1;
      }
    }
    return await count;
  }, Promise.resolve(0));
}

module.exports = {
  guildKey,
  guildDBGet,
  guildDBSet,
  guildDBAdd,
  guildDBSub,
  guildDBPush,
  guildDBDelete,
  logMessage,
  checkAdminRole,
  checkSupportRole,
  addTicketCreator,
  getUser,
  getMember,
  getRole,
  getChannel,
  findAvailableCategory,
  getPermissionOverwrites,
  configEmbed,
  saveTranscript,
  saveTranscriptTxt,
  countMessagesInTicket,
  parseDurationToMilliseconds,
  isBlacklistExpired,
  cleanBlacklist,
  getUserPreference,
  formatTime,
  sanitizeInput,
  logError,
  lastUserMsgTimestamp,
  lastChannelMsgTimestamp,
  listUserTickets,
  getFirstClosedTicket,
  getBlacklistedEmbed,
  getUserTicketCount,
  getGuildSettings,
  getGuildCategoryID,
  getGuildClosedCategoryID,
  getGuildTranscriptChannel,
  getGuildSupportRoles,
};
