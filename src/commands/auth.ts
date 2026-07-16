import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role, AuthRole } from '../types';
import { addAuthorized, removeAuthorized, listAuthorized } from '../store/authStore';
import { roleLabel, getRole } from '../permissions/roles';
import { replyChunked } from '../utils/interactionReply';

export const authCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('auth')
    .setDescription('[Owner] Manage who can use the bot')
    .addSubcommand(s => s.setName('add').setDescription('Authorize a user')
      .addUserOption(o => o.setName('user').setDescription('User to authorize').setRequired(true))
      .addStringOption(o => o.setName('role').setDescription('Access level').setRequired(true)
        .addChoices({ name: 'Normal', value: 'normal' }, { name: 'Admin', value: 'admin' })))
    .addSubcommand(s => s.setName('remove').setDescription('Remove authorization')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('set-role').setDescription('Change an existing user\'s role')
      .addUserOption(o => o.setName('user').setDescription('User to update').setRequired(true))
      .addStringOption(o => o.setName('role').setDescription('New access level').setRequired(true)
        .addChoices({ name: 'Normal', value: 'normal' }, { name: 'Admin', value: 'admin' })))
    .addSubcommand(s => s.setName('list').setDescription('List authorized users')),

  minRole: Role.OWNER,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const owner = interaction.client.user;
      const entries = listAuthorized();
      const lines = [
        `👑 **Owner:** <@${process.env.OWNER_ID}>`,
        ...entries.map(e => `${e.role === 'admin' ? '🛡️' : '👤'} <@${e.id}> — ${roleLabel(getRole(e.id))}`),
      ];
      void owner;
      await replyChunked(interaction, `**🔐 Authorized users:**\n${lines.join('\n')}`);
      return;
    }

    if (sub === 'add' || sub === 'set-role') {
      const target = interaction.options.getUser('user', true);
      const role = interaction.options.getString('role', true) as AuthRole;
      addAuthorized(target.id, role);
      const verb = sub === 'add' ? 'authorized' : 'updated';
      await interaction.reply({ content: `✅ <@${target.id}> ${verb} as **${role === 'admin' ? 'Admin' : 'Normal'}**.`, ephemeral: true });
      return;
    }

    if (sub === 'remove') {
      const target = interaction.options.getUser('user', true);
      const removed = removeAuthorized(target.id);
      await interaction.reply({
        content: removed ? `🗑️ <@${target.id}> removed.` : `ℹ️ <@${target.id}> wasn't authorized.`,
        ephemeral: true,
      });
    }
  },
};
