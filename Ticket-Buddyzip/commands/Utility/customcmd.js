const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
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
        content: "You don't have permission to manage custom commands.",
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
          content: `A custom command with the name \`${name}\` already exists.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const pendingData = { name, description, type, access, guildId };

      if (type === "message") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_message_${name}`)
          .setTitle(`Create /${name} Command`);

        const responseInput = new TextInputBuilder()
          .setCustomId("response_message")
          .setLabel("Response Message")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const embedTitleInput = new TextInputBuilder()
          .setCustomId("embed_title")
          .setLabel("Embed Title (optional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const embedColorInput = new TextInputBuilder()
          .setCustomId("embed_color")
          .setLabel("Embed Color (e.g. #5865F2)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(responseInput),
          new ActionRowBuilder().addComponents(embedTitleInput),
          new ActionRowBuilder().addComponents(embedColorInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, pendingData);
        await interaction.showModal(modal);

      } else if (type === "button") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_button_${name}`)
          .setTitle(`Create /${name} Command`);

        // Defining the 5 allowed components
        const messageInput = new TextInputBuilder().setCustomId("message_content").setLabel("Message with Button").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const buttonLabelInput = new TextInputBuilder().setCustomId("button_label").setLabel("Button Label").setStyle(TextInputStyle.Short).setRequired(true);
        const triggerInput = new TextInputBuilder().setCustomId("trigger_command").setLabel("Trigger Command (optional)").setStyle(TextInputStyle.Short).setRequired(false);
        const rolesInput = new TextInputBuilder().setCustomId("auto_roles").setLabel("Auto Roles (IDs, comma separated)").setStyle(TextInputStyle.Short).setRequired(false);
        const followUpInput = new TextInputBuilder().setCustomId("followup_message").setLabel("Click Response Message").setStyle(TextInputStyle.Paragraph).setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(messageInput),
          new ActionRowBuilder().addComponents(buttonLabelInput),
          new ActionRowBuilder().addComponents(triggerInput),
          new ActionRowBuilder().addComponents(rolesInput),
          new ActionRowBuilder().addComponents(followUpInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, pendingData);
        await interaction.showModal(modal);

      } else if (type === "questionnaire") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_questionnaire_${name}`)
          .setTitle(`Create /${name} Command`);

        const introInput = new TextInputBuilder().setCustomId("intro_message").setLabel("Intro Message").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const questionsInput = new TextInputBuilder().setCustomId("questions").setLabel("Questions (one per line)").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const targetChannelInput = new TextInputBuilder().setCustomId("target_channel").setLabel("Logging Channel ID").setStyle(TextInputStyle.Short).setRequired(false);
        const rolesInput = new TextInputBuilder().setCustomId("auto_roles").setLabel("Auto Roles (IDs)").setStyle(TextInputStyle.Short).setRequired(false);
        const approvalInput = new TextInputBuilder().setCustomId("approval_required").setLabel("Approval Required? (Yes/No)").setStyle(TextInputStyle.Short).setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(introInput),
          new ActionRowBuilder().addComponents(questionsInput),
          new ActionRowBuilder().addComponents(targetChannelInput),
          new ActionRowBuilder().addComponents(rolesInput),
          new ActionRowBuilder().addComponents(approvalInput)
        );

        await mainDB.set(`customCmdPending.${interaction.user.id}`, pendingData);
        await interaction.showModal(modal);
      }

    } else if (subcommand === "delete") {
      const name = interaction.options.getString("name").toLowerCase();
      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};

      if (!existingCommands[name]) {
        return interaction.reply({ content: `No command named \`${name}\` found.`, flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      delete existingCommands[name];
      await mainDB.set(`customCommands.${guildId}`, existingCommands);
      await unregisterCustomCommand(guildId, name);
      await logMessage(`${interaction.user.tag} deleted /${name}`);

      return interaction.editReply({ content: `Command \`/${name}\` deleted.` });

    } else if (subcommand === "list") {
      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
      const commandNames = Object.keys(existingCommands);

      if (commandNames.length === 0) {
        return interaction.reply({ content: "No custom commands found.", flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setTitle("Custom Commands")
        .setColor("#5865F2")
        .setDescription(commandNames.map(n => `\`/${n}\` (${existingCommands[n].type})`).join("\n"));

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } else if (subcommand === "edit") {
      const name = interaction.options.getString("name").toLowerCase();
      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
      const cmd = existingCommands[name];

      if (!cmd) {
        return interaction.reply({ content: "Command not found.", flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder().setCustomId(`customcmd_edit_${cmd.type}_${name}`).setTitle(`Edit /${name}`);

      // Standardize the "Edit" logic to match the "Create" logic structure
      if (cmd.type === "message") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("response_message").setLabel("Response").setStyle(TextInputStyle.Paragraph).setValue(cmd.responseMessage || "").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("embed_title").setLabel("Title").setStyle(TextInputStyle.Short).setValue(cmd.embedTitle || "").setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("embed_color").setLabel("Color").setStyle(TextInputStyle.Short).setValue(cmd.embedColor || "").setRequired(false))
        );
      } else if (cmd.type === "button") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("message_content").setLabel("Message").setStyle(TextInputStyle.Paragraph).setValue(cmd.messageContent || "").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("button_label").setLabel("Label").setStyle(TextInputStyle.Short).setValue(cmd.buttonLabel || "").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("followup_message").setLabel("Response").setStyle(TextInputStyle.Paragraph).setValue(cmd.followUpMessage || "").setRequired(true))
        );
      } else if (cmd.type === "questionnaire") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("intro_message").setLabel("Intro").setStyle(TextInputStyle.Paragraph).setValue(cmd.introMessage || "").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("questions").setLabel("Questions").setStyle(TextInputStyle.Paragraph).setValue(cmd.questions?.join("\n") || "").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("target_channel").setLabel("Channel ID").setStyle(TextInputStyle.Short).setValue(cmd.targetChannel || "").setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("result_title").setLabel("Result Title").setStyle(TextInputStyle.Short).setValue(cmd.resultTitle || "").setRequired(false))
        );
      }

      await mainDB.set(`customCmdPending.${interaction.user.id}`, { ...cmd, name, guildId, isEdit: true });
      await interaction.showModal(modal);
    }
  },
};
