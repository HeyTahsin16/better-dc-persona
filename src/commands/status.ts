import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { state, activeChatModel, activeImageModel } from '../store/stateStore';
import { getActivePersona } from '../ai/promptBuilder';
import { getPublicBaseUrl } from '../webhooks/avatarResolver';
import { getRateLimitStatus } from '../ai/rateLimiter';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export const statusCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show the current AI provider, persona, and bot health'),

  minRole: Role.USER,

  async execute(interaction) {
    const persona = getActivePersona();
    const mem = process.memoryUsage();
    const memMb = (mem.rss / 1024 / 1024).toFixed(1);
    const publicUrl = getPublicBaseUrl();
    const rl = getRateLimitStatus();

    await interaction.reply({
      content: [
        `🎭 **Active persona:** ${persona.name} (${persona.source})`,
        `🤖 **Chat:** \`${state.chatProvider}\` / \`${activeChatModel()}\``,
        `🎨 **Image:** \`${state.imageProvider}\` / \`${activeImageModel()}\``,
        `🚦 **Rate limit guard:** ${rl.used}/${rl.limit} this minute (resets in ${Math.ceil(rl.resetInMs / 1000)}s)`,
        `🖼️ **Avatar hosting:** ${publicUrl ? `✅ ${publicUrl}` : '❌ not configured — set PUBLIC_URL or generate a Railway domain'}`,
        `⏱️ **Uptime:** ${formatUptime(process.uptime())}`,
        `💾 **Memory:** ${memMb} MB`,
      ].join('\n'),
      ephemeral: true,
    });
  },
};
