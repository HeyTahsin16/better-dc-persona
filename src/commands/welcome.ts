import { SlashCommandBuilder, ChannelType, GuildMember } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { loadWelcomeConfig, updateWelcomeConfig } from '../store/welcomeStore';
import { buildWelcomeText } from '../features/welcome';
import { getPersona } from '../personas';
import { NEUTRAL_PERSONA_ID } from '../constants';

export const welcomeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('[Admin+] Configure new member welcome messages')
    .addSubcommand(s => s.setName('set-channel').setDescription('Set the channel welcome messages are posted in')
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('toggle').setDescription('Enable or disable welcome messages')
      .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('Show current welcome configuration'))
    .addSubcommand(s => s.setName('test').setDescription('Send a preview welcome message using yourself as the new member')),

  minRole: Role.ADMIN,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set-channel') {
      const channel = interaction.options.getChannel('channel', true);
      updateWelcomeConfig({ channelId: channel.id });
      await interaction.reply({ content: `✅ Welcome channel set to <#${channel.id}>.`, ephemeral: true });
      return;
    }

    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      updateWelcomeConfig({ enabled });
      await interaction.reply({ content: `✅ Welcome messages **${enabled ? 'enabled' : 'disabled'}**.`, ephemeral: true });
      return;
    }

    if (sub === 'status') {
      const cfg = loadWelcomeConfig();
      const persona = getPersona(NEUTRAL_PERSONA_ID);
      await interaction.reply({
        content: [
          `**Welcome message config:**`,
          `Enabled: ${cfg.enabled ? '✅' : '❌'}`,
          `Channel: ${cfg.channelId ? `<#${cfg.channelId}>` : '*not set*'}`,
          `Greeter: **${persona?.name ?? NEUTRAL_PERSONA_ID}** (fixed — always this persona, regardless of the active conversation persona)`,
        ].join('\n'),
        ephemeral: true,
      });
      return;
    }

    if (sub === 'test') {
      if (!interaction.guild) { await interaction.reply({ content: 'This only works inside a server.', ephemeral: true }); return; }
      await interaction.deferReply({ ephemeral: true });
      const member = (interaction.member as GuildMember) ?? await interaction.guild.members.fetch(interaction.user.id);
      const text = await buildWelcomeText(member);
      await interaction.editReply(`**Preview:**\n${text}`);
    }
  },
};
