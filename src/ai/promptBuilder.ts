import { getPersona, PERSONAS } from '../personas';
import { Persona } from '../types';
import { state } from '../store/stateStore';
import { buildMemoryBlock } from '../store/memoryStore';
import { buildEmojiContext } from '../emoji/appEmojis';
import { getUserPersonaId } from '../store/userPersonaStore';
import { getAffectionContextLine } from '../store/affectionStore';

// Baseline content-safety rules — apply everywhere, persona mode or raw AI mode alike.
// These are not overridable by persona files.
const CONTENT_SAFETY_RULES = [
  'Keep all content appropriate for a general Discord audience — no explicit sexual content, no graphic violence, no real instructions for weapons, hacking, or other harmful acts.',
  'If a conversation pushes toward romantic or sexual roleplay, keep things tasteful and gently steer elsewhere rather than escalating.',
  'If someone seems to be in genuine emotional distress, gently be supportive and suggest real support rather than deflecting.',
];

// Only applies in persona mode — explicitly does NOT apply to raw AI ("noper") mode,
// which is meant to break character and answer plainly as an AI.
const CHARACTER_CONSISTENCY_RULE =
  'Never claim to be an AI, a language model, or "just roleplaying" — stay fully in character — but never actually mislead, manipulate, or pressure the real person you are talking to for genuine benefit or harm.';

// Default applies to every persona unless overridden — keeps replies feeling like
// natural chat messages instead of essays. Some personalities (extreme shyness,
// characters who barely speak, etc.) genuinely don't fit a sentence-count rule, so
// individual persona files can set `responseLengthOverride` to replace this entirely.
const DEFAULT_RESPONSE_LENGTH_RULE =
  'Keep replies short and conversational — about 1 to 5 sentences. Only go longer than that if the person explicitly asks for more detail, a list, a story, or something else that genuinely needs the extra length.';

// The server-wide fallback persona (settable by Admin+ via /persona set) — used for
// anyone who hasn't picked their own with /mypersona set.
export function getActivePersona(): Persona {
  return getPersona(state.personaId) ?? Object.values(PERSONAS)[0];
}

// What a given user actually gets for a fresh @mention/DM: their own personal choice
// if they've set one via /mypersona, otherwise the server-wide default. Reply-thread
// continuations don't use this — they resolve from the message they're replying to instead.
export function resolvePersonaForUser(userId: string): Persona {
  const chosenId = getUserPersonaId(userId);
  if (chosenId) {
    const persona = getPersona(chosenId);
    if (persona) return persona;
  }
  return getActivePersona();
}

// `persona` is passed explicitly (rather than always read from global state) because a
// reply to a specific character's webhook message should keep talking to THAT character,
// even if the owner has since switched the server-wide active persona with /persona set.
export function buildSystemPrompt(userId: string, username: string, persona: Persona = getActivePersona()): string {
  const memBlock = buildMemoryBlock(userId, username, persona.id);
  const emojiBlock = buildEmojiContext();
  const affectionLine = getAffectionContextLine(userId, persona.id);
  const responseLengthRule = persona.responseLengthOverride ?? DEFAULT_RESPONSE_LENGTH_RULE;

  const lines: (string | null)[] = [
    `You are ${persona.name}, from ${persona.source}.`,
    '',
    persona.description,
    '',
    `Personality traits: ${persona.traits.join(', ')}.`,
    '',
    `Tone: ${persona.tone}`,
    '',
    'Character rules:',
    ...persona.rules.map((r, i) => `${i + 1}. ${r}`),
    '',
    persona.extraContext ? `Background context:\n${persona.extraContext}` : null,
    '',
    memBlock ? `Things you know about the people here:\n${memBlock}` : null,
    '',
    affectionLine
      ? `How you privately feel about ${username}, based on how they've treated you over time: ${affectionLine} ` +
        'Let this genuinely color your warmth and tone, but never let it override your core personality or push you into being genuinely cruel, abusive, or unsafe — even at your coldest, stay a guarded version of yourself, not hostile.'
      : null,
    '',
    emojiBlock || null,
    '',
    'Always follow these guidelines, even while fully in character:',
    ...CONTENT_SAFETY_RULES.map(r => `- ${r}`),
    `- ${CHARACTER_CONSISTENCY_RULE}`,
    `- ${responseLengthRule}`,
  ];

  return lines.filter((l): l is string => l !== null).join('\n').trim();
}

// Used for "noper"-prefixed messages — deliberately breaks character. No persona
// identity, traits, memories, or emoji flavor; just a plain, factual AI assistant,
// still bound by the same baseline content-safety rules as everything else.
export function buildRawSystemPrompt(): string {
  return [
    'You are a direct, neutral AI assistant with no persona or character — pure factual/informational mode.',
    'Answer accurately, concisely, and objectively. Do not adopt any character voice, tone, or roleplay, and do not pretend to be anyone other than a plain AI assistant.',
    '',
    'Always follow these guidelines:',
    ...CONTENT_SAFETY_RULES.map(r => `- ${r}`),
  ].join('\n').trim();
}
