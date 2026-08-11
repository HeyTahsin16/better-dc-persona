# Changelog

Full version history for `discord-persona-bot`. See `README.md` for setup and current
feature overview, or `DOCUMENTATION.md` for a complete reference of how everything
works. Newest first.

---

## What's new in v3.12

| Area | What changed |
|---|---|
| Persona-aware rating, for everyone | `affectionSensitivities` (see v3.10) is no longer a 7-persona sample — every persona in the roster now has one, written specifically for that character rather than generic filler. The message-tone classifier gets real, character-specific context for every single rating it makes, not just a handful |
| Roster correction | Removed Yachiyo Runami (added in v3.9). She's from a 2026 release recent enough that most chat models have little to no training data on her specifically, which showed up as genuinely poor roleplay quality regardless of how the persona file itself was written. Roster: 71 → 70 |

## What's new in v3.11

| Area | What changed |
|---|---|
| Persona ratings | New community rating system, separate from the Affection Meter — anyone can rate how lore-accurate a persona feels (1-10) via `/persona rate` or an optional dropdown prompt that now appears under `/affection mood` and `/persona profile`. Ratings show up right next to the persona's name in `/persona profile` (with a clean "not yet rated" fallback), plus a new public `/persona leaderboard` ranking the top 20 by average |

## What's new in v3.10

| Area | What changed |
|---|---|
| Persona-specific affection moods | `/affection mood` phrasing can now be overridden per persona at any level (-5..5). In use for Yor (caps out at fierce protectiveness/family, not romance, since she's canonically married), Bocchi (full custom arc — goes nonverbal at rock bottom, sends `.......` at level -5, stays shy-but-happy rather than confidently smitten at the top), Makima, Tatsumaki, Echidna, Jibril, Megumin, and Mashiro Shiina. Any persona without an override uses the existing generic phrasing, unchanged |
| Persona-aware message rating | The classifier deciding whether a message raises or lowers someone's score now sees which character is being addressed — their traits and description always, plus specific notes on what actually pleases or bothers them for a subset of personas (Frieren, Tatsumaki, Megumin, Bocchi, Maomao, Power, Umaru) — instead of rating every message identically regardless of who it's sent to |
| `/affection set` | New Owner-only subcommand — set an exact score for a specific user and persona directly (e.g. `-67`), bypassing normal accumulation. Mainly for testing |

## What's new in v3.9

| Area | What changed |
|---|---|
| 29 new personas | Mikasa Ackerman, Power, Futaba Sakura, Rias Gremory, Jibril, Hanekawa Tsubasa, Tohru, Mila, Maomao, Mashiro Shiina, Vladilena Milizé, Kyouko Hori, Nao Tomori, Lucy, Shinoa Hiiragi, Elaina, Tsukasa Yuzaki, Echidna, Suruga Kanbaru, Kaoruko Waguri, Umaru Doma, Rio Futaba, Chisa Kotegawa, Suzune Horikita, Hiyori Iki, Megumin, Fumino Furuhashi, Oguri Cap, and Yachiyo Runami — roster is now 71 personas. As always, browsable with `/persona list version:v3.9` or by name via autocomplete on `/persona set` / `/persona my set` |

## What's new in v3.8

| Area | What changed |
|---|---|
| Threads & voice-channel chat | Persona replies (with full webhook styling — name, avatar) now work in threads and in voice channels' text chat. Previously both silently fell back to a plain bot-identity reply, or didn't respond at all in threads |
| Fewer, better-organized commands | `/imagine` + `/analyze` → `/image create` / `/image analyze`. `/imgprovider` folded into `/provider image ...`. `/mypersona` folded into `/persona my ...`. Existing muscle memory for `/provider`, `/persona`, and their unmerged subcommands is unaffected — only the commands that moved changed names |
| `/affection mood` embed cleanup | Removed the title/description text that was duplicating what the mood card image already shows |
| `/persona profile` | New — view any character's avatar, bio, and background art on its own |

## What's new in v3.7

| Area | What changed |
|---|---|
| `/affection mood` gets a visual | Now posts a generated card — persona art centered over a background, mood phrase on a frosted glass panel below it — instead of a plain text reply |
| Public by default | `/affection mood` now posts publicly so the card can be shown off, instead of only to the person who ran it. `/affection view` and `/affection reset` are unchanged — still private, still Admin+/Owner |
| Per-persona backgrounds | Drop an image in `backgrounds/` named after a persona's avatarKey (same convention as `avatars/`) and that persona's mood card uses it. Personas without one yet get a generated gradient instead of breaking |

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
