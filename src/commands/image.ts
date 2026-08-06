import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { generateImage } from '../ai/imageRouter';
import { analyzeImage } from '../ai/visionRouter';
import { resolveEmojis } from '../emoji/appEmojis';
import { replyChunked } from '../utils/interactionReply';
import { friendlyError } from '../utils/friendlyError';
import { logger } from '../logger';

// Was two separate commands (/imagine, /analyze) — both plain USER-level,
// both "AI does something with an image", just create vs. read. Merged as
// subcommands of one /image command; behavior of each is unchanged.
export const imageCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Generate or analyze an image with AI')
    .addSubcommand(s => s.setName('create').setDescription('Generate an image with AI')
      .addStringOption(o => o.setName('prompt').setDescription('Describe the image').setRequired(true)))
    .addSubcommand(s => s.setName('analyze').setDescription('Ask the AI to analyze an image')
      .addAttachmentOption(o => o.setName('image').setDescription('Image to analyze').setRequired(true))
      .addStringOption(o => o.setName('question').setDescription('What do you want to know? (default: describe it)'))),

  minRole: Role.USER,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const prompt = interaction.options.getString('prompt', true);
      await interaction.deferReply();
      try {
        const { buffer, ext } = await generateImage(prompt);
        const attachment = new AttachmentBuilder(buffer, { name: `image.${ext}` });
        await interaction.editReply({ content: `🎨 *${prompt}*`, files: [attachment] });
      } catch (err) {
        logger.error('image create failed', err);
        await interaction.editReply(friendlyError(err));
      }
      return;
    }

    // analyze
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
      logger.error('image analyze failed', err);
      await interaction.editReply(friendlyError(err));
    }
  },
};
