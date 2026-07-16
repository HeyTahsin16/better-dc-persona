import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { analyzeImage } from '../ai/visionRouter';
import { resolveEmojis } from '../emoji/appEmojis';
import { replyChunked } from '../utils/interactionReply';
import { friendlyError } from '../utils/friendlyError';
import { logger } from '../logger';

export const analyzeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('Ask the AI to analyze an image')
    .addAttachmentOption(o => o.setName('image').setDescription('Image to analyze').setRequired(true))
    .addStringOption(o => o.setName('question').setDescription('What do you want to know? (default: describe it)')),

  minRole: Role.USER,

  async execute(interaction) {
    const attachment = interaction.options.getAttachment('image', true);
    const question = interaction.options.getString('question') ?? 'Describe this image in detail.';

    if (!attachment.contentType?.startsWith('image/')) {
      await interaction.reply({ content: "That attachment doesn't look like an image.", ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      const res = await fetch(attachment.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const answer = await analyzeImage(buffer, attachment.contentType, question, interaction.user.id, interaction.user.username);
      await replyChunked(interaction, resolveEmojis(answer), false);
    } catch (err) {
      logger.error('analyze command failed', err);
      await interaction.editReply(friendlyError(err));
    }
  },
};
