import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { clearAllHistory } from '../ai/history';
import { loadAppEmojis } from '../emoji/appEmojis';
import { refreshAvatarCache } from '../webhooks/avatarResolver';
import { refreshBackgroundCache } from '../features/moodCard';

export const reloadCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('[Admin+] Clear conversation memory everywhere, re-fetch app emojis, avatars, and backgrounds'),

  minRole: Role.ADMIN,

  async execute(interaction) {
    clearAllHistory();
    await loadAppEmojis(interaction.client);
    refreshAvatarCache();
    refreshBackgroundCache();
    await interaction.reply({ content: '♻️ Conversation memory cleared, app emojis, avatar files, and mood card backgrounds refreshed.', ephemeral: true });
  },
};
