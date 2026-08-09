# CLAUDE.md

Reference doc for AI assistants (Claude Code or otherwise) working in this repository.
Read this before making changes — it encodes real mistakes made and fixed during this
project's development, not just a description of the architecture. If you're a human,
see `DOCUMENTATION.md` for the same territory in a more narrative form, or `README.md`
for setup.

## What this is

A Discord bot (`discord-persona-bot`, currently v3.11.0) that lets a server chat with
switchable anime/game character personas (71 of them, growing) via an LLM, styled with
per-character Discord webhook names/avatars. Also does image generation/analysis,
reminders, keyword triggers, memory, welcome messages, an affection/relationship meter
per user-persona pair, and a community lore-accuracy rating system. TypeScript,
discord.js v14, Node ≥18, deployed on Railway (Nixpacks builder). CommonJS module
system (`tsconfig.json`: `"module": "CommonJS"`) — **not ESM**, see the module-system
pitfall below before writing any throwaway test scripts.

Single owner (`OWNER_ID` env var) + role-gated Admin/Normal users layered on top
(`/auth`). No database — everything persists as JSON files under `data/` (gitignored,
created at runtime) via `src/store/json.ts`'s `readJSON`/`writeJSON`.

## Before you touch anything: verification checklist

Every one of these has caused a real, shipped bug in this project at some point. Don't
skip them.

1. **`npm run typecheck`** after every change. Non-negotiable, but insufficient by
   itself — it catches TypeScript errors, not runtime API constraint violations (see #2).
2. **Actually construct every command and inspect the JSON**, don't just trust that
   `tsc` passing means Discord will accept it. TypeScript has no idea that Discord
   enforces a **100-character hard cap on every command/subcommand/subcommand-group
   description** and a **32-character cap on every name** — a `string` type looks fine
   to the compiler either way. A too-long `/reload` description once crashed the
   entire bot on every single startup (the validation throws synchronously at module
   import time, before any try/catch in the codebase can catch it — see
   `src/commands/reload.ts` git history). The check that would have caught it:
   ```ts
   // run with: npx tsx some_file.ts  (see module-system note below for why .ts not .mts)
   for (const name of [/* every command filename, no extension */]) {
     const mod = await import(`./src/commands/${name}.ts`);
     const json = (Object.values(mod)[0] as any).data.toJSON();
     // walk json.options recursively, check every .name.length <= 32 and .description.length <= 100
   }
   ```
   Do this for every command whose builder you touched, not just the one you think
   might be affected.
3. **If you touched anything Discord-select-menu related**: 25 options max per select
   menu, each option's `label` and `description` ≤ 100 chars, `customId` ≤ 100 chars.
   Same discipline as #2 — inspect `.toJSON()` directly.
4. **Actually run the code path you changed**, not just typecheck it. This project has
   image compositing (`moodCard.ts`), a scoring/decay system (`affectionStore.ts`),
   and a rating aggregator (`ratingStore.ts`) — all of these have non-obvious runtime
   behavior (exact score thresholds, panel-height math, clamping) that only a real
   execution catches. Write a throwaway script, run it, read the output or view the
   generated image, then delete the script.

## Module-system pitfall (easy to lose an hour to this)

This project is CommonJS. If you write a quick `.mts` test script to get convenient
top-level `await`, and that script imports project `.ts` files, you can end up with
**two separate instances of the same module** — one loaded via Node's native ESM
loader (forced by the `.mts` extension) for your script's own imports, and a different
one loaded via the CJS path for everything the project's own `.ts` files import from
each other. Module-level mutable state (caches, in-memory maps) then silently doesn't
share between the two, and you'll see things like a cache populated in your test
script's copy of a module reading as empty from the "real" copy that the code under
test actually uses.

**Fix:** write test scripts as plain `.ts` files with an async IIFE instead of `.mts` +
top-level await:
```ts
// test.ts, not test.mts
async function main() {
  // ... your test, using real project imports
}
main();
```
Run with `npx tsx test.ts`. This matches how the app itself actually loads (`tsx watch
src/index.ts` in dev, compiled CJS via `node dist/index.js` in prod) — no `.mts` file
exists anywhere in `src/`.

## Shell/commit-message pitfall

Backticks in a `git commit -m "..."` message get interpreted by bash as command
substitution — a lone `` `set` `` in a message can literally execute `set` (a bash
builtin that dumps every environment variable) and splice the output into your commit
message. This project's commit messages use backticks constantly (for code/command
references), so: **write the message to a file and commit with `git commit -F
file.txt`**, never inline `-m` with a message containing backticks. Verify with `git
log -1 --format="%B"` after committing, not just trust it worked.

## Directory map

```
src/
  index.ts              Entry point: env validation, HTTP server (/health, /avatars/*), Discord client + intents, event wiring
  env.ts                All env vars, typed getters with defaults
  constants.ts           Paths, provider catalogs/defaults, NEUTRAL_PERSONA_ID
  types.ts               Every shared interface/type — Persona, BotState, store shapes, Role enum
  logger.ts               Leveled console + optional file logging

  commands/              One file per slash command (SlashCommand: {data, minRole, execute, autocomplete?})
    types.ts              The SlashCommand interface itself
    registry.ts           commands[] + commandMap, registerCommands() (bulk PUT-overwrites Discord's command list — see below)
    baseCommands.ts        Array of every command except /help (help.ts imports this array, so it lives separately to dodge a circular import)

  personas/               One file per persona (71 currently) + index.ts (PERSONAS map, listPersonas/getPersona/searchPersonas/listVersions)

  ai/
    promptBuilder.ts       Builds the full system prompt from persona + memories + affection + emoji context
    chatRouter.ts          Dispatches to the active provider; also builds the "noper" (raw AI) path and one-shot completions
    imageRouter.ts, visionRouter.ts   Same dispatch pattern, for image gen and vision
    affectionClassifier.ts Rates message tone, now persona-aware (see below)
    history.ts              In-memory conversation history, keyed "channelId:personaId"
    rateLimiter.ts, retry.ts   Shared per-minute call ceiling + transient-error retry, used by every provider call
    spamGuard.ts            Repetition dampening for the affection meter
    providers/               One file per backend (gemini, openaiCompatible [groq/openai/ollama], anthropic, mistral, cohere, together, stability)

  store/                  One file per persisted concern, all using store/json.ts's readJSON/writeJSON. See "Adding a new store" below for the pattern.

  webhooks/
    webhookManager.ts       sendAsPersona/sendAsRawAI — the actual "speak as this character" mechanism. isWebhookCapableChannel() lives here (canonical, see pitfall below).
    avatarResolver.ts        Scans avatars/, serves them over HTTP for Discord's webhook avatar_url, also exposes local file paths for canvas work
    threadTracker.ts         In-memory map: sent message id -> {personaId, channelId}, so replying to a character's message continues THAT character

  features/                Cross-cutting logic that doesn't fit commands/ or store/: reminders scheduler, welcome text, chat-log Q&A, moodCard image rendering, ratingPrompt component builder

  events/                  Discord.js event handlers: ready, interactionCreate, messageCreate, guildMemberAdd
  permissions/roles.ts      Role resolution (OWNER_ID env > authStore > NONE) and hasRole/isAuthorized checks
  emoji/appEmojis.ts        Custom app emoji cache + :name: resolution + occasional random reactions
  utils/                    chunk (message splitting), friendlyError, humanize, interactionReply (replyChunked), time (timezone math)

avatars/, backgrounds/     User-supplied art, gitignored contents, README.md in each documents the filename convention (must match a persona's avatarKey)
assets/fonts/               Bundled Poppins TTFs for canvas text rendering (see moodCard.ts) — bundled because a bare Railway container has no guaranteed system fonts
data/                       Runtime JSON stores, gitignored, created on demand
```

## Commands: the pattern

Every command file exports one `SlashCommand` (`{ data: SlashCommandBuilder, minRole:
Role, execute, autocomplete? }`). `commands/registry.ts` collects them all into
`commands[]` and does:
```ts
await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commands.map(c => c.data.toJSON()) });
```
This is a **full bulk overwrite**, not an incremental upsert. Removing a command from
`baseCommands.ts`'s array means it's gone from Discord on the *next* successful
`registerCommands()` call (which runs once per bot startup, in `events/ready.ts`) — no
separate deletion step needed. This is exactly how the v3.8 command consolidation
(`/imagine`+`/analyze` → `/image`, `/imgprovider` → `/provider image`, `/mypersona` →
`/persona my`) worked cleanly.

**Permission model**: `interactionCreate.ts` checks `hasRole(userId, command.minRole)`
as a *floor* before calling `execute()` — this is the ONLY automatic gate. Several
commands (`/affection`, `/persona`, `/provider`) have subcommands that need a
*stricter* role than the command's own floor (e.g. `/persona` is `Role.USER` overall
but `/persona set` needs Admin) — those do their own `hasRole()` check inline, at the
top of that specific subcommand's branch, and reply with a rejection + `return` if it
fails. Grep `hasRole` across `commands/` before assuming a multi-subcommand command's
top-level `minRole` tells you the whole permission story — it's only the floor.

**Subcommand groups**: Discord allows mixing bare subcommands and subcommand groups on
the same top-level command (verified directly against `@discordjs/builders`' type
signatures, not assumed — `SharedSlashCommandSubcommands` has both `addSubcommand` and
`addSubcommandGroup` returning the same chainable type). `/persona` and `/provider`
both do this: original subcommands stay bare (zero relearning for existing muscle
memory), newly-merged-in functionality becomes a named group (`/persona my set`,
`/provider image set`). `interaction.options.getSubcommandGroup()` returns `null` for
bare subcommands, not a throw, when called with no args or `false`.

**Autocomplete**: one handler per command file, keyed to the command not to a specific
option — Discord routes the interaction to whichever command's `autocomplete` function
regardless of which option/subcommand/group is currently focused, and
`interaction.options.getFocused()` just returns whatever the user's currently typing
into, agnostic of the field name. If two different subcommands both want "search
personas by name" behavior, one handler covers both — check `persona.ts`'s single
handler serving both the bare `set` and the grouped `my set` options.

## Personas

`src/types.ts`'s `Persona` interface is the schema; every field's own doc-comment
explains intent, worth reading directly. Quick field map:

| Field | Required | Purpose |
|---|---|---|
| `id` | yes | Unique key in the `PERSONAS` record. camelCase convention. |
| `name`, `source` | yes | Display name, source material — shown constantly across commands. |
| `description` | yes | User-facing bio (shown in `/persona current`, `/persona my current`, `/persona profile`). Third person, ~60-100 words typically. NOT the same thing as the system prompt. |
| `traits` | yes | Short adjective list, fed into both the system prompt and the affection classifier's character profile. |
| `tone`, `rules` | yes | The actual roleplay behavior spec — voice, speech patterns, explicit dos/don'ts. This is what most shapes how the character actually talks. |
| `extraContext` | conventionally present (optional in the type) | Lore/background not covered by description. Every existing persona file has this. |
| `avatarKey` | yes | Filename stem to look up in `avatars/` and `backgrounds/` — same key, both folders, intentionally (see `getAvatarFilePath`/`getBackgroundFilePath`). |
| `addedInVersion` | yes | Powers the `version:` autocomplete filter in `/persona set`/`/persona my set`/`/persona list`. Purely organizational. |
| `status` | optional | Feeds `client.user.setPresence()` — the bot's "Playing ..." text — when this persona is the active server default. |
| `responseLengthOverride` | optional, rare (2-3 personas use it) | Replaces the default "1-5 sentences" rule entirely. Only for characters where that default genuinely doesn't fit (e.g. Mashiro Shiina, who canonically speaks in short flat fragments). |
| `moodPhrases` | optional | `Partial<Record<number, string>>`, keys -5..5. Overrides `/affection mood`'s generated text at specific levels only — unlisted levels fall back to the shared generic phrase. Use when "smitten"/"resents you" framing doesn't fit (canon relationship status, extreme social anxiety, a character who doesn't process affection the normal way, etc). See Yor/Bocchi/Makima/Tatsumaki/Echidna/Jibril/Megumin/Mashiro for real examples of different reasons to override. |
| `affectionSensitivities` | optional | Freeform text fed into the classifier prompt alongside name/traits/description — for characters whose actual pet peeves/soft spots aren't obvious from traits alone (Frieren: unbothered by height jokes, genuinely bothered by age jokes). |

**Adding one**: create `src/personas/<id>.ts` exporting a `Persona`, import + add to
the `PERSONAS` map in `src/personas/index.ts` (A-Z by display name is the convention,
not a requirement — `listPersonas()` sorts at read time regardless). Then update
`avatars/README.md` and `backgrounds/README.md`'s tables with the expected filename.
No other file needs touching — `searchPersonas`/`listVersions`/autocomplete all derive
from the same `PERSONAS` map automatically.

**ID collisions are invisible to TypeScript.** `PERSONAS` is built as `{ [x.id]: x,
... }` — a computed-key object literal. Two personas accidentally sharing an `id`
silently means the second one overwrites the first in the map; nothing throws or
warns. Check `Object.keys(PERSONAS).length` against the number of personas you expect
after adding new ones if you're batch-adding several — this is exactly the kind of
gap that only shows up at runtime, and precisely why the v3.9 batch-add of 29 personas
verified this explicitly rather than trusting `tsc`.

## Affection system (`store/affectionStore.ts`)

Per (user, persona) score, `-1,000,000..1,000,000`, mapped to levels `-5..5` via
`LEVEL_BANDS` (thresholds: 500 / 2,500 / 10,000 / 30,000 / 100,000, magnitude-based —
same thresholds for positive and negative). Each band has its own daily decay rate
(20% at level 1, down to 0.15% at level 5 — higher levels are deliberately
near-permanent). Decay is computed lazily on read (`getDecayedRecord`), not via a
background job — `score * (1 - dailyRate)^elapsedDays`.

Score changes come from `messageCreate.ts`'s `updateAffectionInBackground()`, which is
fire-and-forget *after* the reply is already sent (never blocks the user-facing
response) and calls `classifyMessageTone(userMessage, persona)` — an LLM call, not a
keyword heuristic, using a dedicated neutral classifier prompt that's explicitly told
which persona is being addressed (name/traits/description always; `persona.affectionSensitivities`
too, when set) so the same message can rate differently depending on who it was sent
to. Positive deltas get run through `spamGuard.ts`'s repetition dampening
(Jaccard-similarity-based) before being applied — negative deltas are left alone on
purpose, there's no "exploit" to close on the hostile side.

`getAffectionMoodPhrase()` checks `persona.moodPhrases?.[level]` before falling back to
the shared generic phrase map — this is the extension point, not something to modify
per-persona by editing the generic map itself.

`/affection set` (Owner-only) bypasses all of this via `setAffectionScore()` — a direct
overwrite, separate from the additive `applyAffectionDelta()` — for jumping straight to
a specific score during testing without accumulating real messages.

## Rating system (`store/ratingStore.ts`, `features/ratingPrompt.ts`)

Separate concept from affection — this is "how lore-accurate does this persona feel,"
community-wide, not "how does the character feel about one user." One rating (1-10)
per (user, persona) pair; re-rating overwrites rather than accumulating. `average`/
`count` are computed on read by scanning the store, not cached — fine at this scale
(dozens of raters × ~71 personas, not thousands).

This was the **first use of Discord message components (select menus) anywhere in this
codebase** — `interactionCreate.ts` has a dedicated `interaction.isStringSelectMenu()`
branch (checked before the chat-input-command branch) that parses the persona id back
out of a `customId` of the form `rate_persona:<id>` and records the rating. The
prompt itself (`buildRatingPrompt()`) is shared between `/affection mood` and `/persona
profile` rather than built twice. The select menu is deliberately not restricted to
whoever ran the original command — anyone who sees the message can use it, and using
it doesn't disable it for others.

## Webhooks / persona identity (`webhooks/webhookManager.ts`)

Persona replies in normal conversation are sent through a per-channel Discord webhook
(name = persona name, avatar = persona avatar) rather than as the bot's own identity —
this is what makes it look like the character is actually talking, not the bot
announcing on their behalf. Key things that are NOT obvious from the Discord API surface
without having actually checked:

- **Threads do not own a webhook.** `ThreadChannel`'s mixin explicitly excludes
  `fetchWebhooks` (confirmed in discord.js's own source, not assumed). Sending into a
  thread means resolving the webhook on `channel.parent` and passing `threadId` at
  send time — `resolveWebhookHost()` handles this.
- **Voice channels DO own a webhook directly**, same as a text channel — no special
  handling needed beyond including them in the type. This is easy to get backwards
  (voice channels feel like they "shouldn't" support a text-channel feature) —
  confirmed by checking whether `BaseGuildVoiceChannel`'s mixin excludes
  `fetchWebhooks`/`createWebhook` the way `ThreadChannel` does. It doesn't.
- **`isWebhookCapableChannel()` is the single canonical check** for "can we try the
  webhook path here" — exported from `webhookManager.ts`. Do not write a local copy
  in a new file. This check existing as two independent, silently-diverging copies
  (`messageCreate.ts` and `features/reminders.ts`) is exactly how reminders ended up
  missing thread/voice support for a while after chat itself was fixed — the fix was
  both restoring the missing support AND deleting the second copy so it can't
  re-diverge.
- Discord's webhook API has never supported native message replies
  (`message_reference`) — the practical substitute used here is prefixing the first
  chunk with an `@mention` of whoever's being responded to (`withMentionPrefix`).

**Thread continuation vs. Discord Thread channels** — these are unrelated concepts that
happen to share the word "thread" throughout this codebase's naming (`threadTracker.ts`,
`isContinuingThread`, "persona-thread replies"). Conversational thread-continuation
means: replying to a specific persona's webhook message resumes talking to THAT
character, tracked via `threadTracker.ts`'s in-memory `messageId -> {personaId,
channelId}` map. Discord Thread channels (`ThreadChannel`, the actual structural
channel type) are a completely separate axis — a conversation can continue-as-a-thread
inside a normal text channel, a voice channel, or a Discord Thread channel, independently.

## AI provider routing

`ai/chatRouter.ts`, `imageRouter.ts`, `visionRouter.ts` all follow the same shape: a
`switch (state.chatProvider)` (or `imageProvider`) dispatching to one of
`ai/providers/*.ts`, each exposing the same function signatures (`chat`,
`chatWithImage`, `complete`, `visionAnswer`, `generateImage`) but not literally sharing
an interface — just a convention. `openaiCompatible.ts` handles three backends (groq,
openai, ollama) through one file since they're all OpenAI-SDK-compatible endpoints,
differentiated by a `Backend` string param and different `baseURL`s.

Every actual outgoing call funnels through `ai/retry.ts`'s `withRetry()`, which itself
calls `ai/rateLimiter.ts`'s `guardChatRateLimit()` on every attempt (including retries)
— this is the single choke point enforcing `CHAT_RATE_LIMIT_PER_MINUTE` across every
call path (main replies, one-shot completions, the affection classifier, log Q&A,
welcome messages) for free, without each call site needing to remember to check it.

**Adding a new chat provider**: new file in `ai/providers/`, add the name to
`ChatProviderName` in `types.ts`, add a default model to `PROVIDER_DEFAULTS` in
`constants.ts`, add a case to the switch in `chatRouter.ts` (and `visionRouter.ts` if
it supports vision — also add to `NATIVE_VISION_PROVIDERS`), add to
`CHAT_PROVIDER_NAMES` (derived automatically from `PROVIDER_DEFAULTS`'s keys, no
separate edit needed there).

## Mood cards (`features/moodCard.ts`)

Canvas compositing via `@napi-rs/canvas` (skia-backed, prebuilt binaries — chosen over
`node-canvas` specifically to avoid needing system Cairo/Pango packages on Railway's
Nixpacks image). Canvas is 1920x1080 to match desktop-wallpaper-sized backgrounds 1:1.
Fonts (Poppins, bundled under `assets/fonts/`) are registered lazily on first render,
not at module load — bundled rather than relying on system fonts, since a bare
container has no guarantee of having any installed. Backgrounds are looked up by the
same `avatarKey` as the persona's avatar (`getBackgroundFilePath`, exported for reuse
by `/persona profile`, which shows the raw unedited file rather than compositing it).
Falls back to a generated mood-tinted gradient if no background file exists yet for
that persona — never hard-fails the command.

If you change canvas dimensions or layout constants, **re-render and actually look at
the output** (the `view` tool displays images) rather than reasoning about pixel math
in the abstract — this project's history includes redesigning the card from a 720x960
portrait to a 1920x1080 landscape layout, which required re-deriving avatar
size/panel width/font sizes/blur radius for the new proportions rather than
mechanically scaling by the width ratio (which would have overflowed vertically,
since the height only grew marginally while the width grew ~2.7x).

## Environment variables

See `env.ts` for the full typed list with defaults — don't duplicate that list here,
it'll drift. Required: `DISCORD_TOKEN`, `CLIENT_ID`. Everything else has a sensible
default or is optional (missing API keys just mean that provider/feature is
unavailable, checked at call time, not startup).
