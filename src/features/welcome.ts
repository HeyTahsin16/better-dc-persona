import { GuildMember, TextChannel } from 'discord.js';
import { loadWelcomeConfig } from '../store/welcomeStore';
import { completeOneShot } from '../ai/chatRouter';
import { buildSystemPrompt } from '../ai/promptBuilder';
import { getPersona } from '../personas';
import { NEUTRAL_PERSONA_ID } from '../constants';
import { resolveEmojis } from '../emoji/appEmojis';
import { logger } from '../logger';

// Welcome greetings are always written by the designated neutral persona (see
// NEUTRAL_PERSONA_ID), regardless of whatever persona is currently active for
// conversations — this keeps a new member's first impression consistent even if
// the server's active persona has been switched for some other purpose.

export async function buildWelcomeText(member: GuildMember): Promise<string> {
  const persona = getPersona(NEUTRAL_PERSONA_ID);
  if (!persona) {
    // Should never happen (NEUTRAL_PERSONA_ID must match a registered persona id) — hard fallback.
    return `Welcome to ${member.guild.name}, <@${member.id}>! 🎉`;
  }

  const username = member.user.username;
  const prompt =
    `A new member named ${username} just joined the Discord server "${member.guild.name}". ` +
    `Write a short, warm welcome message greeting them by name, fully in character as ${persona.name}. ` +
    'Keep it to 1-3 sentences.';

  try {
    const systemPrompt = buildSystemPrompt(member.id, username, persona);
    const text = await completeOneShot(prompt, systemPrompt);
    return resolveEmojis(`<@${member.id}> ${text}`);
  } catch (err) {
    logger.warn('AI welcome generation failed, using a plain fallback greeting', err);
    return `Welcome to ${member.guild.name}, <@${member.id}>! 🎉`;
  }
}

export async function sendWelcomeMessage(member: GuildMember): Promise<void> {
  const cfg = loadWelcomeConfig();
  if (!cfg.enabled || !cfg.channelId) return;

  const channel = await member.guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    logger.warn(`Welcome channel ${cfg.channelId} not found or not text-based`);
    return;
  }

  const text = await buildWelcomeText(member);
  await (channel as TextChannel).send(text);
  logger.info(`Sent welcome message for ${member.user.username} in #${(channel as TextChannel).name}`);
}
