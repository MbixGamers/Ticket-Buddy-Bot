const { guildDB } = require("../init.js");

const defaultGuildConfig = {
  autoClose: {
    enabled: true,
    time: 86400,
  },
  autoDelete: {
    enabled: false,
    time: 86400,
  },
  maxOpenTickets: 1,
  claim1on1: true,
  panels: [],
  categories: [],
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function getGuildConfig(guildId) {
  const config = await guildDB.get(guildId);
  const clonedDefaults = deepClone(defaultGuildConfig);
  if (!config) {
    return clonedDefaults;
  }
  const clonedConfig = deepClone(config);
  // Merge arrays explicitly or preserve custom panels
  return { 
    ...clonedDefaults, 
    ...clonedConfig,
    panels: clonedConfig.panels || clonedDefaults.panels,
    categories: clonedConfig.categories || clonedDefaults.categories
  };
}

async function setGuildConfig(guildId, config) {
  await guildDB.set(guildId, config);
}

async function updateGuildConfig(guildId, key, value) {
  await guildDB.set(`${guildId}.${key}`, value);
}

async function getGuildPanel(guildId, panelId) {
  const config = await getGuildConfig(guildId);
  return config.panels.find((p) => p.id === panelId);
}

async function addGuildPanel(guildId, panel) {
  const config = await getGuildConfig(guildId);
  const existingIndex = config.panels.findIndex((p) => p.id === panel.id);
  if (existingIndex >= 0) {
    config.panels[existingIndex] = panel;
  } else {
    config.panels.push(panel);
  }
  await setGuildConfig(guildId, config);
}

async function removeGuildPanel(guildId, panelId) {
  const config = await getGuildConfig(guildId);
  config.panels = config.panels.filter((p) => p.id !== panelId);
  await setGuildConfig(guildId, config);
}

async function getGuildCategory(guildId, categoryId) {
  const config = await getGuildConfig(guildId);
  return config.categories.find((c) => c.id === categoryId);
}

async function addGuildCategory(guildId, category) {
  const config = await getGuildConfig(guildId);
  const existingIndex = config.categories.findIndex((c) => c.id === category.id);
  if (existingIndex >= 0) {
    config.categories[existingIndex] = category;
  } else {
    config.categories.push(category);
  }
  await setGuildConfig(guildId, config);
}

async function removeGuildCategory(guildId, categoryId) {
  const config = await getGuildConfig(guildId);
  config.categories = config.categories.filter((c) => c.id !== categoryId);
  await setGuildConfig(guildId, config);
}

module.exports = {
  defaultGuildConfig,
  getGuildConfig,
  setGuildConfig,
  updateGuildConfig,
  getGuildPanel,
  addGuildPanel,
  removeGuildPanel,
  getGuildCategory,
  addGuildCategory,
  removeGuildCategory,
};
