# Documentation

Complete reference for every system, command, and mechanic in this bot. For a quick
setup guide, see `README.md` instead — this document assumes the bot is already
running and goes deep on how everything works and why. For a dense, AI-oriented
version of this same territory (useful if you're using Claude Code or another AI
assistant to keep developing this project), see `CLAUDE.md`.

**Current version:** 3.14.0 · **Personas:** 70 · **Commands:** 15 top-level (with
subcommands)

## Table of contents

1. [Overview](#overview)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Complete command reference](#complete-command-reference)
4. [Personas](#personas)
5. [The Affection Meter](#the-affection-meter)
6. [Persona Ratings](#persona-ratings)
7. [AI Providers](#ai-providers)
8. [Persona Identity & Webhooks](#persona-identity--webhooks)
9. [Memory](#memory)
10. [Keyword Triggers](#keyword-triggers)
11. [Reminders](#reminders)
12. [Welcome Messages](#welcome-messages)
13. [Open/Trial Channel](#opentrial-channel)
14. [Chat Logs](#chat-logs)
15. [Channel Awareness](#channel-awareness)
16. [Permissions & Roles](#permissions--roles)
17. [Mood Cards](#mood-cards)
18. [Data Storage](#data-storage)
19. [Configuration Reference](#configuration-reference)
20. [Troubleshooting](#troubleshooting)

---

## Overview

This is a Discord bot that lets a server talk to any of 70 switchable anime/game
character personas through an LLM, with each persona replying under its own name and
avatar (via a Discord webhook, not the bot's own identity) so conversations genuinely
feel like talking to that character rather than "the bot pretending." Layered on top
of that core chat loop:

- **A relationship system** (the Affection Meter) that tracks how each persona
  privately feels about each user, based on an AI-judged read of how they've been
  treated over time — not a keyword counter, and customizable per character.
- **A community rating system**, separate from the above, for how lore-accurate people
  think each persona actually feels.
- **Generated visual "mood cards"** — a composited image (persona art + background +
  the relationship read) for the public `/affection mood` command.
- Image generation and analysis, reminders, keyword auto-replies, per-user and
  per-persona memory, welcome messages, and a role-based permission system (Owner /
  Admin / Normal).
- **Cross-persona channel awareness** — a compact, persistent recap of each channel's
  recent conversation, shared by every persona regardless of which one (if any) was
  actually part of it, so a character invoked cold into an ongoing conversation isn't
  blind to what's already happened there.

Everything is backed by flat JSON files under `data/` (created automatically, never
committed) — there's no database. State that needs to be fast and doesn't need to
survive a restart (conversation history, the thread-continuation tracker) lives in
memory instead.

## Architecture at a glance

A message arrives → `events/messageCreate.ts` decides whether the bot should respond
at all (mentioned? DM? reply-continuing a thread? the designated open channel?
`RESPOND_TO_ALL` on?) and whether the sender is authorized → resolves which persona
should answer (their personal pick via `/persona my`, or the server-wide default, or
whichever character a reply-thread is continuing) → builds a full system prompt
(`ai/promptBuilder.ts`: persona identity + traits + rules + memories + a rolling
cross-persona channel recap (`ai/channelContext.ts`, see [Channel
Awareness](#channel-awareness)) + current affection standing + available custom emoji
+ content-safety rules) → dispatches to
whichever AI provider is currently active (`ai/chatRouter.ts` → `ai/providers/*.ts`)
→ sends the reply styled as that persona through a per-channel Discord webhook
(`webhooks/webhookManager.ts`) → logs the exchange → in the background (after the
reply is already sent, never blocking it), rates the message's tone specifically
*as that persona would experience it* and updates the affection score accordingly.

Slash commands follow a flatter path: `events/interactionCreate.ts` looks up the
command by name, checks the role floor, calls its `execute()`. Autocomplete
interactions (persona search-as-you-type) and, as of the rating system, select-menu
component interactions are both handled in the same file, routed by interaction type.

## Complete command reference

Fifteen top-level commands. Where a command has subcommands, each is listed with its
own permission level, since several commands mix permission levels across their
subcommands (this is intentional and consistent — see `/affection` and `/persona`
especially).

### `/image` — Normal

- **`/image create prompt:<text>`** — generates an image with the active image
  provider. Posts the prompt (italicized) alongside the result.
- **`/image analyze image:<attachment> [question:<text>]`** — analyzes an uploaded
  image. Defaults to "describe this image in detail" if no question is given. Uses the
  active chat provider's vision capability if it has one; otherwise transparently
  falls back to whichever configured provider does.

### `/memory` — Owner only

Everything here operates on whichever persona is *currently the server-wide default*
— there's no persona picker, since with 70+ personas a picker here would hit Discord's
25-choice autocomplete constraints for no real benefit (switch the active persona
first with `/persona set`, add the memory, switch back if needed).

- **`add user:<user> fact:<text>`** — the active persona learns a fact about a
  specific user.
- **`remove user:<user> query:<text>`** — removes a fact matching `query` as a
  substring (case-insensitive).
- **`add-global fact:<text>`** — a fact every persona knows about everyone, not
  scoped to the active persona.
- **`remove-global query:<text>`** — same matching rule as `remove`.
- **`list [user:<user>]`** — with a user specified, shows global facts plus that
  persona's facts about them. Without one, shows a summary of how many facts exist
  per user.

### `/logs` — Normal

- **`recent [count:<n>]`** — recent chat history for this channel.
- **`search keyword:<text>`** — full-text search over this channel's log.
- **`ask question:<text>`** — an AI answers a question using only what's actually in
  this channel's log (explicitly instructed not to make anything up if the answer
  isn't there).
- **`summary`** — shows the rolling cross-persona summary currently being injected
  into every persona's system prompt for this channel (see [Channel
  Awareness](#channel-awareness)).
- **`forget`** — resets that rolling summary. The permanent log is untouched; a new
  summary simply builds back up as the conversation continues, same spirit as `/clear`
  not touching the log either.

### `/status` — Normal

Bot health snapshot: active persona, active chat/image provider and model, current
rate-limit-guard usage this minute, whether avatar public hosting is configured,
uptime, memory usage.

### `/persona` — Normal (mixed — see below)

- **`current`** *(Normal)* — the server-wide default persona.
- **`profile persona:<search>`** *(Normal)* — a character's avatar, bio, background
  art, and community rating, all in one embed. See [Personas](#personas) for exactly
  what's shown.
- **`rate persona:<search> rating:<1-10>`** *(Normal)* — rate how lore-accurate a
  persona feels. See [Persona Ratings](#persona-ratings).
- **`leaderboard`** *(Normal)* — top 20 personas by average rating, posted publicly.
- **`list [version:<vX.X>]`** *(Normal)* — every persona, A-Z, optionally filtered to
  only the ones added in a specific version.
- **`set id:<search> [version:<vX.X>]`** *(Admin+)* — switches the server-wide default
  persona. `version` narrows the autocomplete suggestions to browse a specific batch
  rather than needing to already know a name.
- **`my set id:<search> [version:<vX.X>]`** *(Normal)* — sets *your own* personal
  persona pick, independent of the server default. Only affects you.
- **`my current`** *(Normal)* — shows your personal pick, or explains you're on the
  server default if you haven't set one.
- **`my clear`** *(Normal)* — removes your personal pick, reverting you to the server
  default.

### `/clear` — Normal

Clears conversation memory (the AI's short-term context) for the current channel.
Chat logs are untouched — this only affects what the AI itself "remembers" of the
recent back-and-forth, not the permanent record `/logs` reads from.

### `/trigger` — Admin+

Keyword-triggered canned replies, independent of the AI.

- **`add keyword:<text> reply:<text>`** — adds a reply for a keyword (a keyword can
  have multiple replies; one is chosen at random when triggered).
- **`remove keyword:<text> [index:<n>]`** — removes one specific reply by index, or
  the entire keyword (and all its replies) if no index is given.
- **`list [keyword:<text>]`** — every keyword, or every reply for one specific keyword.

Matching is whole-word, case-insensitive (a regex word-boundary check, not a bare
substring match — "cat" won't fire on "concatenate"). Triggers only fire on direct
engagement (mention, DM, reply-thread continuation, or inside the open channel) — never
on ambient `RESPOND_TO_ALL` messages.

### `/auth` — Owner only

- **`add user:<user> role:<Normal|Admin>`** — authorizes a user.
- **`remove user:<user>`** — revokes authorization entirely.
- **`set-role user:<user> role:<Normal|Admin>`** — changes an already-authorized
  user's level.
- **`list`** — every authorized user and their role, plus who the Owner is.

### `/provider` — Normal (mixed)

- **`list`** *(Normal)* — every chat provider and its default model, with the active
  one marked.
- **`models`** *(Normal)* — the free/default model list for the currently active chat
  provider.
- **`set name:<provider> [model:<text>]`** *(Admin+)* — switches the active chat
  provider (and optionally model). Clears all conversation history, since history
  format/context isn't guaranteed compatible across providers.
- **`model name:<text>`** *(Admin+)* — switches just the model on the current
  provider. Also clears history.
- **`image list`** *(Normal)* — every image provider and its default model.
- **`image set name:<provider> [model:<text>]`** *(Admin+)* — switches the active
  image provider.

### `/reload` — Admin+

Clears all conversation memory (every channel, every persona), re-fetches custom app
emojis, and re-scans both `avatars/` and `backgrounds/` for new/changed files. Run
this after uploading new avatar or background art, or new custom emoji, without
wanting to fully restart the bot.

### `/remind` — Normal (mixed)

- **`set ...`** *(Normal)* — creates a reminder: a message, a time (hour/minute in the
  user's timezone), whether it repeats daily or fires once, optionally which persona
  delivers it and whether the delivery text is the literal message or an AI-flavored
  in-character version of it.
- **`list`** *(Normal)* — your own reminders.
- **`cancel ...`** *(Normal)* — cancels one of your reminders.
- **`timezone ...`** *(Admin+)* — sets a user's timezone. Notably gated higher than
  the rest of this command — deliberately, to prevent timezone confusion from being
  self-serviceable in a way that could make reminders fire at unexpected times without
  oversight.

Delivery: a background scheduler checks every 30 seconds; when a reminder's
hour/minute matches the current time in its timezone and it hasn't already fired
today, it fires — styled as the chosen persona via webhook when possible (falls back
to a plain `@mention` reply, or a DM if the original channel is gone).

### `/welcome` — Admin+

New-member greetings. The greeting itself always comes from the fixed "neutral"
persona (currently Asuna — see [Personas](#personas)) regardless of whatever persona
is the active conversational default, so a new member's first impression stays
consistent even if the server's default has been switched for some unrelated reason.

- **`set-channel channel:<#channel>`** — where greetings post.
- **`toggle enabled:<true|false>`** — on/off.
- **`status`** — current configuration.
- **`test`** — sends a preview greeting using yourself as the "new member," so you can
  see what it looks like without waiting for an actual join.

### `/affection` — mixed, deliberately not merged across tiers

- **`mood persona:<search>`** *(Normal)* — a casual, number-free read on how a persona
  feels about you. Posts **publicly** (not ephemeral) as a generated image card — see
  [Mood Cards](#mood-cards) — with a rating-prompt dropdown attached underneath.
- **`view persona:<search> [user:<user>]`** *(Admin+)* — the exact numeric score.
  Defaults to your own; specify `user` to check someone else's. Ephemeral (only you
  see it).
- **`reset user:<user> persona:<search>`** *(Owner)* — resets someone's standing with
  a persona back to neutral (deletes the record entirely, rather than setting it to
  literal 0 — functionally identical, but means no stray "0-score" record lingers).
- **`set user:<user> persona:<search> value:<integer>`** *(Owner)* — directly
  overwrites a score (e.g. `-67`) without needing to accumulate real messages.
  Primarily a testing tool. Clamped to ±1,000,000.

`mood` is intentionally public and casual; `view`/`reset`/`set` are intentionally
private and precise. This split is deliberate — see [The Affection
Meter](#the-affection-meter) for why.

### `/openchannel` — Admin+

Designates one channel where *anyone* can talk to the bot, authorized or not — a
frictionless trial experience. Only the server-wide default persona responds there
(personal picks and thread-continuation are both ignored, so behavior stays
predictable for people who've never used the bot). Slash commands are **not**
affected by this — unauthorized users still can't run commands anywhere, including
in the open channel; only plain conversational messages get the bypass.

- **`set channel:<#channel>`**, **`clear`**, **`status`**.

### `/help` — Normal

Lists every command available to the caller's role, with descriptions. Ephemeral —
only the requester sees it.

---

## Personas

Each persona is a single TypeScript file under `src/personas/`, all following the same
schema (`Persona` in `src/types.ts`):

| Field | What it's for |
|---|---|
| `id` | Unique internal key. |
| `name`, `source` | Display name and source material — shown everywhere the persona appears. |
| `description` | User-facing bio, third person, shown in `/persona current`, `/persona my current`, `/persona profile`. |
| `traits` | Short list of adjectives — feeds both the AI's system prompt and the affection-rating classifier. |
| `tone`, `rules` | The actual behavioral specification: how the character talks, explicit dos and don'ts for staying in voice. |
| `extraContext` | Additional lore/background not covered by the description. |
| `avatarKey` | Filename (no extension) to find in both `avatars/` and `backgrounds/` — deliberately the same key in both folders. |
| `addedInVersion` | Which release introduced this persona — powers the "browse by version" autocomplete filter. |
| `status` | Optional. Sets the bot's Discord "Playing ..." presence text while this persona is the active server default. |
| `responseLengthOverride` | Optional, rare. Replaces the default "keep it to 1-5 sentences" rule for personas where that genuinely doesn't fit — e.g. a character whose whole identity involves speaking in short, flat fragments. |
| `moodPhrases` | Optional. Per-level (-5..5) overrides for what `/affection mood` says — see [The Affection Meter](#the-affection-meter). |
| `affectionSensitivities` | Optional. Extra context for the rating classifier about what specifically pleases or bothers this character, beyond what traits/description already convey. Every persona currently has one (as of v3.12) — still optional in the schema for whatever gets added next. |

**Adding a persona**: create the file, add two lines to `src/personas/index.ts`
(import + map entry), redeploy — it shows up in `/persona list`, `/persona set`,
`/persona my set`, and `/persona profile` automatically. Add matching entries to
`avatars/README.md` and `backgrounds/README.md` so the expected filename is
documented. No avatar or background art is required for a persona to function — a
missing avatar falls back to a generated initial-letter badge in mood cards and
Discord's default webhook icon elsewhere; a missing background falls back to a
generated gradient.

**The neutral persona**: one persona (`NEUTRAL_PERSONA_ID` in `constants.ts`,
currently Asuna) is hardcoded as the fixed voice for welcome messages, regardless of
whatever the server's active conversational default is. Chosen for being the most
broadly even-keeled personality in the roster.

## The Affection Meter

A private, per-(user, persona) score reflecting how that character has come to feel
about that specific person, based on how they've actually been treated over time —
not something either party sets directly (aside from the Owner-only testing
command).

**Mechanics**: every message sent to a persona is rated by a separate, dedicated AI
call — a strict, neutral sentiment classifier, not the persona itself — from -100 to
+100. This is genuinely **persona-aware**: the classifier is told which character is
being addressed (name, traits, description, and — as of v3.12, for every persona in the
roster — specific notes on what actually pleases or bothers them) so the same message can
rate differently depending on who it was sent to. Frieren, for instance, is explicitly
noted as unbothered by jokes about her small stature but genuinely bothered by jokes
about her age — a generic classifier would have no way to know that distinction.

The classifier is deliberately instructed not to default to a positive score out of
politeness (a real bias some models have), and to be skeptical of bare, unembellished
declarations like "I love you" with no other substance — those earn only a mild
positive score, since they cost nothing to say. Positive deltas also get scaled down
by a repetition-dampening factor if they're too similar to that same user's recent
messages toward that same persona (closes the "just spam a nice phrase" exploit
without touching negative deltas, since there's no equivalent exploit on that side).

That delta accumulates into a running score, clamped to ±1,000,000. The score maps to
a level from -5 to +5 via fixed magnitude thresholds (500 / 2,500 / 10,000 / 30,000 /
100,000), and **decays over time** — faster at low levels (a mild impression fades in
days), dramatically slower at high levels (level 5, in either direction, is meant to
feel close to permanent, since reaching it takes sustained genuine effort).

**Two very different faces of the same system**:
- `/affection mood` (Normal, public) — a casual, number-free vibe check. Never shows
  the actual score, just a qualitative phrase ("Frieren seems to have a decent
  impression of you") baked into a generated image card, plus an optional
  community-rating prompt. This is the fun, shareable side.
- `/affection view` (Admin+, private) and `/affection reset`/`/affection set` (Owner,
  private) — the precise numeric administration side, for auditing, debugging, or
  testing.

**Per-persona customization**: the phrase `/affection mood` shows at each level can be
overridden per character via `moodPhrases`, and only for the levels that need it —
everything else falls back to the shared default phrase for that level. This exists
because a single generic phrase set doesn't fit every character. As of v3.13, every
persona in the roster has at least a customized level-5 and level -5 (their most
distinctive high and low points) written for that specific character's voice, with a
handful going further:
- **Yor Forger** is canonically married — her top levels (3-5) read as fierce,
  protective, found-family warmth rather than romance, since "smitten" doesn't fit
  her circumstances.
- **Bocchi** has a full custom set at every level — her defining trait (crippling
  social anxiety) changes the *texture* of every level, not just the extremes. Her
  rock-bottom level literally sends `.......` — she's too overwhelmed to form words —
  and even her top level stays shy and internal rather than confidently romantic.
- **Makima, Echidna, Jibril** reframe what "high affection" means for a character
  whose personality doesn't fit straightforward sweet devotion — possessive control,
  intellectual fascination, and earned loyalty respectively, instead of romance.
- **Mikasa, Power, Umaru** get a fuller 4-level arc (5, 4, -4, -5) where their
  personality is distinctive enough at multiple points to earn it — singular devotion
  breaking through stoicism, chaotic pride, and a private-self/public-self divide,
  respectively. **Tatsumaki** gets three positive levels (3, 4, 5) rather than a
  symmetric arc — her prickly, deny-everything energy is distinctive on the way up;
  the generic negative phrasing already reads close enough to her default demeanor
  that it didn't need replacing.
- **Mashiro Shiina**'s overrides stay short and flat, matching her established
  `responseLengthOverride` voice.

The remaining ~60 personas each have a level-5 and level -5 written specifically for
their own voice and circumstances — a tsundere's "smitten" reads differently from an
overwhelmed dragon-maid's, which reads differently from a deadpan hacker's — even
where the underlying sentiment (delighted vs. devastated) is the same shape.

## Persona Ratings

A separate system from the above — this tracks how *lore-accurate* the community
thinks a persona feels, not how the persona feels about anyone. One rating (1-10) per
(user, persona) pair; rating again overwrites your previous rating rather than
stacking a new one.

**Two ways to rate**:
1. `/persona rate persona:<search> rating:<1-10>` — direct, anytime.
2. An optional dropdown prompt that appears automatically under both `/affection
   mood` and `/persona profile`. Anyone who sees the message can use it — it isn't
   scoped to whoever originally ran the command, since a lore-accuracy judgment is
   inherently a community thing. Using it (or ignoring it) is entirely optional.

**Where ratings show up**:
- `/persona profile` — average and count appear right in the embed's author line, next
  to the persona's name (e.g. "Frieren · ⭐ 8.7/10 (14 ratings)"). A persona with no
  ratings yet shows "⭐ Not yet rated" rather than a blank or a misleading zero.
- `/persona leaderboard` — top 20 by average (ties broken by rating count), posted
  publicly. Personas with zero ratings simply don't appear on it.

## AI Providers

**Chat**: Gemini, Groq, OpenAI, Anthropic, Mistral, Cohere, Ollama (local). Switch with
`/provider set`. `PROVIDER_DEFAULTS` in `constants.ts` lists the default model per
provider; `/provider model` overrides just the model on whichever provider is active.
Switching provider or model clears all conversation history (context/format isn't
guaranteed portable between providers).

**Vision (image understanding)**: Gemini, OpenAI, and Anthropic support images
natively in their chat API. If the active chat provider doesn't (Groq, Mistral,
Cohere, Ollama), the bot transparently falls back to whichever vision-capable
provider *does* have a configured API key, describes the image neutrally and
objectively first, then relays that description into the conversation as extra
context — so `/image analyze` and image attachments in normal chat keep working
regardless of which provider is currently active for text.

**Image generation**: Gemini (native image-output models, not the separate Imagen
API), Together AI (FLUX), OpenAI (DALL-E 3), Stability AI, or `none` (disabled).
Switch with `/provider image set`.

**Rate limiting**: a shared per-minute ceiling (`CHAT_RATE_LIMIT_PER_MINUTE`, default
14) applies across *every* outgoing call to the active chat provider — main replies,
one-shot completions (log Q&A, welcome messages, reminder flavor text), and the
affection classifier all funnel through the same guard, so none of them can
collectively exceed it. Once tripped, new calls are refused immediately rather than
queued, deliberately trading a slightly worse user experience (a friendly "give me a
sec" message) for never actually hitting the provider's own hard rate limit (which
can mean a real, longer block).

**Retries**: transient errors (503/overloaded, 429/rate-limited) get retried with
short backoff; anything else fails immediately rather than retrying something that
won't succeed on a second attempt.

## Persona Identity & Webhooks

Conversational replies are sent through a Discord webhook styled with the persona's
name and avatar, not as the bot's own account — this is what makes it read as the
character actually being in the conversation. One webhook is created (and cached) per
channel/parent the first time it's needed.

**Where this works**: normal text channels, announcement channels, voice channel text
chat, and threads (by routing through the thread's parent channel's webhook with the
thread specified at send time — threads don't own a webhook of their own). If none of
that's available (e.g. a DM, or a channel type with no webhook support), it falls back
to a plain reply under the bot's own identity instead of failing silently.

**Reply-thread continuation**: replying to any message a persona sent (via its
webhook) continues talking to *that specific character*, even if the server's active
default has since been switched — the bot remembers which persona sent which message
(in memory, not persisted across restarts) and a reply resolves against that instead
of the current default. This is a different concept from Discord's own "Thread"
channel type, despite similar naming in the codebase — a conversation can
continue-as-a-thread inside any channel type, independent of whether that channel is
itself a structural Discord Thread.

**"noper" — breaking character**: prefixing a message with `noper` (e.g. `noper
what's the boiling point of water in Fahrenheit?`) gets a plain, neutral AI answer
with no persona, no memories, no character voice — for quick factual questions
without derailing the roleplay. Always has to be re-typed; it never persists via
reply-threading. A raw-AI reply is styled under the current AI model's name (no
persona avatar), but still tracked so that a *later* reply *without* `noper` naturally
resumes whichever character was active before.

## Memory

Two kinds of facts a persona can "know" about someone, injected into the system
prompt:

- **Global** — known to every persona, about everyone. Managed with `/memory
  add-global`/`remove-global`.
- **Persona-scoped** — known only to one specific persona, about one specific user. A
  fact added while Rem is active is invisible to Asuna, and vice versa. Managed with
  `/memory add`/`remove`, always operating on whichever persona is currently the
  server-wide default.

Owner-only, deliberately — if any authorized user could add memories about
themselves, that would trivially let someone fabricate a favorable history, which
would undermine the entire point of a relationship system meant to reflect earned
behavior.

Don't confuse this with [Channel Awareness](#channel-awareness): Memory is
hand-curated facts *about a person*, scoped per-persona (or global) and never
expiring on their own. Channel Awareness is an AI-generated, auto-refreshing recap of
*recent conversation*, scoped per-channel and shared by every persona equally. A
persona can know a Memory fact about you from six months ago while having no idea
what was said five minutes ago in a channel it wasn't part of — the two systems solve
different problems.

## Keyword Triggers

Server-configured (`/trigger`, Admin+) keyword → canned reply mappings, checked before
the AI is invoked at all, and only on direct engagement (mention, DM, thread
continuation, or the open channel) — never on ambient `RESPOND_TO_ALL` messages.
Matching is whole-word and case-insensitive. A keyword can have multiple possible
replies; one is picked at random each time it fires.

## Reminders

Personal, per-user reminders (`/remind`) with an hour/minute in the user's own
timezone, either one-time or daily-repeating, optionally delivered as an
AI-generated in-character message from a chosen persona rather than the literal text
verbatim. A background scheduler checks every 30 seconds for anything due to fire.
Delivery prefers the persona-styled webhook (same thread/voice-channel support as
normal chat), falls back to a plain `@mention`, and falls back again to a DM if the
original channel is no longer reachable.

## Welcome Messages

New-member greetings (`/welcome`, Admin+), generated fresh each time by AI in the
voice of the fixed neutral persona — not a static template — so greetings still feel
personal and in-character while staying consistent regardless of whatever persona is
the current conversational default.

## Open/Trial Channel

One designated channel (`/openchannel`, Admin+) where anyone can talk to the bot
without being on the authorized-users list — a zero-setup way to let people try it out.
Deliberately narrow in scope: only the server-wide default persona responds there
(no personal picks, no thread-continuation, so the experience stays predictable),
and slash commands are entirely unaffected — unauthorized users still can't run any
command anywhere, including inside the open channel itself.

## Chat Logs

Every exchange is appended to a per-channel `.jsonl` log (`data/logs/<channelId>.jsonl`)
regardless of anything else — this is a permanent record, separate from and
unaffected by `/clear` (which only touches the AI's short-term conversational
memory). `/logs recent`/`search`/`ask` read from it; `ask` runs a dedicated AI query
explicitly instructed to answer only from what's actually in the log. It's also the
raw material the rolling summary described in [Channel Awareness](#channel-awareness)
is periodically distilled from.

## Channel Awareness

**The problem this solves:** conversation memory (`ai/history.ts`) is keyed
`channelId:personaId` — scoped to one specific persona in one specific channel. A
persona that's never spoken in a given channel before starts from a completely blank
slate, even if other personas (or the raw user) have been chatting there for weeks. A
persona in that position doesn't say "I don't know" — it stays in character and fills
the gap with something plausible-sounding drawn from its own show's lore, which reads
as confidently making things up (e.g. asked "what's he talking about?" with zero real
context, a persona might guess based on its own backstory rather than the actual
conversation, which had nothing to do with it).

**The fix:** one compressed, persona-agnostic rolling summary per channel, persisted
in `data/channel_context.json` and injected into *every* persona's system prompt
(`ai/channelContext.ts` → `ai/promptBuilder.ts`) — so any persona, dropped in cold,
still has an accurate, if brief, picture of what's actually been going on.

**Why a summary and not just more raw history:** the summary — not raw log lines — is
what gets sent on every single reply, and its length is capped (~130 words, with a
hard character-limit backstop even if the model ignores that instruction), so the
per-message token cost stays flat regardless of how old or busy a channel gets.
Naively injecting the last N raw messages on every reply would make that cost grow
without bound, and would recur on every message rather than occasionally.

**How the summary refreshes:** a lightweight in-memory counter (deliberately not
persisted — same tradeoff `ai/history.ts` already makes; losing it on restart just
means the next refresh takes one extra interval) tracks new log lines per channel.
Once `CHANNEL_SUMMARY_INTERVAL` (default 8) new lines accumulate — or just 4, for a
channel's very first summary, so cold-start channels aren't left blind for long — a
single one-shot AI call runs in the background, fire-and-forget, same pattern as the
affection classifier: it never blocks the reply that triggered it, and a failure
(rate limit, provider error) is caught and silently skipped rather than surfaced,
since a stale-but-present summary is strictly better than crashing the actual
in-character reply over a side feature. That call takes the existing summary plus the
most recent ~30 raw log lines and produces a fresh, complete, merged summary — it's
told to compress and fold in new information, not just append to what's there.

**On-demand precision:** on top of the always-on summary, a cheap regex check (no AI
call) looks for "catch me up" style phrasing — "what's he talking about", "what did I
miss", "catch me up", "recap", and similar. When it matches, that single reply also
gets a literal excerpt of the most recent ~20 raw log lines appended to its prompt,
so specific questions get grounded in the real transcript rather than the lossy
summary. This only fires on messages that look like they're asking, so it doesn't add
cost to ordinary chat.

**Commands:** `/logs summary` shows the current rolling summary for the channel;
`/logs forget` resets it (the permanent log is untouched — see [Chat
Logs](#chat-logs)).

**Configuration:** `CHANNEL_CONTEXT_ENABLED` (default `true`) turns the whole feature
off if you'd rather not have the extra background AI calls; `CHANNEL_SUMMARY_INTERVAL`
(default `8`) controls how many new messages accumulate between refreshes — lower is
fresher but calls the AI more often, higher is cheaper but slightly staler. See
`env.ts` for both.

**What this deliberately doesn't do:** it isn't a replacement for `/logs ask`, which
does a deep, on-demand, exact-quote-capable Q&A pass over the *entire* log for a
specific question, run explicitly and shown only to whoever asked (ephemeral). Channel
Awareness is the opposite trade-off — always-on, ambient, and intentionally shallow —
optimized for "don't be clueless," not "answer anything about this channel's entire
history." For that, `/logs ask` is still the right tool.

## Permissions & Roles

Three tiers, `Role` enum in `types.ts`: `OWNER` (3) > `ADMIN` (2) > `USER` (1) > `NONE`
(0, unauthorized). Resolution order (`permissions/roles.ts`): the `OWNER_ID` env var
always wins if it matches; otherwise looked up in the authorized-users store
(`/auth`), seeded on first run from the `AUTHORIZED_USERS` env var (all seeded as
Normal). Every command declares a `minRole` — the floor an interaction must clear
before `execute()` is even called. Several commands additionally gate specific
subcommands more strictly than their own floor (see the [command
reference](#complete-command-reference) above) — this is checked inline, at the top of
that subcommand's own code, not automatically.

## Mood Cards

The image behind `/affection mood`: the persona's avatar centered in a circular
frame over a background (matched to the persona by the same filename key as their
avatar), with the mood phrase on a frosted/blurred glass panel underneath. Rendered
with `@napi-rs/canvas` (chosen specifically because it ships prebuilt binaries and
needs no system Cairo/Pango packages, unlike the older `node-canvas`, which matters
on a minimal Railway container). Canvas is 1920x1080, matching typical desktop
wallpaper resolution 1:1 if that's the size of your background images — no cropping
needed. Text uses a bundled Poppins font (`assets/fonts/`) rather than relying on
whatever fonts happen to be installed on the host.

If a persona doesn't have a background image yet, a generated gradient (tinted to the
mood's accent color) is used instead — the command never fails outright for missing
art. Each mood level gets a distinct accent color, interpolated between a cool
negative anchor, a neutral anchor, and a warm positive anchor based on the level's
magnitude.

`/persona profile` uses the *raw, unedited* background file directly (no avatar
composited on top, no text) — a different, simpler treatment from the mood card,
by design.

## Data Storage

Everything under `data/` (gitignored, created automatically on first write):

| File | Contents |
|---|---|
| `authorized.json` | userId → role (`normal`/`admin`) |
| `state.json` | Active chat/image provider+model, active server-wide persona |
| `user_personas.json` | Per-user personal persona pick (`/persona my`) |
| `memories.json` | Global facts + per-persona-per-user facts |
| `triggers.json` | keyword → reply list |
| `reminders.json` | All reminders + per-user timezones |
| `welcome.json` | Welcome channel + enabled flag |
| `open_channel.json` | The designated open channel id, if any |
| `affection.json` | Per (user, persona) score + last-updated timestamp |
| `persona_ratings.json` | Per (user, persona) lore-accuracy rating |
| `channel_context.json` | Rolling cross-persona summary per channel (see [Channel Awareness](#channel-awareness)) |
| `logs/<channelId>.jsonl` | Permanent chat log, one JSON object per line |
| `logs/system/<date>.log` | Optional system log file, only written if `LOG_TO_FILE=true` |

All of it goes through `store/json.ts`'s shared `readJSON`/`writeJSON` (missing file →
returns the given default; write is a plain synchronous `JSON.stringify` to disk — no
external database, by design, given the scale this bot operates at).

## Configuration Reference

See `env.ts` for the authoritative, always-current list — every variable, its default,
and a comment explaining it. Only `DISCORD_TOKEN` and `CLIENT_ID` are required;
everything else (API keys, behavior tuning, error message overrides) is optional with
a sensible default, and a missing provider API key just means that provider is
unavailable rather than the bot failing to start.

## Troubleshooting

**Persona avatars aren't showing in webhook messages** — check `/status`'s "Avatar
hosting" line. Webhook avatars need a publicly reachable URL; set `PUBLIC_URL`
explicitly, or generate a Railway domain (Networking settings → Generate Domain) and
`RAILWAY_PUBLIC_DOMAIN` will be picked up automatically. This doesn't affect mood
cards or profile images — those attach files directly and need no public hosting.

**A command doesn't show up in Discord** — commands register in bulk on every bot
startup (`registerCommands()` in `events/ready.ts`). If you just deployed a change,
restart the bot (or wait for the deploy to restart it) rather than expecting a hot
update. Discord's own client-side command cache can also lag a few minutes even after
successful registration.

**Image generation says it's disabled** — check `/provider image list`; if the active
image provider is `none`, an Admin needs to `/provider image set` a real one.

**A persona shows a plain letter instead of their avatar** — no matching file exists
yet in `avatars/` for that persona's `avatarKey`. Check `avatars/README.md` for the
exact expected filename, add the file, then `/reload` (Admin+) to pick it up without a
full restart.
