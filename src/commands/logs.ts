import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { readLog, searchLog } from '../store/chatLogStore';
import { getChannelContext, forgetChannelSummary } from '../store/channelContextStore';
import { queryChatLog } from '../features/logQuery';
import { replyChunked } from '../utils/interactionReply';
import { friendlyError } from '../utils/friendlyError';
import { logger } from '../logger';

export const logsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription("View, search, or summarize this channel's chat log")
    .addSubcommand(s => s.setName('recent').setDescription('Show recent messages')
      .addIntegerOption(o => o.setName('count').setDescription('How many messages (default 20)').setMinValue(1).setMaxValue(50)))
    .addSubcommand(s => s.setName('search').setDescription('Search the log by keyword')
      .addStringOption(o => o.setName('keyword').setDescription('Word to search for').setRequired(true)))
    .addSubcommand(s => s.setName('ask').setDescription("Ask the AI a question about this channel's history")
      .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)))
    .addSubcommand(s => s.setName('summary').setDescription('Show the rolling cross-persona summary personas are given for this channel'))
    .addSubcommand(s => s.setName('forget').setDescription('Reset the rolling summary for this channel (the log itself is kept)')),

  minRole: Role.USER,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (sub === 'search') {
      const keyword = interaction.options.getString('keyword', true);
      const results = searchLog(interaction.channelId, keyword).slice(-20);
      if (!results.length) { await interaction.editReply(`🔍 Nothing found for "${keyword}".`); return; }
      await replyChunked(interaction, `🔍 **Results for "${keyword}":**\n${results.map(e => `[\`${e.ts.slice(0, 16)}\`] **${e.username}**: ${e.content.slice(0, 120)}`).join('\n')}`);
      return;
    }

    if (sub === 'ask') {
      const question = interaction.options.getString('question', true);
      try {
        const answer = await queryChatLog(interaction.channelId, question);
        await replyChunked(interaction, `🗂️ ${answer}`);
      } catch (err) {
        logger.error('logs ask failed', err);
        await interaction.editReply(friendlyError(err));
      }
      return;
    }

    if (sub === 'summary') {
      const entry = getChannelContext(interaction.channelId);
      if (!entry) { await interaction.editReply("🗒️ No rolling summary yet for this channel — it builds up automatically as the conversation continues, so give it a few more messages."); return; }
      await replyChunked(interaction, `🗒️ **Rolling channel summary** — this is what every persona is quietly given for background awareness (updated ${new Date(entry.updatedAt).toLocaleString()}):\n${entry.summary}`);
      return;
    }

    if (sub === 'forget') {
      const removed = forgetChannelSummary(interaction.channelId);
      await interaction.editReply(removed
        ? '🧹 Rolling channel summary reset. (The raw log is untouched — a new summary will build back up as the conversation continues.)'
        : "🧹 There wasn't a summary here yet, nothing to reset.");
      return;
    }

    // recent
    const count = interaction.options.getInteger('count') ?? 20;
    const entries = readLog(interaction.channelId, count);
    if (!entries.length) { await interaction.editReply('📋 No log history yet.'); return; }
    await replyChunked(interaction, `📋 **Last ${entries.length} messages:**\n${entries.map(e => `[\`${e.ts.slice(0, 16)}\`] **${e.username}**: ${e.content.slice(0, 120)}`).join('\n')}`);
  },
};
