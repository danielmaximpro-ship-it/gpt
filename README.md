# Mineflayer Universal Bot

Универсальный бот на Mineflayer: добыча, бой, рыбалка, следование и охрана.

## Установка

```bash
npm install
```

## Запуск

```bash
npm start
```

По умолчанию бот подключается к `localhost:25565` с ником `UniversalBot`.
Можно переопределить через переменные окружения:

```bash
MC_HOST=example.org MC_PORT=25565 MC_USERNAME=Bot MC_AUTH=offline npm start
```

Также можно создать `config.json` рядом с `package.json`:

```json
{
  "host": "localhost",
  "port": 25565,
  "username": "UniversalBot",
  "auth": "offline",
  "viewDistance": 10,
  "enableViewer": false,
  "viewerPort": 3007
}
```

## Команды в чате

- `!help` — список команд.
- `!follow <ник>` — следовать за игроком.
- `!come` — подойти к вызывающему.
- `!stop` — остановить текущую задачу.
- `!mine <block>` — добывать указанный блок.
- `!fish` — рыбалка.
- `!pvp <ник>` — атаковать игрока.
- `!guard` — охранять текущую позицию.

## Примечания

- Для рыбалки нужна удочка в инвентаре.
- Для добычи укажите имя блока из Minecraft (например, `stone`, `iron_ore`).
