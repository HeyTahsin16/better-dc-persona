import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role, ImageProviderName } from '../types';
import { hasRole } from '../permissions/roles';
import { state, setImageProvider, activeImageModel } from '../store/stateStore';
import { IMAGE_PROVIDER_DEFAULTS, IMAGE_PROVIDER_NAMES } from '../constants';
import { replyChunked } from '../utils/interactionReply';

export const imgProviderCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('imgprovider')
    .setDescription('Manage the image generation provider')
    .addSubcommand(s => s.setName('set').setDescription('[Admin+] Switch image provider')
      .addStringOption(o => {
        o.setName('name').setDescription('Provider name').setRequired(true);
        for (const p of IMAGE_PROVIDER_NAMES) o.addChoices({ name: p, value: p });
        return o;
      })
      .addStringOption(o => o.setName('model').setDescription('Override model (leave blank for provider default)')))
    .addSubcommand(s => s.setName('list').setDescription('List all image providers')),

  minRole: Role.USER,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const list = Object.entries(IMAGE_PROVIDER_DEFAULTS).map(([p, m]) => `${p === state.imageProvider ? '✅' : '•'} **${p}** — default: \`${m || 'n/a'}\``).join('\n');
      await replyChunked(interaction, `**Image providers:**\n${list}`);
      return;
    }

    if (!hasRole(interaction.user.id, Role.ADMIN)) {
      await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true) as ImageProviderName;
    const model = interaction.options.getString('model') || '';
    setImageProvider(name, model);
    await interaction.reply(`✅ Image provider → **${state.imageProvider}** / model → \`${activeImageModel()}\`.`);
  },
};
