const fs = require('fs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlockModule = require('mineflayer-collectblock');
const pvpModule = require('mineflayer-pvp');
const autoEatModule = require('mineflayer-auto-eat');
const { mineflayer: viewer } = require('prismarine-viewer');

const { GoalNear } = goals;

const defaultConfig = {
  host: 'localhost',
  port: 25565,
  username: 'UniversalBot',
  auth: 'offline',
  viewDistance: 10,
  enableViewer: false,
  viewerPort: 3007
};

const configPath = `${process.cwd()}/config.json`;
let config = { ...defaultConfig };
if (fs.existsSync(configPath)) {
  const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config = { ...config, ...loaded };
}

function resolvePlugin(moduleRef) {
  if (typeof moduleRef === 'function') return moduleRef;
  if (moduleRef && typeof moduleRef.plugin === 'function') return moduleRef.plugin;
  if (moduleRef && typeof moduleRef.default === 'function') return moduleRef.default;
  return null;
}

const collectBlock = resolvePlugin(collectBlockModule);
const pvp = resolvePlugin(pvpModule);
const autoEat = resolvePlugin(autoEatModule);

if (!collectBlock || !pvp || !autoEat) {
  throw new Error('Не удалось загрузить один из плагинов Mineflayer.');
}

const bot = mineflayer.createBot({
  host: process.env.MC_HOST || config.host,
  port: Number(process.env.MC_PORT || config.port),
  username: process.env.MC_USERNAME || config.username,
  auth: process.env.MC_AUTH || config.auth,
  viewDistance: Number(process.env.MC_VIEW_DISTANCE || config.viewDistance)
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(collectBlock);
bot.loadPlugin(pvp);
bot.loadPlugin(autoEat);

const state = {
  mode: null,
  target: null,
  guardPos: null
};

function stopAll() {
  state.mode = null;
  state.target = null;
  state.guardPos = null;
  bot.pathfinder.setGoal(null);
  bot.pvp.stop();
  bot.clearControlStates();
}

function sendHelp(username) {
  bot.whisper(
    username,
    'Команды: !follow <ник>, !come, !stop, !mine <block>, !fish, !pvp <ник>, !guard, !help'
  );
}

bot.once('spawn', () => {
  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);

  bot.autoEat.options = {
    priority: 'foodPoints',
    startAt: 14,
    bannedFood: []
  };

  if (config.enableViewer) {
    viewer(bot, { port: config.viewerPort, firstPerson: true });
  }

  bot.chat('Universal bot готов. Напиши !help для списка команд.');
});

bot.on('chat', async (username, message) => {
  if (username === bot.username) return;
  if (!message.startsWith('!')) return;

  const [command, ...args] = message.trim().split(/\s+/);
  const arg = args.join(' ');

  switch (command) {
    case '!help':
      sendHelp(username);
      break;
    case '!stop':
      stopAll();
      bot.chat('Останавливаюсь.');
      break;
    case '!follow':
      if (!arg) {
        bot.whisper(username, 'Укажи ник: !follow <ник>');
        break;
      }
      stopAll();
      state.mode = 'follow';
      state.target = arg;
      bot.chat(`Следую за ${arg}.`);
      break;
    case '!come':
      stopAll();
      if (bot.players[username]?.entity) {
        const pos = bot.players[username].entity.position;
        bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 1));
        bot.chat('Иду к тебе.');
      } else {
        bot.whisper(username, 'Не вижу тебя рядом.');
      }
      break;
    case '!mine':
      if (!arg) {
        bot.whisper(username, 'Укажи блок: !mine <block>');
        break;
      }
      stopAll();
      state.mode = 'mine';
      state.target = arg;
      bot.chat(`Добываю блоки: ${arg}`);
      break;
    case '!fish':
      stopAll();
      state.mode = 'fish';
      bot.chat('Начинаю рыбалку.');
      break;
    case '!pvp':
      if (!arg) {
        bot.whisper(username, 'Укажи цель: !pvp <ник>');
        break;
      }
      stopAll();
      state.mode = 'pvp';
      state.target = arg;
      bot.chat(`Атакую ${arg}.`);
      break;
    case '!guard':
      stopAll();
      state.mode = 'guard';
      state.guardPos = bot.entity.position.clone();
      bot.chat('Охраняю позицию.');
      break;
    default:
      bot.whisper(username, 'Неизвестная команда. Напиши !help.');
  }
});

bot.on('physicTick', () => {
  if (state.mode === 'follow') {
    const target = bot.players[state.target]?.entity;
    if (!target) return;
    bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 2));
  }

  if (state.mode === 'guard' && state.guardPos) {
    const distance = bot.entity.position.distanceTo(state.guardPos);
    if (distance > 6) {
      bot.pathfinder.setGoal(new GoalNear(state.guardPos.x, state.guardPos.y, state.guardPos.z, 1));
    }
    const mob = bot.nearestEntity(entity => entity.type === 'mob' || entity.type === 'player');
    if (mob && mob.position.distanceTo(bot.entity.position) < 4) {
      bot.pvp.attack(mob);
    }
  }
});

async function startMiningLoop() {
  while (true) {
    if (state.mode !== 'mine') return;
    const blockName = state.target;
    const blockType = bot.registry.blocksByName[blockName];
    if (!blockType) {
      bot.chat(`Не знаю блок ${blockName}.`);
      stopAll();
      return;
    }

    const block = bot.findBlock({
      matching: blockType.id,
      maxDistance: 32
    });

    if (!block) {
      bot.chat(`Не вижу блок ${blockName} рядом.`);
      await bot.waitForTicks(40);
      continue;
    }

    try {
      await bot.collectBlock.collect(block);
    } catch (error) {
      bot.chat(`Не могу добыть ${blockName}: ${error.message}`);
      await bot.waitForTicks(20);
    }
  }
}

async function startFishingLoop() {
  while (true) {
    if (state.mode !== 'fish') return;

    const rod = bot.inventory.items().find(item => item.name.includes('fishing_rod'));
    if (!rod) {
      bot.chat('Нет удочки в инвентаре.');
      stopAll();
      return;
    }

    try {
      await bot.equip(rod, 'hand');
      await bot.fish();
    } catch (error) {
      bot.chat(`Рыбалка не удалась: ${error.message}`);
      await bot.waitForTicks(20);
    }
  }
}

bot.on('physicTick', () => {
  if (state.mode === 'pvp') {
    const target = bot.players[state.target]?.entity;
    if (!target) return;
    bot.pvp.attack(target);
  }
});

bot.on('spawn', () => {
  startMiningLoop();
  startFishingLoop();
});

bot.on('error', err => {
  console.log('Bot error:', err.message);
});

bot.on('kicked', reason => {
  console.log('Kicked:', reason);
});
