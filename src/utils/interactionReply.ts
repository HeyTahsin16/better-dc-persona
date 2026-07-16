import { ChatInputCommandInteraction } from 'discord.js';
import { chunkText } from './chunk';

export async function replyChunked(interaction: ChatInputCommandInteraction, text: string, ephemeral = true): Promise<void> {
  const chunks = chunkText(text);
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: chunks[0], ephemeral });
  } else {
    await interaction.editReply(chunks[0]);
  }
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({ content: chunks[i], ephemeral });
  }
}
