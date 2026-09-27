const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  realtime: { enabled: false }
});

const defaultData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "default.json"), "utf8")
);

const state = { guilds: new Map(), violations: new Map(), defaultWords: [] };

function guildDefaults() {
  return { enabled: true, deleteMessages: true, warningLimit: 3, timeoutMinutes: 10, logsChannelId: null, customWords: [] };
}

async function seedDefaultWords() {
  const words = [...(defaultData.english || []), ...(defaultData.persian || []), ...(defaultData.slang || [])]
    .filter(word => typeof word === "string" && word.trim().length >= 2);
  if (!words.length) return;
  const rows = words.map(word => ({ guild_id: null, word: word.trim().toLowerCase(), category: "default", enabled: true }));
  const { error } = await supabase.from("guardia_words").upsert(rows, { onConflict: "guild_id,word" });
  if (error) throw error;
}

async function load() {
  await seedDefaultWords();
  const [{ data: guilds, error: guildError }, { data: words, error: wordError }, { data: violations, error: violationError }] =
    await Promise.all([
      supabase.from("guardia_guilds").select("*"),
      supabase.from("guardia_words").select("word,category,guild_id").eq("enabled", true),
      supabase.from("guardia_violations").select("guild_id,user_id,count")
    ]);
  if (guildError) throw guildError;
  if (wordError) throw wordError;
  if (violationError) throw violationError;

  state.guilds.clear();
  state.violations.clear();
  state.defaultWords = [];

  for (const row of guilds || []) {
    state.guilds.set(row.guild_id, {
      enabled: row.enabled,
      deleteMessages: row.delete_messages,
      warningLimit: row.warning_limit,
      timeoutMinutes: row.timeout_minutes,
      logsChannelId: row.logs_channel_id,
      customWords: []
    });
  }
  for (const row of words || []) {
    if (row.guild_id === null) state.defaultWords.push(row.word);
    else getGuild(row.guild_id).customWords.push(row.word);
  }
  for (const row of violations || []) state.violations.set(`${row.guild_id}:${row.user_id}`, row.count);
}

function getGuild(guildId) {
  if (!state.guilds.has(guildId)) state.guilds.set(guildId, guildDefaults());
  return state.guilds.get(guildId);
}

async function saveGuild(guildId) {
  const config = getGuild(guildId);
  const { error } = await supabase.from("guardia_guilds").upsert({
    guild_id: guildId, enabled: config.enabled, delete_messages: config.deleteMessages,
    warning_limit: config.warningLimit, timeout_minutes: config.timeoutMinutes,
    logs_channel_id: config.logsChannelId, updated_at: new Date().toISOString()
  }, { onConflict: "guild_id" });
  if (error) throw error;
}

async function addCustomWord(guildId, word) {
  const config = getGuild(guildId);
  const normalized = word.trim().toLowerCase();
  if (!config.customWords.includes(normalized)) config.customWords.push(normalized);
  const { error } = await supabase.from("guardia_words").upsert({
    guild_id: guildId, word: normalized, category: "custom", enabled: true
  }, { onConflict: "guild_id,word" });
  if (error) throw error;
}

async function removeCustomWord(guildId, word) {
  const normalized = word.trim().toLowerCase();
  const { error } = await supabase.from("guardia_words").delete().eq("guild_id", guildId).eq("word", normalized);
  if (error) throw error;
  const config = getGuild(guildId);
  config.customWords = config.customWords.filter(w => w !== normalized);
}

function getAllWords(guildId) {
  return [...state.defaultWords, ...getGuild(guildId).customWords];
}

async function addViolation(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const next = (state.violations.get(key) || 0) + 1;
  state.violations.set(key, next);
  const { error } = await supabase.from("guardia_violations").upsert({
    guild_id: guildId, user_id: userId, count: next, updated_at: new Date().toISOString()
  }, { onConflict: "guild_id,user_id" });
  if (error) throw error;
  return next;
}

async function resetViolations(guildId, userId) {
  state.violations.delete(`${guildId}:${userId}`);
  const { error } = await supabase.from("guardia_violations").delete().eq("guild_id", guildId).eq("user_id", userId);
  if (error) throw error;
}

module.exports = { state, supabase, load, getGuild, saveGuild, addCustomWord, removeCustomWord, getAllWords, addViolation, resetViolations };
