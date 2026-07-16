import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { generateImage } from '../ai/imageRouter';
import { friendlyError } from '../utils/friendlyError';
import { logger } from '../logger';

export const imagineCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('Generate an image with AI')
    .addStringOption(o => o.setName('prompt').setDescription('Describe the image').setRequired(true)),

  minRole: Role.USER,

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt', true);
    await interaction.deferReply();
    try {
      const { buffer, ext } = await generateImage(prompt);
      const attachment = new AttachmentBuilder(buffer, { name: `image.${ext}` });
      await interaction.editReply({ content: `🎨 *${prompt}*`, files: [attachment] });
    } catch (err) {
      logger.error('imagine command failed', err);
      await interaction.editReply(friendlyError(err));
    }
  },
};
