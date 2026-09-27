const fs = require("node:fs");
const path = require("node:path");

const runtimePath = path.join(process.cwd(), "data", "runtime.json");

const state = {
  guilds: new Map(),
  violations: new Map()
};

function load() {
  try {
    if (!fs.existsSync(runtimePath)) return;
    const data = JSON.parse(fs.readFileSync(runtimePath, "utf8"));

    for (const [guildId, guild] of Object.entries(data.guilds || {})) {
      state.guilds.set(guildId, guild);
    }

    for (const [key, count] of Object.entries(data.violations || {})) {
      state.violations.set(key, count);
    }
  } catch {
    console.warn("⚠️ Could not load runtime.json");
  }
}

function save() {
  const data = {
    guilds: Object.fromEntries(state.guilds),
    violations: Object.fromEntries(state.violations)
  };

  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, JSON.stringify(data, null, 2));
}

function getGuild(guildId) {
  if (!state.guilds.has(guildId)) {
    state.guilds.set(guildId, {
      enabled: true,
      deleteMessages: true,
      warningLimit: 3,
      timeoutMinutes: 10,
      logsChannelId: null,
      customWords: []
    });
  }

  return state.guilds.get(guildId);
}

function addViolation(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const next = (state.violations.get(key) || 0) + 1;
  state.violations.set(key, next);
  save();
  return next;
}

function resetViolations(guildId, userId) {
  state.violations.delete(`${guildId}:${userId}`);
  save();
}

module.exports = {
  state,
  load,
  save,
  getGuild,
  addViolation,
  resetViolations
};
