import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

// Anyone who sees the prompt can use it, not just whoever triggered the original
// command — a lore-accuracy rating is a community judgment, not something scoped to
// the person who happened to run /affection mood or /persona profile that moment.
// The select menu has no expiry of its own; it just sits on the message indefinitely.

const RATE_CUSTOM_ID_PREFIX = 'rate_persona:';

const TIER_HINTS: Record<number, string> = {
  1: "Doesn't feel like them at all",
  2: 'Barely recognizable',
  3: 'A few big things feel off',
  4: 'Mostly misses the mark',
  5: 'Somewhat captures them',
  6: 'Decent, room to improve',
  7: 'Feels pretty accurate',
  8: 'Really captures them',
  9: 'Nails the character',
  10: 'Perfectly lore-accurate',
};

export function buildRatingPrompt(personaId: string, personaName: string): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<StringSelectMenuBuilder>;
} {
  const embed = new EmbedBuilder()
    .setColor(0x99aab5)
    .setDescription(`How lore-accurate does **${personaName}** feel? Rate 1-10 below — totally optional.`);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${RATE_CUSTOM_ID_PREFIX}${personaId}`)
    .setPlaceholder(`Rate how lore-accurate ${personaName} feels…`)
    .addOptions(
      Array.from({ length: 10 }, (_, i) => {
        const value = i + 1;
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${value}/10`)
          .setDescription(TIER_HINTS[value])
          .setValue(String(value));
      })
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  return { embed, row };
}

/** Returns the personaId encoded in a rating select menu's customId, or null if this
 *  customId isn't one of ours (defensive — other component interactions may exist later). */
export function parseRateCustomId(customId: string): string | null {
  if (!customId.startsWith(RATE_CUSTOM_ID_PREFIX)) return null;
  return customId.slice(RATE_CUSTOM_ID_PREFIX.length);
}
