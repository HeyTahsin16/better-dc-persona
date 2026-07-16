import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { getOpenChannelId, setOpenChannelId, clearOpenChannelId } from '../store/openChannelStore';
import { getActivePersona } from '../ai/promptBuilder';

export const openChannelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('openchannel')
    .setDescription('[Admin+] Designate a trial channel anyone can talk in, authorized or not')
    .addSubcommand(s => s.setName('set').setDescription('Set the open/trial channel')
      .addChannelOption(o => o.setName('channel').setDescription('The channel to open up').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('clear').setDescription('Turn off the open channel (back to normal authorization everywhere)'))
    .addSubcommand(s => s.setName('status').setDescription('Show the current open channel setting')),

  minRole: Role.ADMIN,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      setOpenChannelId(channel.id);
      const persona = getActivePersona();
      await interaction.reply({
        content:
          `✅ <#${channel.id}> is now an open trial channel — anyone can talk there, authorized or not. ` +
          `Only **${persona.name}** (the current server-wide default) responds there; personal picks and ` +
          `persona-thread replies are ignored in this channel. Unauthorized users still can't run slash commands anywhere.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'clear') {
      const had = getOpenChannelId();
      clearOpenChannelId();
      await interaction.reply({ content: had ? `🗑️ Open channel cleared. <#${had}> is back to normal authorization rules.` : 'No open channel was set.', ephemeral: true });
      return;
    }

    // status
    const current = getOpenChannelId();
    await interaction.reply({
      content: current ? `Open channel: <#${current}>` : 'No open channel is currently set.',
      ephemeral: true,
    });
  },
};
