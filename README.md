# Discord Persona Bot (v3 — TypeScript)

A full TypeScript rewrite of the Discord persona bot: switchable anime personas, a real role hierarchy, multi-provider AI (7 chat + 4 image providers, all with free tiers available), scheduled reminders, welcome messages, image analysis, and improved logging. Built for Railway.

This replaces the old single-file `bot.js` project entirely. See **[Migrating from v2](#migrating-from-v2)** at the bottom if you're upgrading.

---

## What's new in v3.6

| Area | What changed |
|---|---|
| Corrected persona | The persona previously mislabeled as "Yuki Suou" under the wrong source title has been fixed. Alya (the correct character for "Alya Sometimes Hides Her Feelings in Russian") was added properly, and Yuki Suou now exists as her own correctly-attributed persona from the same series |
| 16 new personas | See the updated roster below |
| Tighter affection permissions | `/affection view` now requires Admin+, `/affection reset` requires Owner |
| `/affection mood` | A casual, number-free way for anyone to check how a persona feels about them |
| Anti-farming measures | Repeated near-identical messages (e.g. spamming "I love you") now yield sharply diminishing returns, and the classifier itself is instructed to discount bare, unembellished declarations |
| Steeper decay curve | The highest levels (5 and -5) now decay far more slowly than before — reaching them takes real effort, so they're built to last |
| `/remind timezone` now Admin+ | Was previously self-service for any authorized user |
| Stricter Bocchi brevity | Her override now defaults hard to one short sentence or fragment, not an occasional exception |
| Documentation cleanup | Decorative emoji removed from this README |

## What's new in v3.5

| Area | What changed |
|---|---|
| **Affection meter** | Personas silently track how each person treats them and it colors their tone over time — see below |
| **Rate limit guard** | Refuses to make a call at all once it's close to your provider's per-minute cap, instead of risking a real rate-limit ban |
| **Memory → Owner-only** | Every memory command now requires Owner, and memories are scoped to whichever persona is currently active — letting anyone add memories defeated the point of *earning* affection |
| **`/openchannel`** | Designate one channel where anyone can talk to the bot, authorized or not — a no-setup trial experience |
| **A-Z persona sorting** | `/persona list` is alphabetical by default now (version filtering still works, just isn't the default view) |
| **Per-persona reply length** | Characters like Bocchi can override the standard "1-5 sentences" rule when it genuinely doesn't fit |

## What's new in v3.4

| Area | What changed |
|---|---|
| **Clearer replies** | Persona/raw-AI messages now @mention whoever they're responding to — Discord webhooks can't do native replies (platform limitation), this is the practical fix |
| **`/persona set` → Admin+** | No longer owner-exclusive |
| **Shorter replies** | Every persona now defaults to 1–5 sentences unless you ask for more — no more paragraph walls |
| **16 new personas** | See the updated roster below |
| **Personal personas** | `/mypersona` — each person can set their own default persona, independent of the server-wide one |
| **Smarter reminders** | Pick which persona delivers a reminder, with time suggestions via autocomplete |

## What's new in v3.3

| Area | What changed |
|---|---|
| **`noper` prefix** | Start any message with `noper` for a plain, unfiltered AI answer — no persona, no character voice, styled with the active model's name and Discord's default avatar |
| **`/help`** | Ephemeral, role-aware command list — shows only what you're allowed to use, with descriptions |

## What's new in v3.2

| Area | What changed |
|---|---|
| **Two new personas** | Marin Kitagawa (My Dress-Up Darling) and C.C. (Code Geass) join the roster |
| **Neutral default persona** | Asuna is now formally designated as the roster's most even-keeled personality — the starting active persona, and always the one behind welcome messages |
| **Simpler welcome messages** | No more custom templates or modes — greetings are always AI-written by the neutral persona; admins only pick the channel and toggle it on/off |
| **Credits** | Artwork attribution added at the bottom of this README |

## What's new in v3.1

| Area | What changed |
|---|---|
| **Webhook identities** | Persona replies now appear as the character — their own name and avatar — via Discord webhooks, not as "YourBot#1234" |
| **Reply-to-continue** | After one @mention, just reply to the character's message to keep the conversation going — no repeated @mentions needed |
| **Concurrent personas** | Different people can talk to different characters at once in the same channel; each reply-thread stays pinned to the persona that started it |
| **Custom avatars** | Drop images in `/avatars`, named to match each character — the bot serves and uses them automatically |

## What's new in v3.0

| Area | What changed |
|---|---|
| **Language** | Full TypeScript rewrite, modularized into focused files instead of one large `bot.js` |
| **Commands** | 100% slash commands (`/`) — no more `!prefix` commands |
| **Personas** | 8 curated anime personas, switchable live with `/persona set` (owner only) |
| **Roles** | Real hierarchy: **Owner → Admin → Normal**, each with different permissions |
| **Memories** | Any authorized user can add/remove; only Admin+ can *list* them |
| **Reminders** | `/remind` — schedule the bot to mention you at a specific time, in your own timezone |
| **Welcome messages** | Configurable per-server greeting for new members, template or AI-generated |
| **Image analysis** | `/analyze` — upload an image and ask the AI about it; also works automatically when you attach an image in normal chat |
| **Logging** | Structured logger with levels, plus a `/health` endpoint for uptime monitoring |
| **Reliability** | Automatic retry with backoff on overloaded/rate-limited providers, before falling back to a friendly error message |

Conversational behavior: **@mention the bot once, then just reply to its message to keep talking** — or DM it directly. No repeated @mentions needed.

---

## Project Structure

```
discord-persona-bot/
├── src/
│ ├── index.ts Entry point — client, health server, global error handlers
│ ├── env.ts Typed environment variable access
│ ├── constants.ts Paths + provider catalogs
│ ├── types.ts Shared TypeScript types
│ ├── logger.ts Structured logger
│ ├── store/ JSON-backed persistence (auth, memories, triggers, state, reminders, welcome, chat logs)
│ ├── permissions/roles.ts Role resolution (Owner/Admin/Normal)
│ ├── personas/ 8 persona definitions + registry (expandable)
│ ├── ai/
│ │ ├── promptBuilder.ts Builds the system prompt (persona + memories + emojis + safety)
│ │ ├── chatRouter.ts Dispatches to the active chat provider, retries, logs
│ │ ├── imageRouter.ts Dispatches to the active image provider
│ │ ├── visionRouter.ts Image analysis with reliable fallback
│ │ ├── history.ts Per-channel conversation memory
│ │ ├── retry.ts Transient-error retry wrapper
│ │ └── providers/ One file per AI provider
│ ├── emoji/appEmojis.ts Custom app emoji loading, resolution, reactions
│ ├── webhooks/ Persona webhook identities: creation, avatar hosting, reply-thread tracking
│ ├── features/ Cross-cutting logic: triggers, welcome, reminders, log Q&A
│ ├── commands/ One file per slash command + the registry
│ ├── events/ ready, interactionCreate, messageCreate, guildMemberAdd
│ └── utils/ chunking, friendly errors, time/timezone helpers
├── avatars/ Persona profile pictures (you supply these — see avatars/README.md)
├── data/ Auto-created at runtime (gitignored except .gitkeep)
├── package.json
├── tsconfig.json
├── railway.toml
└── .env.example
```

---

## Setup

### 1. Create/update your Discord bot

1. [Discord Developer Portal](https://discord.com/developers/applications) → your app (or **New Application**)
2. **Bot** tab → copy the **Token** → this is `DISCORD_TOKEN`
3. **General Information** tab → copy the **Application ID** → this is `CLIENT_ID`
4. Under **Privileged Gateway Intents**, enable **both**:
 - `MESSAGE CONTENT INTENT` (for chat)
 - `SERVER MEMBERS INTENT` (required for welcome messages)
5. **OAuth2 → URL Generator**:
 - Scopes: `bot`, `applications.commands`
 - Permissions: `Send Messages`, `Read Message History`, `View Channels`, `Attach Files`, `Add Reactions`, `Manage Webhooks` ← new, required for persona identities
6. Use the generated URL to (re-)invite the bot — re-invite even if it's already in your server, since the intents and `Manage Webhooks` permission need the updated set

### 2. Get your Discord user ID

Discord Settings → **Advanced** → enable **Developer Mode** → right-click your name → **Copy User ID**. This is `OWNER_ID`.

### 3. Add persona avatars (optional, but recommended)

Drop images into `avatars/`, named to match each character (see `avatars/README.md` for the exact filenames, e.g. `violet_evergarden.png`). Skip this and personas will still work, just with Discord's default webhook icon instead of a face.

### 4. Get API keys for the providers you want

| Provider | Free tier | Get a key |
|---|---|---|
| **Groq** (chat) | Free | [console.groq.com/keys](https://console.groq.com/keys) |
| **Gemini** (chat + image) | Free tier | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Together AI** (image) | Free credits | [api.together.ai](https://api.together.ai/settings/api-keys) |
| **Mistral** (chat) | Free tier | [console.mistral.ai](https://console.mistral.ai/api-keys/) |
| **Cohere** (chat) | Free tier | [dashboard.cohere.com](https://dashboard.cohere.com/api-keys) |
| **OpenAI** (chat + image) | Paid | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** (chat) | Paid | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Stability AI** (image) | Paid | [platform.stability.ai](https://platform.stability.ai/account/credits) |

A fully free setup: **Groq** for chat + **Together AI** for images.

### 5. Configure and run

```bash
cp .env.example .env
# Fill in DISCORD_TOKEN, CLIENT_ID, OWNER_ID, and your chosen provider keys

npm install
npm run build
npm start

# or for local development with auto-reload:
npm run dev
```

---

## Deploy to Railway

1. Push this project to GitHub
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. **Variables** tab → add everything from `.env.example` that applies to you
4. **Settings → Networking → Public Networking** → **Generate Domain** — this is what lets persona avatars load (see [Persona Webhook Identities](#persona-webhook-identities) below)
5. Railway runs `npm install && npm run build` then `node dist/index.js` automatically (configured in `railway.toml`)

> **Persistence note:** `data/` is ephemeral by default on Railway and resets on redeploy. To keep memories, logs, reminders, and settings across deploys, add a **Railway Volume** mounted at `/app/data`.

---

## Role Hierarchy

Three tiers, each a superset of the one below it:

| Role | Set by | Can do |
|---|---|---|
| **Owner** | `OWNER_ID` env var (exactly one) | Everything, plus `/auth`, `/memory`, and `/affection reset` (the only owner-exclusive commands) |
| **Admin** | `/auth add role:Admin` | Reload, switch chat/image provider, manage triggers, set reminder timezones, configure welcome messages and the open/trial channel, switch the server-wide default persona (`/persona set`), view exact affection scores (`/affection view`), everything Normal can do |
| **Normal** | `/auth add role:Normal` | Chat with the bot, `/imagine`, `/analyze`, `/remind` (set/list/cancel), `/mypersona`, `/affection mood`, view logs |

```
/auth add user:@Alex role:Admin
/auth add user:@Sam role:Normal
/auth set-role user:@Sam role:Admin
/auth remove user:@Sam
/auth list
```

Unauthorized users are silently ignored in normal chat, and get a polite "not on the list" reply if they try a slash command.

---

## Personas

There are two independent layers of persona selection:

- **`/mypersona set`** (everyone) — your own personal default. Only affects you — fresh @mentions and DMs from you talk to whichever persona you picked, no matter what anyone else has set or what the server default is.
- **`/persona set`** (Admin+) — the server-wide fallback, used for anyone who hasn't picked a personal one with `/mypersona`.

Both use autocomplete — start typing a name and matching personas show up (there are too many now for Discord's old-style dropdown menus). `/persona list` shows the full roster **A-Z by name**, and `/mypersona current` / `/persona current` show what you personally get vs. the server default, respectively.

**Browsing by version:** every persona is also tagged with the version it was added in, as an optional narrower. `/persona set`, `/mypersona set`, and `/remind set` all take an optional `version` field — pick one (e.g. `v3.4`) before typing in the name field, and the autocomplete suggestions narrow to just that batch, so you can browse "what got added recently" instead of needing to already know a name. `/persona list version:v3.4` does the same. Versions that didn't add any personas (feature-only releases) simply don't show up as an option. This — search instead of a fixed dropdown — is what actually lets the roster scale past Discord's 25-choice cap; A-Z sorting is just the default display, not a separate mechanism.

Switching either one does **not** clear conversation memory — history is already isolated per (channel, persona), so nothing gets mixed up.

| ID | Character | Source | Avatar filename |
|---|---|---|---|
| `hayasaka` | Ai Hayasaka | Kaguya-sama: Love Is War | `ai_hayasaka.*` |
| `alya` | Alya | Alya Sometimes Hides Her Feelings in Russian | `alya.*` |
| `amiya` | Amiya | Arknights | `amiya.*` |
| `anis` | Anis | Goddess of Victory: NIKKE | `anis.*` |
| `kana` | Arima Kana | Oshi no Ko | `arima_kana.*` |
| `asuna` | Asuna Yuuki *(neutral default)* | Sword Art Online | `asuna_yuuki.*` |
| `bocchi` | Bocchi (Hitori Gotoh) | Bocchi the Rock! | `bocchi.*` |
| `cc` | C.C. | Code Geass | `cc.*` |
| `chika` | Chika Fujiwara | Kaguya-sama: Love Is War | `chika_fujiwara.*` |
| `chisato` | Chisato Nishikigi | Lycoris Recoil | `chisato_nishikigi.*` |
| `chizuru` | Chizuru Mizuhara | Rent-A-Girlfriend | `chizuru_mizuhara.*` |
| `erina` | Erina Nakiri | Food Wars! | `erina_nakiri.*` |
| `fern` | Fern | Frieren: Beyond Journey's End | `fern.*` |
| `frieren` | Frieren | Frieren: Beyond Journey's End | `frieren.*` |
| `hakari` | Hakari Hanazono | The 100 Girlfriends Who Really, Really, Really, Really, Really Love You | `hakari_hanazono.*` |
| `yuuka` | Hayase Yuuka | Blue Archive | `hayase_yuuka.*` |
| `ichika` | Ichika Nakano | The Quintessential Quintuplets | `ichika_nakano.*` |
| `kita` | Ikuyo Kita | Bocchi the Rock! | `ikuyo_kita.*` |
| `iroha` | Iroha Isshiki | My Teen Romantic Comedy SNAFU | `iroha_isshiki.*` |
| `itsuki` | Itsuki Nakano | The Quintessential Quintuplets | `itsuki_nakano.*` |
| `kafka` | Kafka | Honkai: Star Rail | `kafka.*` |
| `kaguya` | Kaguya Shinomiya | Kaguya-sama: Love Is War | `kaguya_shinomiya.*` |
| `mai` | Mai Sakurajima | Rascal Does Not Dream of Bunny Girl Senpai | `mai_sakurajima.*` |
| `makima` | Makima | Chainsaw Man | `makima.*` |
| `kurisu` | Makise Kurisu | Steins;Gate | `makise_kurisu.*` |
| `march7th` | March 7th | Honkai: Star Rail | `march_7th.*` |
| `marin` | Marin Kitagawa | My Dress-Up Darling | `marin_kitagawa.*` |
| `miku` | Miku Nakano | The Quintessential Quintuplets | `miku_nakano.*` |
| `mitsuri` | Mitsuri Kanroji | Demon Slayer: Kimetsu no Yaiba | `mitsuri_kanroji.*` |
| `miyano` | Miyano | Tanaka-kun is Always Listless | `miyano.*` |
| `nijika` | Nijika Ijichi | Bocchi the Rock! | `nijika_ijichi.*` |
| `nino` | Nino Nakano | The Quintessential Quintuplets | `nino_nakano.*` |
| `rem` | Rem | Re:Zero − Starting Life in Another World | `rem.*` |
| `rin` | Rin Tohsaka | Fate/stay night | `rin_tohsaka.*` |
| `ryo` | Ryo Yamada | Bocchi the Rock! | `ryo_yamada.*` |
| `silverwolf` | Silver Wolf | Honkai: Star Rail | `silver_wolf.*` |
| `stelle` | Stelle | Honkai: Star Rail | `stelle.*` |
| `tatsumaki` | Tatsumaki | One Punch Man | `tatsumaki.*` |
| `violet` | Violet Evergarden | Violet Evergarden | `violet_evergarden.*` |
| `yor` | Yor Forger | Spy x Family | `yor_forger.*` |
| `yotsuba` | Yotsuba Nakano | The Quintessential Quintuplets | `yotsuba_nakano.*` |
| `yuki` | Yuki Suou | Alya Sometimes Hides Her Feelings in Russian | `yuki_suou.*` |

**Not included, on purpose:** Nahida (Genshin Impact) and Anya Forger (Spy x Family) are both depicted as children — not a good fit for a persona people converse with, regardless of in-universe lore (e.g. Nahida being "actually" an ancient deity). Roxy Migurdia and Eris Greyrat (both Mushoku Tensei) are skipped because that franchise carries specific, well-known controversy around this exact theme. Everything else requested made it in.

**Asuna is the designated "neutral" persona** — the most even-keeled, broadly approachable personality of the roster. She's the starting server-wide default out of the box, and — separately — she's *always* the one writing welcome messages (see below), regardless of the server default or anyone's personal pick. This is a fixed choice (`NEUTRAL_PERSONA_ID` in `src/constants.ts`).

Every persona defaults to roughly 1-5 sentences per reply, only writing longer when explicitly asked — a shared rule (`promptBuilder.ts`), not repeated in each persona file. A persona can override this entirely with `responseLengthOverride` when the default genuinely doesn't fit. **Bocchi** and **Ryo** both do this: Bocchi defaults hard to a single short sentence or fragment rather than a fixed count, and Ryo is written to be even more minimal by nature.

**Adding a new persona** (no other code changes needed):
1. Create `src/personas/<id>.ts`, copying an existing file as a template
2. Export a `Persona` object with a unique `id`, an `avatarKey` (e.g. `'new_character'`), and an `addedInVersion` tag (e.g. `'v3.6'`)
3. Import and register it in `src/personas/index.ts` (alphabetically by name if convenient — makes cross-referencing `avatars/README.md` easier, though it has no functional effect since listings always sort A-Z at runtime regardless of file order)
4. Drop a matching image in `avatars/` (e.g. `new_character.png`)
5. Rebuild and redeploy — it appears automatically in `/persona list`, `/persona set`, and `/mypersona set`, browsable by version alongside everything else

All personas share the same baseline safety rules (defined once in `promptBuilder.ts`) regardless of character — these aren't overridable per-persona.

---

## Persona Webhook Identities

Each persona replies as **itself** — its own name and avatar in the channel — using a Discord webhook, the same technique the well-known "proxy" persona bots use. It's not the bot's own account talking; it's a separate-looking identity per character.

**How it works under the hood:**
- One shared webhook is created per channel (reused for every persona — Discord caps webhooks at 15/channel, so this scales fine no matter how many personas you add)
- Each message swaps in the right `username` and `avatarURL` for whichever persona is replying
- The bot's own HTTP server hosts your `/avatars` folder publicly, since Discord's webhook API fetches avatar images from a real URL — see the [Railway deployment](#deploy-to-railway) step above for enabling this
- No custom avatar uploaded for a character? Its messages still send correctly under the right name, just with Discord's default webhook icon
- Every persona reply starts with an **@mention of whoever it's responding to**. This isn't a stylistic choice — Discord's webhook API has never supported native message replies (a long-standing, still-open platform limitation, confirmed by Discord's own team), so this is the practical substitute, and it's exactly what solves the "who is this responding to" confusion when several people are talking to different personas in the same channel at once

**Requires the `Manage Webhooks` permission** — see the setup steps above.

### Continuing a conversation without repeated @mentions

1. @mention the bot (or DM it) once — you get a reply styled as your resolved persona (your personal pick from `/mypersona`, or the server default if you haven't set one)
2. From then on, just **reply to that message** to keep talking — no need to @mention again
3. Replying pins you to *that specific character's* thread in *that channel*, regardless of anyone's personal pick or the server default changing in the meantime

### Multiple people, multiple personas, at once

Because conversations are tracked per-message, different people can be mid-conversation with **different characters at the same time** in the same channel — Alex replying to a Rem thread and Sam replying to an Asuna thread don't interfere with each other. Each persona's memory of the conversation (what's been said so far) is kept separate per channel, too.

If webhooks can't be used for some reason (missing permission, or a DM — webhooks don't exist in DMs), the bot transparently falls back to replying under its own normal identity instead of failing silently.

---

## Breaking Character: the `noper` prefix

Start a message with **`noper`** to get a plain, unfiltered answer instead of an in-character one — useful for statistics, facts, or anything where the roleplay would get in the way.

```
@Bot noper what's the boiling point of water in Fahrenheit?
```

- Must be a **prefix** — the message has to start with it (`noper` on its own asks you to add a question)
- Skips persona identity, traits, memories, and keyword triggers entirely — just a direct answer from the underlying AI
- Sent via the same webhook, but under the **active model's name** (e.g. `Gemini 2.5 Flash`, `Llama 3.3 70b Versatile`) with **no custom avatar** — Discord's plain default icon, on purpose, to make it visually obvious you've stepped outside the roleplay
- **Doesn't persist** — it always needs the prefix again. Reply to a `noper` answer *without* the prefix and the bot resumes whichever persona that conversation belonged to, exactly like nothing happened

---

## Talking to the Bot

No command needed for normal conversation:

- **@mention** — `@BotName what's up?` (get the current active persona)
- **Reply** to any persona's message to keep that specific conversation going — see [Persona Webhook Identities](#persona-webhook-identities) above
- **DM** the bot directly (always works, but appears as the bot's own identity — DMs don't support webhooks)
- Attach an **image** while doing any of the above — the bot looks at it automatically
- Start a message with **`noper`** for a plain, no-persona answer — see [Breaking Character](#breaking-character-the-noper-prefix) below

`RESPOND_TO_ALL=true` makes it respond to every message in every channel instead. There's also a per-channel version of this that works for unauthorized users too — see [Open/Trial Channel](#opentrial-channel) below.

---

## Open/Trial Channel

Admin+ can designate one channel where **anyone can talk to the bot, authorized or not** — no @mention needed, no setup, a genuine no-barrier trial experience.

```
/openchannel set channel:#trial-the-bot
/openchannel status
/openchannel clear
```

Rules specific to this channel:
- Every message gets a reply, from anyone, regardless of the authorized-users list
- Only the **server-wide default persona** ever responds here — personal `/mypersona` picks and persona-thread continuation (replying to a specific character's message) are both deliberately ignored, so behavior stays predictable for people who've never used the bot before
- Slash commands are unaffected — unauthorized users still can't run `/persona`, `/imagine`, etc., anywhere, including this channel. The bypass only applies to plain conversational messages

Since this opens the door to genuinely unlimited message volume from anyone in the channel, this is exactly the kind of usage the [rate limit guard](#monitoring--logging) is there to protect against.

---

## Keyword Triggers

Pre-set replies that fire instantly (no AI call) when a keyword is detected in a message that @mentions the bot, replies to it, or DMs it. Admin+ only to manage.

```
/trigger add keyword:bingo reply:BINGO!
/trigger add keyword:bingo reply:we have a winner!!
/trigger list
/trigger list keyword:bingo
/trigger remove keyword:bingo index:1
/trigger remove keyword:bingo
```

Multiple replies per keyword are picked at random. Matching is case-insensitive and whole-word.

---

## Memories

**Owner-only** — this changed from earlier versions. Letting any authorized user add memories about themselves would trivially game the affection meter below ("remember that I'm wonderful and can do no wrong"), so all of it is locked down now.

Memories are also **scoped to whichever persona is currently active** (`/persona set`), except for `global` facts which every persona knows regardless. There's no persona-picker in the command itself — with 26+ personas that would hit the same 25-choice wall persona *selection* did, and unlike selection there's nothing to search for here, since the target is always just "whichever persona is active right now." To add a memory for a different character: `/persona set` to them first, add the memory, switch back if you want.

```
/memory add user:@Alex fact:prefers to be called "Lex" (only the currently-active persona knows this)
/memory remove user:@Alex query:computer science
/memory add-global fact:everyone here plays Valorant (every persona knows this)
/memory remove-global query:Valorant
/memory list user:@Alex (shows global facts + the active persona's facts about Alex)
/memory list (summary: global count + who the active persona knows things about)
```

---

## Affection Meter

Each persona silently tracks how a person treats them, per (user, persona) pair, and it colors their tone over time — entirely automatic, no manual input.

**How it works:** every message sent to a persona is quietly rated by a separate, deliberately neutral AI call — a strict sentiment classifier, not the character itself — on a scale from -100 to 100. That delta accumulates into a running score. The classifier is explicitly instructed not to default to a positive rating out of politeness (a real tendency some models have); ordinary small talk should land near 0, and only genuinely kind or genuinely hostile messages should move the needle. It's also instructed to discount bare, unembellished declarations like "I love you" with no other substance, since those cost nothing to say.

**Levels** (score thresholds, symmetric positive/negative):

| Level | Threshold | Feel |
|---|---|---|
| ±1 | 500 | A mild first impression, good or bad |
| ±2 | 2,500 | Comfortable/friendly, or guarded/irritated |
| ±3 | 10,000 | Real warmth, or real distrust, built from a pattern |
| ±4 | 30,000 | Deep trust, or genuine resentment |
| ±5 | 100,000 | Cherished, or deeply wounded |

**Decay is dynamic, not flat** — lower levels fade fast (a mild mood clears up in days), and the curve gets dramatically steeper toward the top: level 5 in either direction is built to feel close to permanent, since reaching it takes sustained, genuine effort:

| Level | Daily decay | Rough half-life |
|---|---|---|
| 1 | 20%/day | under 4 days |
| 2 | 10%/day | about a week |
| 3 | 4%/day | about 3 weeks |
| 4 | 1%/day | about 10 weeks |
| 5 | 0.15%/day | well over a year |

Decay is computed lazily from elapsed wall-clock time whenever a score is touched — there's no background job ticking constantly, and it's exact regardless of bot downtime in between.

**Anti-farming measures:** repeatedly sending the same or near-identical message (checked by word-overlap similarity, not just exact matches, so paraphrasing doesn't help) yields sharply diminishing returns on positive deltas within a rolling window — the second near-duplicate earns roughly a third of the first, the third earns roughly a tenth, and so on. This closes the obvious loophole of just spamming "I love you" to farm a high score fast. It doesn't touch negative deltas, since there's no exploit to close on that side.

**Safety rail:** even at the most negative level, a persona is instructed to become colder and more guarded, never genuinely cruel, abusive, or unsafe — the meter changes warmth, not the baseline safety rules everyone shares.

```
/affection mood persona:asuna                        — casual, number-free read on how a persona feels about you (everyone)
/affection view persona:asuna                         — exact score for yourself (Admin+)
/affection view persona:asuna user:@Alex              — exact score for someone else (Admin+)
/affection reset user:@Alex persona:asuna             — reset to neutral (Owner)
```

`/affection mood` is the one built for casually checking in without spoiling the fun with exact numbers — it returns a short line like "Frieren seems to have a decent impression of you" rather than a score. `/affection view` is the precise, numeric version for admins who want to actually audit or debug it.

> **Cost note:** this roughly doubles API calls per conversational message (one for the reply, one for the classifier), which is exactly why the [rate limit guard](#monitoring--logging) below exists — make sure `CHAT_RATE_LIMIT_PER_MINUTE` is set to something safely under your provider's actual per-minute cap.

---

## Reminders

Anyone can schedule the bot to mention them at a specific time — only for themselves. Pick which persona delivers it, and use autocomplete suggestions for common times instead of typing one out.

```
/remind timezone tz:Asia/Dhaka
/remind set time:8:00am message:good morning! repeat:Daily persona:asuna
/remind set time:11:30pm message:go to sleep repeat:Daily ai-flavor:true persona:frieren
/remind set time:3:00pm message:check on the deploy repeat:Once channel:#general
/remind list
/remind cancel id:a1b2c3
```

- **`time`** has autocomplete suggestions (8:00 AM, 9:00 PM, etc.) but still accepts anything you type, like `14:37`
- **`persona`** also has autocomplete (with the same [version-browsing](#personas) as `/persona set`) — defaults to your current persona (personal pick, or the server default) if you don't specify one
- `repeat`: `Once` (default) or `Daily`
- `channel`: where to mention you (defaults to a DM)
- `ai-flavor`: if true, the chosen persona rewrites your note in character each time instead of sending it verbatim
- Set your timezone once with `/remind timezone` — otherwise reminders use `DEFAULT_TIMEZONE` from your env vars (default `UTC`)

When delivered in a server channel, reminders go out through the same persona webhook as normal conversation (styled with that character's name and avatar) and can be replied to just like any other persona message. DMs always use a plain message, since webhooks don't work there.

The scheduler checks every 30 seconds and uses your IANA timezone (e.g. `America/New_York`, `Europe/London`, `Asia/Tokyo`) to fire at the right local time.

---

## Welcome Messages

Admin+ picks the channel; that's the only creative control there is. Every greeting is written fresh by the **neutral default persona** (Asuna) in character — not whatever persona is currently active for conversation, and not a custom template. This keeps a new member's first impression consistent and on-brand no matter what the server is currently using the bot for.

```
/welcome set-channel channel:#welcome
/welcome toggle enabled:true
/welcome test
/welcome status
```

There's no `set-message` or `set-mode` — that's intentional. One less thing to configure, and it guarantees every new member gets the same warm, even-keeled first impression.

---

## Image Analysis

```
/analyze image:<upload> question:What's happening in this picture?
```

Also works automatically: attach an image to any message that @mentions the bot, replies to it, or DMs it, and it's included in context. Uses whichever configured chat provider supports vision (Gemini, OpenAI, or Anthropic); if the active chat provider doesn't support vision, it transparently falls back to Gemini or another vision-capable key you have configured, so `/analyze` keeps working regardless of your chat provider choice.

---

## Chat Providers

| Provider | Default model | Vision support |
|---|---|---|
| `groq` | `llama-3.3-70b-versatile` | No |
| `gemini` | `gemini-2.5-flash` | Yes |
| `mistral` | `mistral-small-latest` | No |
| `cohere` | `command-r` | No |
| `openai` | `gpt-4o-mini` | Yes |
| `anthropic` | `claude-3-5-haiku-latest` | Yes |
| `ollama` | `llama3` | Depends on loaded model |

```
/provider list
/provider models
/provider set name:groq
/provider set name:gemini model:gemini-3-flash-preview
/provider model name:llama-3.1-8b-instant
```

Switching provider or model clears conversation memory (new backend, fresh context). `set`/`model` require Admin+; `list`/`models` are visible to everyone.

## Image Providers

| Provider | Default model | Notes |
|---|---|---|
| `together` | `black-forest-labs/FLUX.1-schnell-Free` | Free tier, fast |
| `gemini` | `gemini-2.5-flash-image` | Google's native image model ("Nano Banana"), reuses `GEMINI_API_KEY` |
| `openai-dall-e` | `dall-e-3` | Paid |
| `stability` | `stable-diffusion-xl-1024-v1-0` | Paid |
| `none` | — | Disables `/imagine` |

```
/imgprovider list
/imgprovider set name:together
```

Image generation always uses a separate provider from chat, so you can mix and match freely (e.g. Groq for chat, Together for images).

> **Why not Imagen?** Google is retiring the standalone Imagen API in August 2026. The `gemini` image provider uses Gemini's native image-generation models instead, which aren't affected.

---

## Monitoring & Logging

- All internal logging goes through a structured logger (`src/logger.ts`) with `debug`/`info`/`warn`/`error` levels, controlled by `LOG_LEVEL`
- Set `LOG_TO_FILE=true` to additionally write daily log files to `data/logs/system/`
- A minimal `/health` HTTP endpoint runs alongside the bot (port from `PORT`, default `3000`) returning uptime and status JSON — useful for external uptime monitors
- `/status` in Discord shows the active persona, provider, model, rate-limit usage, process uptime, and memory usage
- Transient provider errors (503 overloaded, 429 rate-limited) are automatically retried with backoff before the user ever sees an error
- **Rate limit guard:** every outgoing chat-provider call (main replies, `noper`, the affection classifier, log Q&A, welcome/reminder generation) passes through a shared per-minute counter (`CHAT_RATE_LIMIT_PER_MINUTE`, default 14). Once hit, new calls are refused outright — with a friendly "try again in ~Xs" message — instead of risking your provider's own hard rate limit, which can have worse consequences than a few seconds' wait. Set this a couple below your actual plan's RPM.

---

## Commands Reference

> **Note:** slash command *responses* (`/imagine`, `/analyze`, etc.) always appear under the bot's own name — Discord doesn't allow interaction replies to be webhook-styled. Persona identities apply to normal conversation (@mentions, replies, DMs), which is where they matter most.

### Normal (all authorized users)
| Command | Description |
|---|---|
| `/help` | Show every command available to you, with descriptions (only visible to you) |
| `/imagine prompt:` | Generate an image |
| `/analyze image: [question:]` | Analyze an uploaded image |
| `/logs recent [count:]` / `search keyword:` / `ask question:` | View, search, or ask AI about chat history |
| `/remind set/list/cancel` | Manage your own reminders |
| `/mypersona set/current/clear` | Set your own personal persona (only affects you) |
| `/persona list` / `current` | Browse personas / see the server default |
| `/affection mood persona:` | Casual, number-free read on how a persona feels about you |
| `/provider list` / `models` | View chat provider info |
| `/imgprovider list` | View image provider info |
| `/status` | Bot health, rate-limit usage, and active config |
| `/clear` | Clear conversation memory for this channel |

### Admin+
| Command | Description |
|---|---|
| `/trigger add/remove/list` | Manage keyword auto-replies |
| `/provider set` / `model` | Switch chat provider/model |
| `/imgprovider set` | Switch image provider/model |
| `/persona set` | Switch the server-wide default persona |
| `/remind timezone` | Set a user's timezone for reminder scheduling |
| `/welcome set-channel/toggle/status/test` | Configure new-member greetings (channel + on/off only — greeting itself is fixed) |
| `/openchannel set/clear/status` | Designate the open/trial channel |
| `/affection view` | View the exact score (yourself or, with `user:`, someone else) |
| `/reload` | Clear all conversation memory, re-fetch app emojis and avatar files |

### Owner only
| Command | Description |
|---|---|
| `/auth add/remove/set-role/list` | Manage who can use the bot and at what level |
| `/memory add/remove/add-global/remove-global/list` | Manage what the active persona (or every persona, for global facts) knows |
| `/affection reset` | Reset a user's standing with a persona back to neutral |

---

## Custom App Emojis

Upload emojis in **Dev Portal → your app → Emojis tab**. The bot loads them on startup, can use them naturally in replies (`:emojiname:` gets resolved), and occasionally reacts to messages with them (`REACTION_CHANCE`, default 30%). Admin+ can refresh the cache without restarting via `/reload`.

---

## Migrating from v2

If you're coming from the old `!prefix`-based `bot.js`:

- **Delete** `bot.js`, the old flat `package.json`, and any `persona.json` — replaced by `src/` and the persona registry
- All `!commands` are now `/commands` — see the reference table above for the mapping
- `AUTHORIZED_USERS` still works the same way but now seeds **Normal** role; promote specific users to Admin with `/auth add role:Admin`
- `IMAGE_PROVIDER=gemini-imagen` → now just `gemini` (the underlying model changed too, see the image providers section)
- Custom single-persona `persona.json` is gone; pick from the built-in roster or add your own as a TypeScript file
- Re-invite the bot with the `Manage Webhooks` permission and `SERVER MEMBERS INTENT` enabled — both are new requirements
- Add persona avatar images to `/avatars` and generate a public domain on Railway to see them in Discord (see [Persona Webhook Identities](#persona-webhook-identities))

**Upgrading from before v3.5 specifically:** the memory storage format changed (facts are now scoped per-persona instead of shared across all of them, and every memory command moved to Owner-only). Delete `data/memories.json` before redeploying — the old format won't parse correctly against the new schema, and it's simpler to start fresh than migrate.

---

## Credits

* **Bot Avatar / Artwork:** Illustrated by **banishment** ([Twitter/X](https://x.com/y_banishment) / [Pixiv](https://www.pixiv.net/en/users/2281440))

---

## License

MIT
