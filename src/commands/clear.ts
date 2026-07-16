import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { clearHistory } from '../ai/history';

export const clearCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear conversation memory for this channel (logs are preserved)'),

  minRole: Role.USER,

  async execute(interaction) {
    clearHistory(interaction.channelId);
    await interaction.reply({ content: '🧹 Conversation memory cleared for this channel. (Logs preserved.)', ephemeral: true });
  },
};
