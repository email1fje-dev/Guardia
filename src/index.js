require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { findBadWord } = require("./detector");
const store = require("./store");

if (!process.env.DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN.");
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID.");

const commands = [
  new SlashCommandBuilder()
    .setName("badword")
    .setDescription("Manage Guardia custom bad words")
    .addSubcommand(s => s.setName("add").setDescription("Add a custom word")
      .addStringOption(o => o.setName("word").setDescription("Word").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a custom word")
      .addStringOption(o => o.setName("word").setDescription("Word").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List custom words"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("guardia")
    .setDescription("Configure Guardia")
    .addSubcommand(s => s.setName("setup").setDescription("Create the private logs channel"))
    .addSubcommand(s => s.setName("status").setDescription("Show Guardia status"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
}

async function sendLog(guild, embed) {
  const config = store.getGuild(guild.id);
  if (!config.logsChannelId) return;

  const channel = guild.channels.cache.get(config.logsChannelId);
  if (!channel?.isTextBased()) return;

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function setupLogsChannel(guild) {
  const config = store.getGuild(guild.id);

  let channel = guild.channels.cache.find(
    c => c.name === "guardia-logs" && c.type === ChannelType.GuildText
  );

  if (!channel) {
    channel = await guild.channels.create({
      name: "guardia-logs",
      type: ChannelType.GuildText,
      topic: "Private Guardia moderation logs — administrators only.",
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });
  }

  config.logsChannelId = channel.id;
  await store.saveGuild(guild.id);
  return channel;
}

client.once("ready", async () => {
  try {
    await store.load();
    await registerCommands();
    console.log(`🛡️ Guardia online as ${client.user.tag}`);
    console.log(`📚 Loaded ${store.state.defaultWords.length} default moderation words.`);
  } catch (error) {
    console.error("❌ Startup failed:", error);
    process.exit(1);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ Administrator permission is required.",
      ephemeral: true
    });
  }

  const config = store.getGuild(interaction.guild.id);

  try {
    if (interaction.commandName === "badword") {
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const word = interaction.options.getString("word")?.trim().toLowerCase();
        if (!word || word.length < 2 || word.length > 100) {
          return interaction.reply({ content: "❌ Invalid word.", ephemeral: true });
        }

        await store.addCustomWord(interaction.guild.id, word);
        return interaction.reply({
          content: `✅ Added \`${word}\` to this server's custom list.`,
          ephemeral: true
        });
      }

      if (sub === "remove") {
        const word = interaction.options.getString("word")?.trim().toLowerCase();
        await store.removeCustomWord(interaction.guild.id, word);
        return interaction.reply({
          content: `✅ Removed \`${word}\` from this server's custom list.`,
          ephemeral: true
        });
      }

      if (sub === "list") {
        const words = config.customWords.length
          ? config.customWords.map(w => `• \`${w}\``).join("\n")
          : "No custom words have been added.";

        return interaction.reply({
          content: `**Custom bad words**\n${words}`,
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "guardia") {
      const sub = interaction.options.getSubcommand();

      if (sub === "setup") {
        const channel = await setupLogsChannel(interaction.guild);
        return interaction.reply({
          content: `✅ Guardia logs are ready: <#${channel.id}>\nOnly Administrators can access the channel.`,
          ephemeral: true
        });
      }

      if (sub === "status") {
        return interaction.reply({
          content: [
            `🛡️ **Guardia:** ${config.enabled ? "ON" : "OFF"}`,
            `🗑️ Auto-delete: ${config.deleteMessages ? "ON" : "OFF"}`,
            `⚠️ Warning limit: ${config.warningLimit}`,
            `🔇 Timeout: ${config.timeoutMinutes} minutes`,
            `📋 Logs: ${config.logsChannelId ? `<#${config.logsChannelId}>` : "Not configured"}`,
            `🧩 Custom words: ${config.customWords.length}`,
            `📚 Default words: ${store.state.defaultWords.length}`
          ].join("\n"),
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);
    const payload = { content: "❌ Something went wrong while updating Guardia.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
    else await interaction.reply(payload);
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot || !message.content) return;

  const config = store.getGuild(message.guild.id);
  if (!config.enabled) return;

  const matched = findBadWord(message.content, store.getAllWords(message.guild.id));
  if (!matched) return;

  try {
    const violation = await store.addViolation(message.guild.id, message.author.id);

    if (config.deleteMessages && message.deletable) {
      await message.delete().catch(() => {});
    }

    let action = "Message deleted";

    if (violation >= config.warningLimit && message.member?.moderatable) {
      const duration = config.timeoutMinutes * 60 * 1000;
      if (duration > 0) {
        await message.member.timeout(duration, "Guardia anti-bad-word moderation").catch(() => {});
        action = `Message deleted + timeout (${config.timeoutMinutes}m)`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🛡️ Guardia Moderation")
      .setDescription("A message was detected by the anti-bad-word filter.")
      .addFields(
        { name: "User", value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
        { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
        { name: "Violation", value: String(violation), inline: true },
        { name: "Matched category", value: "Moderation word", inline: true },
        { name: "Action", value: action, inline: false }
      )
      .setTimestamp();

    await sendLog(message.guild, embed);
  } catch (error) {
    console.error("Moderation error:", error);
  }
});

process.on("unhandledRejection", error => console.error("Unhandled rejection:", error));
process.on("uncaughtException", error => console.error("Uncaught exception:", error));

client.login(process.env.DISCORD_TOKEN);
