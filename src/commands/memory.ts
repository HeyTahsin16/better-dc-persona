import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import {
  addGlobalMemory, removeGlobalMemoryByQuery,
  addPersonaMemory, removePersonaMemoryByQuery,
  listPersonaMemoriesForUser, listPersonaUserSummary, loadMemories,
} from '../store/memoryStore';
import { getActivePersona } from '../ai/promptBuilder';
import { replyChunked } from '../utils/interactionReply';

// Every subcommand here is Owner-only — if authorized users could add memories about
// themselves, that would trivially defeat the point of the affection system (which is
// supposed to reflect earned behavior, not self-declared facts). "add"/"remove" operate
// implicitly on whichever persona is currently the server-wide default (getActivePersona())
// rather than taking a persona picker — with 26+ personas that picker would blow past
// Discord's 25-choice cap the same way persona SELECTION did, and unlike selection this
// doesn't need search/autocomplete since there's nothing to pick: it's just "whichever
// persona is active right now." To add memory for a different persona, /persona set to
// it first, then add the memory, then switch back if needed.

export const memoryCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('[Owner] Manage what the currently-active persona remembers')
    .addSubcommand(s => s.setName('add').setDescription('Add a fact the ACTIVE persona knows about a user')
      .addUserOption(o => o.setName('user').setDescription('Who this memory is about').setRequired(true))
      .addStringOption(o => o.setName('fact').setDescription('The fact to remember').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a fact the ACTIVE persona knows about a user (matches by text)')
      .addUserOption(o => o.setName('user').setDescription('Who the memory is about').setRequired(true))
      .addStringOption(o => o.setName('query').setDescription('Text that appears in the memory to remove').setRequired(true)))
    .addSubcommand(s => s.setName('add-global').setDescription('Add a fact every persona knows about everyone')
      .addStringOption(o => o.setName('fact').setDescription('The fact to remember').setRequired(true)))
    .addSubcommand(s => s.setName('remove-global').setDescription('Remove a global fact (matches by text)')
      .addStringOption(o => o.setName('query').setDescription('Text that appears in the memory to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List memories')
      .addUserOption(o => o.setName('user').setDescription('View the active persona\'s facts about a specific user (leave blank for a summary)'))),

  minRole: Role.OWNER,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const persona = getActivePersona();

    if (sub === 'add') {
      const target = interaction.options.getUser('user', true);
      const fact = interaction.options.getString('fact', true);
      addPersonaMemory(persona.id, target.id, fact);
      await interaction.reply({ content: `🧠 **${persona.name}** now knows this about <@${target.id}>: "${fact}"`, ephemeral: true });
      return;
    }

    if (sub === 'remove') {
      const target = interaction.options.getUser('user', true);
      const query = interaction.options.getString('query', true);
      const removed = removePersonaMemoryByQuery(persona.id, target.id, query);
      await interaction.reply({
        content: removed
          ? `🗑️ Removed from **${persona.name}**'s memory of <@${target.id}>: "${removed}"`
          : `❌ No memory matched "${query}" for <@${target.id}> under **${persona.name}**.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'add-global') {
      const fact = interaction.options.getString('fact', true);
      addGlobalMemory(fact);
      await interaction.reply({ content: `🧠 Global memory saved (known to every persona): "${fact}"`, ephemeral: true });
      return;
    }

    if (sub === 'remove-global') {
      const query = interaction.options.getString('query', true);
      const removed = removeGlobalMemoryByQuery(query);
      await interaction.reply({
        content: removed ? `🗑️ Removed global memory: "${removed}"` : `❌ No global memory matched "${query}".`,
        ephemeral: true,
      });
      return;
    }

    // list
    const target = interaction.options.getUser('user');
    const store = loadMemories();

    if (target) {
      const facts = listPersonaMemoriesForUser(persona.id, target.id);
      const globalCount = store.global.length;
      const parts = [
        globalCount ? `**Global facts (${globalCount}, known to every persona):**\n${store.global.map((e, i) => `\`[${i}]\` ${e}`).join('\n')}` : null,
        `**${persona.name}'s facts about <@${target.id}>:**\n${facts.length ? facts.map((e, i) => `\`[${i}]\` ${e}`).join('\n') : '*none*'}`,
      ];
      await replyChunked(interaction, parts.filter(Boolean).join('\n\n'));
      return;
    }

    const summary = listPersonaUserSummary(persona.id);
    const userLines = Object.entries(summary).map(([userId, count]) => `👤 <@${userId}> — ${count} fact${count === 1 ? '' : 's'}`);
    await replyChunked(interaction,
      `**🌐 Global** — ${store.global.length} fact${store.global.length === 1 ? '' : 's'} (known to every persona)\n` +
      `**${persona.name}** knows things about:\n${userLines.length ? userLines.join('\n') : '*no one yet*'}\n\n` +
      `Use \`/memory list user:<@user>\` to see the actual entries.`
    );
  },
};
