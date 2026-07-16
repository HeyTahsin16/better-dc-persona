import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { clearAllHistory } from '../ai/history';
import { loadAppEmojis } from '../emoji/appEmojis';
import { refreshAvatarCache } from '../webhooks/avatarResolver';

export const reloadCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('[Admin+] Clear conversation memory everywhere, re-fetch app emojis and avatar files'),

  minRole: Role.ADMIN,

  async execute(interaction) {
    clearAllHistory();
    await loadAppEmojis(interaction.client);
    refreshAvatarCache();
    await interaction.reply({ content: '♻️ Conversation memory cleared, app emojis and avatar files refreshed.', ephemeral: true });
  },
};
