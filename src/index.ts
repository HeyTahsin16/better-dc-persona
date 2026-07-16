import { Client, GatewayIntentBits, Events } from 'discord.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { env, requireEnv } from './env';
import { logger } from './logger';
import { onReady } from './events/ready';
import { onInteractionCreate } from './events/interactionCreate';
import { onMessageCreate } from './events/messageCreate';
import { onGuildMemberAdd } from './events/guildMemberAdd';
import { resolveAvatarFilePath } from './webhooks/avatarResolver';

requireEnv();

process.on('unhandledRejection', reason => {
  logger.error('Unhandled promise rejection', reason);
});
process.on('uncaughtException', err => {
  logger.error('Uncaught exception', err);
});

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Minimal HTTP server: /health for uptime monitoring, /avatars/<file> to serve
// persona avatars publicly (required for Discord's webhook avatar_url to work).
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
    return;
  }

  if (req.url?.startsWith('/avatars/')) {
    const filename = decodeURIComponent(req.url.slice('/avatars/'.length));
    const filePath = resolveAvatarFilePath(filename);
    if (!filePath) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end();
});
healthServer.listen(env.PORT, () => logger.info(`HTTP server listening on port ${env.PORT} (/health, /avatars)`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers, // required for welcome messages (guildMemberAdd)
  ],
});

client.once(Events.ClientReady, onReady);
client.on(Events.InteractionCreate, onInteractionCreate);
client.on(Events.MessageCreate, onMessageCreate);
client.on(Events.GuildMemberAdd, onGuildMemberAdd);

client.login(env.DISCORD_TOKEN);
