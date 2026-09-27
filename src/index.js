require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
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

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN environment variable.");
}

const defaultData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "default.json"), "utf8")
);

store.load();

const commands = [
  new SlashCommandBuilder()
    .setName("badword")
    .setDescription("Manage Guardia's custom bad-word list")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Add a custom word")
        .addStringOption(o =>
          o.setName("word").setDescription("Word to add").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a custom word")
        .addStringOption(o =>
          o.setName("word").setDescription("Word to remove").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("Show custom words")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("guardia")
    .setDescription("Configure Guardia")
    .addSubcommand(sub =>
      sub.setName("setup")
        .setDescription("Create the private Guardia logs channel")
    )
    .addSubcommand(sub =>
      sub.setName("status")
        .setDescription("Show Guardia status")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commands
  });
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
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
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
  store.save();
  return channel;
}

client.once("ready", async () => {
  console.log(`🛡️ Guardia is online as ${client.user.tag}`);

  if (!process.env.CLIENT_ID) {
    console.warn("⚠️ CLIENT_ID is missing; slash commands were not registered.");
    return;
  }

  try {
    await registerCommands();
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Slash command registration failed:", error);
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

  if (interaction.commandName === "badword") {
    const sub = interaction.options.getSubcommand();
    const word = interaction.options.getString("word")?.trim().toLowerCase();

    if (sub === "add") {
      if (!word || word.length < 2 || word.length > 100) {
        return interaction.reply({
          content: "❌ Invalid word.",
          ephemeral: true
        });
      }

      if (!config.customWords.includes(word)) {
        config.customWords.push(word);
        store.save();
      }

      return interaction.reply({
        content: `✅ Added \`${word}\` to this server's custom list.`,
        ephemeral: true
      });
    }

    if (sub === "remove") {
      config.customWords = config.customWords.filter(w => w !== word);
      store.save();

      return interaction.reply({
        content: `✅ Removed \`${word}\` from this server's custom list.`,
        ephemeral: true
      });
    }

    if (sub === "list") {
      const words = config.customWords.length
        ? config.customWords.map(w => `• \`${w}\``).join("\\n")
        : "No custom words have been added.";

      return interaction.reply({
        content: `**Custom bad words**\\n${words}`,
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === "guardia") {
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      try {
        const channel = await setupLogsChannel(interaction.guild);

        return interaction.reply({
          content: `✅ Guardia logs are ready: <#${channel.id}>\\nOnly Administrators can access the channel.`,
          ephemeral: true
        });
      } catch (error) {
        console.error(error);
        return interaction.reply({
          content: "❌ I couldn't create the logs channel. Check my permissions.",
          ephemeral: true
        });
      }
    }

    if (sub === "status") {
      return interaction.reply({
        content: [
          `🛡️ **Guardia:** ${config.enabled ? "ON" : "OFF"}`,
          `🗑️ Auto-delete: ${config.deleteMessages ? "ON" : "OFF"}`,
          `⚠️ Warning limit: ${config.warningLimit}`,
          `🔇 Timeout: ${config.timeoutMinutes} minutes`,
          `📋 Logs: ${config.logsChannelId ? `<#${config.logsChannelId}>` : "Not configured"}`,
          `🧩 Custom words: ${config.customWords.length}`
        ].join("\\n"),
        ephemeral: true
      });
    }
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot || !message.content) return;

  const config = store.getGuild(message.guild.id);
  if (!config.enabled) return;

  const badWords = [
    ...(defaultData.english || []),
    ...(defaultData.persian || []),
    ...(defaultData.slang || []),
    ...(defaultData.custom || []),
    ...config.customWords
  ];

  const matched = findBadWord(message.content, badWords);
  if (!matched) return;

  const violation = store.addViolation(message.guild.id, message.author.id);

  if (config.deleteMessages && message.deletable) {
    await message.delete().catch(() => {});
  }

  let action = "Message deleted";

  if (violation >= config.warningLimit && message.member?.moderatable) {
    const duration = config.timeoutMinutes * 60 * 1000;
    await message.member.timeout(
      duration,
      "Guardia anti-bad-word moderation"
    ).catch(() => {});

    action = `Message deleted + timeout (${config.timeoutMinutes}m)`;
  }

  const embed = new EmbedBuilder()
    .setTitle("🛡️ Guardia Moderation")
    .setDescription("A message was detected by the anti-bad-word filter.")
    .addFields(
      { name: "User", value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
      { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      { name: "Violation", value: String(violation), inline: true },
      { name: "Action", value: action, inline: false }
    )
    .setTimestamp();

  await sendLog(message.guild, embed);
});

client.login(process.env.DISCORD_TOKEN);
