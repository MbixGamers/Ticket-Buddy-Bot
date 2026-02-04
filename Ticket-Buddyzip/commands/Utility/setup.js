const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { mainDB, guildDB } = require("../../init.js");
const {
  getGuildConfig,
  setGuildConfig,
  addGuildPanel,
  addGuildCategory,
  removeGuildPanel,
  removeGuildCategory,
} = require("../../utils/guildConfig.js");
const { checkAdminRole } = require("../../utils/mainUtils.js");

module.exports = {
  enabled: true,
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure server-specific ticket settings")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("categories")
        .setDescription("Set the open and closed ticket category channels")
        .addChannelOption((option) =>
          option
            .setName("open_category")
            .setDescription("The category where new tickets will be created")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addChannelOption((option) =>
          option
            .setName("closed_category")
            .setDescription("The category where closed tickets will be moved")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("logs")
        .setDescription("Set the transcript logs channel")
        .addChannelOption((option) =>
          option
            .setName("transcript_channel")
            .setDescription("The channel where transcripts will be sent")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("support_roles")
        .setDescription("Set the support roles that get pinged when tickets open")
        .addRoleOption((option) =>
          option
            .setName("role1")
            .setDescription("First support role")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role2")
            .setDescription("Second support role (optional)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role3")
            .setDescription("Third support role (optional)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role4")
            .setDescription("Fourth support role (optional)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role5")
            .setDescription("Fifth support role (optional)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role6")
            .setDescription("Sixth support role (optional)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("autoclose")
        .setDescription("Configure auto-close settings for this server")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Enable or disable auto-close")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("time")
            .setDescription("Time in seconds before auto-close (default: 86400 = 1 day)")
            .setRequired(false)
            .setMinValue(60)
            .setMaxValue(2592000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create_panel")
        .setDescription("Create a custom ticket panel for this server")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Panel name/title")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Panel description")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("color")
            .setDescription("Embed color (hex, e.g., #2FF200)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add_button")
        .setDescription("Add a ticket button to a panel")
        .addIntegerOption((option) =>
          option
            .setName("panel_id")
            .setDescription("Panel ID to add button to")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("label")
            .setDescription("Button label")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("category_name")
            .setDescription("Ticket category name")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("style")
            .setDescription("Button style")
            .setRequired(false)
            .addChoices(
              { name: "Primary (Blue)", value: "Primary" },
              { name: "Secondary (Gray)", value: "Secondary" },
              { name: "Success (Green)", value: "Success" },
              { name: "Danger (Red)", value: "Danger" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("Button emoji")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("menu_description")
            .setDescription("Optional description for the dropdown menu layout")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove_button")
        .setDescription("Remove a button from a panel")
        .addIntegerOption((option) =>
          option
            .setName("panel_id")
            .setDescription("Panel ID")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("button_id")
            .setDescription("Button ID to remove")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("send_panel")
        .setDescription("Send a custom panel to a channel")
        .addIntegerOption((option) =>
          option
            .setName("panel_id")
            .setDescription("Panel ID to send")
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to send panel to")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((option) =>
          option
            .setName("layout")
            .setDescription("Buttons or select menu for the panel layout")
            .setRequired(false)
            .addChoices(
              { name: "Buttons", value: "Buttons" },
              { name: "Menu", value: "Menu" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list_panels")
        .setDescription("List all custom panels for this server")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete_panel")
        .setDescription("Delete a custom panel")
        .addIntegerOption((option) =>
          option
            .setName("panel_id")
            .setDescription("Panel ID to delete")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View the current server configuration")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Reset server configuration to use global defaults")
    )
    .setDMPermission(false),
  async execute(interaction) {
    // Check if user has Administrator permission or is in configured admin roles
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAdminRole = await checkAdminRole(interaction);
    
    console.log(`[SETUP Command] User: ${interaction.user.tag} (${interaction.member.id}) | Admin: ${isAdmin} | HasAdminRole: ${hasAdminRole} | UserRoles: ${interaction.member.roles.cache.map(r => r.name).join(", ")}`);
    
    if (!isAdmin && !hasAdminRole) {
      // Get guild settings to show which roles are required
      const guildId = interaction.guild.id;
      const configuredRoles = await mainDB.get(`guildSettings.${guildId}.adminRoleIDs`) || [];
      const roleList = configuredRoles.length > 0 
        ? configuredRoles.map(id => `<@&${id}>`).join(", ")
        : "No admin roles configured. Use /rolesettings to configure roles.";
      
      return interaction.reply({
        content: `❌ You don't have permission to use this command!\n\n**Required:** Administrator role OR one of: ${roleList}\n\n**Troubleshooting:** Make sure your role has these permissions enabled:\n  • Use Application Commands\n  • Manage Channels\n  • Manage Messages`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === "categories") {
      const openCategory = interaction.options.getChannel("open_category");
      const closedCategory = interaction.options.getChannel("closed_category");

      await mainDB.set(`guildSettings.${guildId}.openCategoryID`, openCategory.id);
      await mainDB.set(`guildSettings.${guildId}.closedCategoryID`, closedCategory.id);

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Categories Configured")
        .setDescription("Ticket categories have been updated for this server.")
        .addFields(
          { name: "Open Tickets Category", value: `${openCategory.name} (\`${openCategory.id}\`)`, inline: true },
          { name: "Closed Tickets Category", value: `${closedCategory.name} (\`${closedCategory.id}\`)`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "logs") {
      const transcriptChannel = interaction.options.getChannel("transcript_channel");

      await mainDB.set(`guildSettings.${guildId}.transcriptChannelID`, transcriptChannel.id);

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Logs Channel Configured")
        .setDescription("Transcript logs channel has been updated for this server.")
        .addFields(
          { name: "Transcript Logs Channel", value: `<#${transcriptChannel.id}> (\`${transcriptChannel.id}\`)` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "support_roles") {
      const role1 = interaction.options.getRole("role1");
      const role2 = interaction.options.getRole("role2");
      const role3 = interaction.options.getRole("role3");
      const role4 = interaction.options.getRole("role4");
      const role5 = interaction.options.getRole("role5");
      const role6 = interaction.options.getRole("role6");

      const roles = [role1.id];
      if (role2) roles.push(role2.id);
      if (role3) roles.push(role3.id);
      if (role4) roles.push(role4.id);
      if (role5) roles.push(role5.id);
      if (role6) roles.push(role6.id);

      await mainDB.set(`guildSettings.${guildId}.supportRoleIDs`, roles);

      const roleList = roles.map((id) => `<@&${id}>`).join(", ");

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Support Roles Configured")
        .setDescription("Support roles have been updated for this server.")
        .addFields(
          { name: "Support Roles", value: roleList }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "autoclose") {
      const enabled = interaction.options.getBoolean("enabled");
      const time = interaction.options.getInteger("time") || 86400;

      const guildConfig = await getGuildConfig(guildId);
      guildConfig.autoClose = { enabled, time };
      await setGuildConfig(guildId, guildConfig);

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Auto-Close Configured")
        .setDescription("Auto-close settings have been updated for this server.")
        .addFields(
          { name: "Enabled", value: enabled ? "Yes" : "No", inline: true },
          { name: "Time", value: `${time} seconds (${Math.round(time / 3600)} hours)`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "create_panel") {
      const name = interaction.options.getString("name");
      const description = interaction.options.getString("description");
      const color = interaction.options.getString("color") || "#2FF200";

      const guildConfig = await getGuildConfig(guildId);
      const nextId = guildConfig.panels.length > 0 
        ? Math.max(...guildConfig.panels.map(p => p.id)) + 1 
        : 1;

      const newPanel = {
        id: nextId,
        name,
        description,
        color,
        buttons: [],
        maxButtonsPerRow: 5,
      };

      await addGuildPanel(guildId, newPanel);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("Panel Created")
        .setDescription(`Custom panel **${name}** has been created.`)
        .addFields(
          { name: "Panel ID", value: `${nextId}`, inline: true },
          { name: "Name", value: name, inline: true },
          { name: "Description", value: description }
        )
        .setFooter({ text: "Use /setup add_button to add ticket buttons to this panel" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "add_button") {
      const panelId = interaction.options.getInteger("panel_id");
      const label = interaction.options.getString("label");
      const categoryName = interaction.options.getString("category_name");
      const style = interaction.options.getString("style") || "Primary";
      const emoji = interaction.options.getString("emoji") || "";
      const menuDescription = interaction.options.getString("menu_description") || "";

      const guildConfig = await getGuildConfig(guildId);
      const panel = guildConfig.panels.find(p => p.id === panelId);

      if (!panel) {
        return interaction.reply({
          content: `Panel with ID ${panelId} not found. Use /setup list_panels to see available panels.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const buttonId = `guild_${guildId}_panel_${panelId}_btn_${Date.now()}`;
      
      const openCategoryID = await mainDB.get(`guildSettings.${guildId}.openCategoryID`);
      const closedCategoryID = await mainDB.get(`guildSettings.${guildId}.closedCategoryID`);
      const supportRoleIDs = await mainDB.get(`guildSettings.${guildId}.supportRoleIDs`) || [];

      if (!openCategoryID || !closedCategoryID) {
        return interaction.reply({
          content: "Please configure ticket categories first using `/setup categories`.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const newButton = {
        id: buttonId,
        label,
        categoryName,
        style,
        emoji,
        menuDescription,
        openCategoryID,
        closedCategoryID,
        supportRoleIDs,
      };

      panel.buttons.push(newButton);
      await addGuildPanel(guildId, panel);

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Button Added")
        .setDescription(`Button **${label}** has been added to panel **${panel.name}**.`)
        .addFields(
          { name: "Button ID", value: buttonId, inline: true },
          { name: "Category", value: categoryName, inline: true },
          { name: "Style", value: style, inline: true },
          { name: "Total Buttons", value: `${panel.buttons.length}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "remove_button") {
      const panelId = interaction.options.getInteger("panel_id");
      const buttonId = interaction.options.getString("button_id");

      const guildConfig = await getGuildConfig(guildId);
      const panel = guildConfig.panels.find(p => p.id === panelId);

      if (!panel) {
        return interaction.reply({
          content: `Panel with ID ${panelId} not found.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const buttonIndex = panel.buttons.findIndex(b => b.id === buttonId);
      if (buttonIndex === -1) {
        return interaction.reply({
          content: `Button with ID ${buttonId} not found in this panel.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      panel.buttons.splice(buttonIndex, 1);
      await addGuildPanel(guildId, panel);

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("Button Removed")
        .setDescription(`Button has been removed from panel **${panel.name}**.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "send_panel") {
      const panelId = interaction.options.getInteger("panel_id");
      const channel = interaction.options.getChannel("channel");
      const layout = interaction.options.getString("layout") || "Buttons";

      const guildConfig = await getGuildConfig(guildId);
      const panel = guildConfig.panels.find(p => p.id === panelId);

      if (!panel) {
        return interaction.reply({
          content: `Panel with ID ${panelId} not found.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (panel.buttons.length === 0) {
        return interaction.reply({
          content: "This panel has no buttons. Add buttons using `/setup add_button` first.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(panel.color || "#2FF200")
        .setTitle(panel.name || "Support Tickets")
        .setDescription(panel.description || "To create a support ticket, click on one of the options below.")
        .setFooter({ text: layout === "Buttons" ? "Click a button below to create a ticket" : "Select a category below to create a ticket" })
        .setTimestamp();

      if (layout === "Buttons") {
        const buttons = panel.buttons.map(btn => {
          const button = new ButtonBuilder()
            .setCustomId(btn.id)
            .setLabel(btn.label)
            .setStyle(ButtonStyle[btn.style]);
          
          if (btn.emoji) {
            button.setEmoji(btn.emoji);
          }
          
          return button;
        });

        const actionRows = [];
        const maxButtonsPerRow = panel.maxButtonsPerRow || 5;

        for (let i = 0; i < buttons.length; i += maxButtonsPerRow) {
          const buttonsGroup = buttons.slice(i, i + maxButtonsPerRow);
          const actionRow = new ActionRowBuilder().addComponents(...buttonsGroup);
          actionRows.push(actionRow);
        }

        await channel.send({ embeds: [embed], components: actionRows });
      } else {
        const options = panel.buttons.map(btn => {
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(btn.label)
            .setValue(btn.id);
          
          if (btn.emoji) {
            option.setEmoji(btn.emoji);
          }

          if (btn.menuDescription) {
            option.setDescription(btn.menuDescription);
          }
          
          return option;
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("guildCategoryMenu")
          .setPlaceholder("Select a category to open a ticket.")
          .addOptions(options);

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        await channel.send({ embeds: [embed], components: [actionRow] })
          .then(async (message) => {
            await mainDB.set(`selectMenuOptions-${message.id}`, {
              options,
              placeholder: "Select a category to open a ticket.",
              isGuildPanel: true,
              guildId: guildId,
              panelId: panelId
            });
          });
      }

      const confirmEmbed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Panel Sent")
        .setDescription(`Panel **${panel.name}** has been sent to <#${channel.id}> with **${layout}** layout.`)
        .setTimestamp();

      await interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "list_panels") {
      const guildConfig = await getGuildConfig(guildId);

      if (guildConfig.panels.length === 0) {
        return interaction.reply({
          content: "No custom panels configured for this server. Use `/setup create_panel` to create one.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Server Panels")
        .setDescription("Custom ticket panels for this server:")
        .setTimestamp();

      for (const panel of guildConfig.panels) {
        const buttonList = panel.buttons.length > 0
          ? panel.buttons.map(b => `- ${b.label} (\`${b.id}\`)`).join("\n")
          : "No buttons";
        
        embed.addFields({
          name: `Panel ${panel.id}: ${panel.name}`,
          value: `**Description:** ${panel.description}\n**Buttons:**\n${buttonList}`,
        });
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "delete_panel") {
      const panelId = interaction.options.getInteger("panel_id");

      const guildConfig = await getGuildConfig(guildId);
      const panel = guildConfig.panels.find(p => p.id === panelId);

      if (!panel) {
        return interaction.reply({
          content: `Panel with ID ${panelId} not found.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await removeGuildPanel(guildId, panelId);

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("Panel Deleted")
        .setDescription(`Panel **${panel.name}** (ID: ${panelId}) has been deleted.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "view") {
      const openCategoryID = await mainDB.get(`guildSettings.${guildId}.openCategoryID`);
      const closedCategoryID = await mainDB.get(`guildSettings.${guildId}.closedCategoryID`);
      const transcriptChannelID = await mainDB.get(`guildSettings.${guildId}.transcriptChannelID`);
      const adminRoleIDs = await mainDB.get(`guildSettings.${guildId}.adminRoleIDs`);
      const supportRoleIDs = await mainDB.get(`guildSettings.${guildId}.supportRoleIDs`);
      const guildConfig = await getGuildConfig(guildId);

      const embed = new EmbedBuilder()
        .setColor("#2FF200")
        .setTitle("Server Configuration")
        .setDescription("Current ticket settings for this server:")
        .addFields(
          { 
            name: "Open Tickets Category", 
            value: openCategoryID ? `<#${openCategoryID}> (\`${openCategoryID}\`)` : "Not configured (using global config)", 
            inline: true 
          },
          { 
            name: "Closed Tickets Category", 
            value: closedCategoryID ? `<#${closedCategoryID}> (\`${closedCategoryID}\`)` : "Not configured (using global config)", 
            inline: true 
          },
          { 
            name: "Transcript Logs Channel", 
            value: transcriptChannelID ? `<#${transcriptChannelID}> (\`${transcriptChannelID}\`)` : "Not configured (using global config)" 
          },
          { 
            name: "🔐 Admin Roles (Can Execute Commands)", 
            value: adminRoleIDs && adminRoleIDs.length > 0 ? adminRoleIDs.map((id) => `<@&${id}>`).join(", ") : "None configured - only Administrator can use admin commands" 
          },
          { 
            name: "🔔 Support Roles (Pinged on Tickets)", 
            value: supportRoleIDs && supportRoleIDs.length > 0 ? supportRoleIDs.map((id) => `<@&${id}>`).join(", ") : "Not configured (using global config)" 
          },
          {
            name: "Auto-Close",
            value: `Enabled: ${guildConfig.autoClose.enabled ? "Yes" : "No"}\nTime: ${guildConfig.autoClose.time} seconds`,
            inline: true
          },
          {
            name: "Custom Panels",
            value: `${guildConfig.panels.length} panel(s) configured`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "reset") {
      await mainDB.delete(`guildSettings.${guildId}`);
      await guildDB.delete(guildId);

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("Configuration Reset")
        .setDescription("Server configuration has been reset. The bot will now use global default settings.")
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
