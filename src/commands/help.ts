import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { getRole, roleLabel } from '../permissions/roles';
import { baseCommands } from './baseCommands';
import { replyChunked } from '../utils/interactionReply';

function commandLine(cmd: SlashCommand): string {
  return `\`/${cmd.data.name}\` — ${cmd.data.description}`;
}

export const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show every command available to you, with descriptions'),

  minRole: Role.USER,

  async execute(interaction) {
    const role = getRole(interaction.user.id);
    // helpCommand referencing itself here is safe — by the time execute() runs,
    // this module has long finished initializing.
    const all = [...baseCommands, helpCommand];

    const tiers: { role: Role; label: string }[] = [
      { role: Role.USER, label: 'Everyone' },
      { role: Role.ADMIN, label: 'Admin+' },
      { role: Role.OWNER, label: 'Owner only' },
    ];

    const sections = [`**📖 Commands available to you** — you have **${roleLabel(role)}** access.`];

    for (const tier of tiers) {
      if (role < tier.role) continue; // don't show tiers the caller can't use
      const inTier = all.filter(c => c.minRole === tier.role);
      if (!inTier.length) continue;
      sections.push(`\n**${tier.label}:**\n${inTier.map(commandLine).join('\n')}`);
    }

    await replyChunked(interaction, sections.join('\n'));
  },
};
