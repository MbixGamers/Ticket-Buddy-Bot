const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { mainDB } = require("../../init.js");
const { checkAdminRole, logMessage } = require("../../utils/mainUtils.js");
const { unregisterCustomCommand } = require("../../utils/customCommandRegistry.js");

module.exports = {
  enabled: true,
  data: new SlashCommandBuilder()
    .setName("customcmd")
    .setDescription("Create and manage custom slash commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new custom command")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the custom command (without /)")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(32)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description of the command")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of behavior for this command")
            .setRequired(true)
            .addChoices(
              { name: "Message Response", value: "message" },
              { name: "Button Action", value: "button" },
              { name: "Questionnaire", value: "questionnaire" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("access")
            .setDescription("Who can use this command in the ticket?")
            .setRequired(true)
            .addChoices(
              { name: "Everyone (User + Staff)", value: "everyone" },
              { name: "Staff Only", value: "staff" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a custom command")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the custom command to delete")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all custom commands in this server")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit an existing custom command")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the custom command to edit")
            .setRequired(true)
        )
    )
    .setDMPermission(false),

  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAdminRole = await checkAdminRole(interaction);

    if (!isAdmin && !hasAdminRole) {
      return interaction.reply({
        content: "You don't have permission to manage custom commands. Administrator permission or an admin role is required.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === "create") {
      const name = interaction.options.getString("name").toLowerCase().replace(/\s+/g, "-");
      const description = interaction.options.getString("description");
      const type = interaction.options.getString("type");
      const access = interaction.options.getString("access");

      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
      if (existingCommands[name]) {
        return interaction.reply({
          content: `A custom command with the name \`${name}\` already exists. Use \`/customcmd edit\` to modify it or \`/customcmd delete\` to remove it first.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (type === "message") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_message_${name}`)
          .setTitle(`Create /${name} Command`);

        const responseInput = new TextInputBuilder()
          .setCustomId("response_message")
          .setLabel("Response Message")
          .setPlaceholder("Enter the message the bot will send when this command is used...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000);

        const embedTitleInput = new TextInputBuilder()
          .setCustomId("embed_title")
          .setLabel("Embed Title (optional, leave blank for text)")
          .setPlaceholder("Title for an embed response")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256);

        const embedColorInput = new TextInputBuilder()
          .setCustomId("embed_color")
          .setLabel("Embed Color (optional, e.g. #FF5733)")
          .setPlaceholder("#5865F2")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7);

        modal.addComponents(
          new ActionRowBuilder().addComponents(responseInput),
          new ActionRowBuilder().addComponents(embedTitleInput),
          new ActionRowBuilder().addComponents(embedColorInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, {
          name,
          description,
          type,
          access,
          guildId,
        });

        await interaction.showModal(modal);

      } else if (type === "button") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_button_${name}`)
          .setTitle(`Create /${name} Command`);

        const messageInput = new TextInputBuilder()
          .setCustomId("message_content")
          .setLabel("Message to show with the button")
          .setPlaceholder("Enter the message that appears with the button...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000);

        const buttonLabelInput = new TextInputBuilder()
          .setCustomId("button_label")
          .setLabel("Button Label")
          .setPlaceholder("e.g. Complete, Send, Confirm")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80);

        const buttonStyleInput = new TextInputBuilder()
          .setCustomId("button_style")
          .setLabel("Style: Primary/Secondary/Success/Danger")
          .setPlaceholder("Success")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20);

        const triggerInput = new TextInputBuilder()
          .setCustomId("trigger_command")
          .setLabel("Trigger Command Name (optional)")
          .setPlaceholder("Command name to trigger (must be questionnaire)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(32);

        const rolesInput = new TextInputBuilder()
          .setCustomId("auto_roles")
          .setLabel("Auto Roles (IDs, comma separated)")
          .setPlaceholder("RoleID1, RoleID2")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(200);

        const followUpInput = new TextInputBuilder()
          .setCustomId("followup_message")
          .setLabel("Message when button is clicked")
          .setPlaceholder("Thank you for completing the process!")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(messageInput),
          new ActionRowBuilder().addComponents(buttonLabelInput),
          new ActionRowBuilder().addComponents(buttonStyleInput),
          new ActionRowBuilder().addComponents(triggerInput),
          new ActionRowBuilder().addComponents(followUpInput)
          // Note: Modal rows limited to 5 components. Roles will be handled in another way or we can swap components.
          // Let's swap followUp for roles if trigger is used, but for now let's just use 5.
        );

        // Update: Discord modals only allow 5 components. Let's optimize.
        modal.setComponents([]);
        modal.addComponents(
          new ActionRowBuilder().addComponents(messageInput),
          new ActionRowBuilder().addComponents(buttonLabelInput),
          new ActionRowBuilder().addComponents(triggerInput),
          new ActionRowBuilder().addComponents(rolesInput),
          new ActionRowBuilder().addComponents(followUpInput)
        );
        // Note: button_style removed from modal to fit trigger/roles. Defaulting to Success.


        await mainDB.set(`customCmdPending.${interaction.user.id}`, {
          name,
          description,
          type,
          access,
          guildId,
        });

        await interaction.showModal(modal);

      } else if (type === "questionnaire") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_questionnaire_${name}`)
          .setTitle(`Create /${name} Command`);

        const introInput = new TextInputBuilder()
          .setCustomId("intro_message")
          .setLabel("Introduction Message")
          .setPlaceholder("Message shown before the questionnaire starts...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const questionsInput = new TextInputBuilder()
          .setCustomId("questions")
          .setLabel("Questions (one per line, max 5)")
          .setPlaceholder("What is your name?\nWhat do you need help with?\nAny additional details?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const targetChannelInput = new TextInputBuilder()
          .setCustomId("target_channel")
          .setLabel("Channel ID to send answers (optional)")
          .setPlaceholder("Leave blank to reply in the same channel")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20);

        const embedTitleInput = new TextInputBuilder()
          .setCustomId("result_title")
          .setLabel("Result Embed Title")
          .setPlaceholder("Questionnaire Response")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256);

        modal.addComponents(
          new ActionRowBuilder().addComponents(introInput),
          new ActionRowBuilder().addComponents(questionsInput),
          new ActionRowBuilder().addComponents(targetChannelInput),
          new ActionRowBuilder().addComponents(embedTitleInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, {
          name,
          description,
          type,
          access,
          guildId,
        });

        await interaction.showModal(modal);
      }

    } else if (subcommand === "delete") {
      const name = interaction.options.getString("name").toLowerCase();
      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};

      if (!existingCommands[name]) {
        return interaction.reply({
          content: `No custom command named \`${name}\` was found.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      delete existingCommands[name];
      await mainDB.set(`customCommands.${guildId}`, existingCommands);

      await unregisterCustomCommand(guildId, name);

      await logMessage(`${interaction.user.tag} deleted custom command /${name} in guild ${interaction.guild.name}`);

      return interaction.editReply({
        content: `Custom command \`/${name}\` has been deleted successfully and unregistered from Discord.`,
      });

    } else if (subcommand === "list") {
      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
      const commandNames = Object.keys(existingCommands);

      if (commandNames.length === 0) {
        return interaction.reply({
          content: "No custom commands have been created in this server yet. Use `/customcmd create` to create one.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Custom Commands")
        .setColor("#5865F2")
        .setDescription("Here are all the custom commands in this server:")
        .setTimestamp();

      const commandList = commandNames.map((name) => {
        const cmd = existingCommands[name];
        const typeEmoji = cmd.type === "message" ? "💬" : cmd.type === "button" ? "🔘" : "📝";
        return `${typeEmoji} \`/${name}\` - ${cmd.description} (${cmd.type})`;
      }).join("\n");

      embed.addFields({ name: "Commands", value: commandList });
      embed.setFooter({ text: `Total: ${commandNames.length} custom command(s)` });

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });

    } else if (subcommand === "edit") {
      const name = interaction.options.getString("name").toLowerCase();
      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};

      if (!existingCommands[name]) {
        return interaction.reply({
          content: `No custom command named \`${name}\` was found.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const cmd = existingCommands[name];

      if (cmd.type === "message") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_edit_message_${name}`)
          .setTitle(`Edit /${name} Command`);

        const responseInput = new TextInputBuilder()
          .setCustomId("response_message")
          .setLabel("Response Message")
          .setPlaceholder("Enter the message the bot will send...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000)
          .setValue(cmd.responseMessage || "");

        const embedTitleInput = new TextInputBuilder()
          .setCustomId("embed_title")
          .setLabel("Embed Title (optional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256)
          .setValue(cmd.embedTitle || "");

        const embedColorInput = new TextInputBuilder()
          .setCustomId("embed_color")
          .setLabel("Embed Color (optional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setValue(cmd.embedColor || "");

        modal.addComponents(
          new ActionRowBuilder().addComponents(responseInput),
          new ActionRowBuilder().addComponents(embedTitleInput),
          new ActionRowBuilder().addComponents(embedColorInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, {
          name,
          description: cmd.description,
          type: cmd.type,
          guildId,
          isEdit: true,
        });

        await interaction.showModal(modal);

      } else if (cmd.type === "button") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_edit_button_${name}`)
          .setTitle(`Edit /${name} Command`);

        const messageInput = new TextInputBuilder()
          .setCustomId("message_content")
          .setLabel("Message to show with the button")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000)
          .setValue(cmd.messageContent || "");

        const buttonLabelInput = new TextInputBuilder()
          .setCustomId("button_label")
          .setLabel("Button Label")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
          .setValue(cmd.buttonLabel || "");

        const buttonStyleInput = new TextInputBuilder()
          .setCustomId("button_style")
          .setLabel("Button Style")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20)
          .setValue(cmd.buttonStyle || "Success");

        const followUpInput = new TextInputBuilder()
          .setCustomId("followup_message")
          .setLabel("Message when button is clicked")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000)
          .setValue(cmd.followUpMessage || "");

        modal.addComponents(
          new ActionRowBuilder().addComponents(messageInput),
          new ActionRowBuilder().addComponents(buttonLabelInput),
          new ActionRowBuilder().addComponents(buttonStyleInput),
          new ActionRowBuilder().addComponents(followUpInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, {
          name,
          description: cmd.description,
          type: cmd.type,
          guildId,
          isEdit: true,
        });

        await interaction.showModal(modal);

      } else if (cmd.type === "questionnaire") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_edit_questionnaire_${name}`)
          .setTitle(`Edit /${name} Command`);

        const introInput = new TextInputBuilder()
          .setCustomId("intro_message")
          .setLabel("Introduction Message")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(cmd.introMessage || "");

        const questionsInput = new TextInputBuilder()
          .setCustomId("questions")
          .setLabel("Questions (one per line, max 5)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(cmd.questions ? cmd.questions.join("\n") : "");

        const targetChannelInput = new TextInputBuilder()
          .setCustomId("target_channel")
          .setLabel("Channel ID to send answers (optional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20)
          .setValue(cmd.targetChannel || "");

        const embedTitleInput = new TextInputBuilder()
          .setCustomId("result_title")
          .setLabel("Result Embed Title")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256)
          .setValue(cmd.resultTitle || "");

        modal.addComponents(
          new ActionRowBuilder().addComponents(introInput),
          new ActionRowBuilder().addComponents(questionsInput),
          new ActionRowBuilder().addComponents(targetChannelInput),
          new ActionRowBuilder().addComponents(embedTitleInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, {
          name,
          description: cmd.description,
          type: cmd.type,
          guildId,
          isEdit: true,
        });

        await interaction.showModal(modal);
      }
    }
  },
};
