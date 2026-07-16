import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role, ChatProviderName } from '../types';
import { hasRole } from '../permissions/roles';
import { state, setChatProvider, setChatModel, activeChatModel } from '../store/stateStore';
import { clearAllHistory } from '../ai/history';
import { PROVIDER_DEFAULTS, FREE_MODELS, CHAT_PROVIDER_NAMES } from '../constants';
import { replyChunked } from '../utils/interactionReply';

export const providerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('provider')
    .setDescription('Manage the chat AI provider')
    .addSubcommand(s => s.setName('set').setDescription('[Admin+] Switch chat provider')
      .addStringOption(o => {
        o.setName('name').setDescription('Provider name').setRequired(true);
        for (const p of CHAT_PROVIDER_NAMES) o.addChoices({ name: p, value: p });
        return o;
      })
      .addStringOption(o => o.setName('model').setDescription('Override model (leave blank for provider default)')))
    .addSubcommand(s => s.setName('model').setDescription('[Admin+] Set the chat model on the current provider')
      .addStringOption(o => o.setName('name').setDescription('Model name').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all chat providers'))
    .addSubcommand(s => s.setName('models').setDescription('List free/default models for the current provider')),

  minRole: Role.USER,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const list = Object.entries(PROVIDER_DEFAULTS).map(([p, m]) => `${p === state.chatProvider ? '✅' : '•'} **${p}** — default: \`${m}\``).join('\n');
      await replyChunked(interaction, `**Chat providers:**\n${list}`);
      return;
    }

    if (sub === 'models') {
      const models = FREE_MODELS[state.chatProvider] || [];
      if (!models.length) { await interaction.reply({ content: `No preset model list for **${state.chatProvider}**.`, ephemeral: true }); return; }
      await replyChunked(interaction, `**Free/default models for ${state.chatProvider}:**\n${models.map((m, i) => `${i === 0 ? '⭐' : '•'} \`${m}\``).join('\n')}\n\nCurrent: \`${activeChatModel()}\``);
      return;
    }

    if (!hasRole(interaction.user.id, Role.ADMIN)) {
      await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
      return;
    }

    if (sub === 'set') {
      const name = interaction.options.getString('name', true) as ChatProviderName;
      const model = interaction.options.getString('model') || '';
      setChatProvider(name, model);
      clearAllHistory();
      await interaction.reply(`✅ Chat provider → **${state.chatProvider}** / model → \`${activeChatModel()}\`. History cleared.`);
      return;
    }

    if (sub === 'model') {
      const name = interaction.options.getString('name', true);
      setChatModel(name);
      clearAllHistory();
      await interaction.reply(`✅ Chat model → \`${name}\`. History cleared.`);
    }
  },
};
