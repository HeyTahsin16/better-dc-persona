import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { addTrigger, removeTrigger, loadTriggers } from '../store/triggerStore';
import { replyChunked } from '../utils/interactionReply';

export const triggerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('trigger')
    .setDescription('[Admin+] Manage keyword auto-replies')
    .addSubcommand(s => s.setName('add').setDescription('Add a keyword trigger and one of its replies')
      .addStringOption(o => o.setName('keyword').setDescription('The trigger word/phrase (case-insensitive)').setRequired(true))
      .addStringOption(o => o.setName('reply').setDescription('A reply to send when this keyword is detected').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an entire keyword or a single reply')
      .addStringOption(o => o.setName('keyword').setDescription('The trigger keyword').setRequired(true))
      .addIntegerOption(o => o.setName('index').setDescription('Reply index to delete (omit to delete the whole keyword)')))
    .addSubcommand(s => s.setName('list').setDescription('List all keyword triggers')
      .addStringOption(o => o.setName('keyword').setDescription('Show replies for a specific keyword (omit to list all keywords)'))),

  minRole: Role.ADMIN,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const keyword = interaction.options.getString('keyword')?.toLowerCase().trim();

    if (sub === 'add') {
      const reply = interaction.options.getString('reply', true);
      const count = addTrigger(keyword!, reply);
      await interaction.reply({ content: `✅ Trigger added for **"${keyword}"** — now has ${count} repl${count === 1 ? 'y' : 'ies'}.`, ephemeral: true });
      return;
    }

    if (sub === 'remove') {
      const index = interaction.options.getInteger('index');
      const result = removeTrigger(keyword!, index ?? undefined);
      const messages: Record<string, string> = {
        deleted_keyword: `🗑️ Trigger **"${keyword}"** and all its replies removed.`,
        deleted_reply: `🗑️ Reply #${index} removed from **"${keyword}"**.`,
        no_keyword: `❌ No trigger found for **"${keyword}"**.`,
        no_index: `❌ Index #${index} not found for **"${keyword}"**.`,
      };
      await interaction.reply({ content: messages[result], ephemeral: true });
      return;
    }

    // list
    const triggers = loadTriggers();
    if (keyword) {
      const replies = triggers[keyword];
      if (!replies?.length) { await interaction.reply({ content: `No trigger found for **"${keyword}"**.`, ephemeral: true }); return; }
      await replyChunked(interaction, `**Replies for "${keyword}":**\n${replies.map((r, i) => `\`[${i}]\` ${r}`).join('\n')}`);
      return;
    }
    const keys = Object.keys(triggers);
    if (!keys.length) { await interaction.reply({ content: 'No keyword triggers set yet.', ephemeral: true }); return; }
    await replyChunked(interaction, `**Keyword triggers (${keys.length}):**\n${keys.map(k => `• **"${k}"** — ${triggers[k].length} repl${triggers[k].length === 1 ? 'y' : 'ies'}`).join('\n')}\n\nUse \`/trigger list keyword:<word>\` to see replies.`);
  },
};
