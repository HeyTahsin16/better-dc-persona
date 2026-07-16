# Persona Avatars

Drop character profile pictures in this folder. The bot serves them to Discord automatically — no code changes needed.

## Naming convention

- lowercase
- spaces → underscores
- match the persona's `avatarKey` field in `src/personas/<id>.ts`

| Persona | Expected filename (any supported extension) |
|---|---|
| Ai Hayasaka | `ai_hayasaka.png` |
| Alya | `alya.png` |
| Amiya | `amiya.png` |
| Anis | `anis.png` |
| Arima Kana | `arima_kana.png` |
| Asuna *(neutral default)* | `asuna_yuuki.png` |
| Bocchi (Hitori Gotoh) | `bocchi.png` |
| C.C. | `cc.png` |
| Chika Fujiwara | `chika_fujiwara.png` |
| Chisato Nishikigi | `chisato_nishikigi.png` |
| Chizuru Mizuhara | `chizuru_mizuhara.png` |
| Erina Nakiri | `erina_nakiri.png` |
| Fern | `fern.png` |
| Frieren | `frieren.png` |
| Hakari Hanazono | `hakari_hanazono.png` |
| Hayase Yuuka | `hayase_yuuka.png` |
| Ichika Nakano | `ichika_nakano.png` |
| Ikuyo Kita | `ikuyo_kita.png` |
| Iroha Isshiki | `iroha_isshiki.png` |
| Itsuki Nakano | `itsuki_nakano.png` |
| Kafka | `kafka.png` |
| Kaguya Shinomiya | `kaguya_shinomiya.png` |
| Mai Sakurajima | `mai_sakurajima.png` |
| Makima | `makima.png` |
| Makise Kurisu | `makise_kurisu.png` |
| March 7th | `march_7th.png` |
| Marin Kitagawa | `marin_kitagawa.png` |
| Miku Nakano | `miku_nakano.png` |
| Mitsuri Kanroji | `mitsuri_kanroji.png` |
| Miyano | `miyano.png` |
| Nijika Ijichi | `nijika_ijichi.png` |
| Nino Nakano | `nino_nakano.png` |
| Rem | `rem.png` |
| Rin Tohsaka | `rin_tohsaka.png` |
| Ryo Yamada | `ryo_yamada.png` |
| Silver Wolf | `silver_wolf.png` |
| Stelle | `stelle.png` |
| Tatsumaki | `tatsumaki.png` |
| Violet Evergarden | `violet_evergarden.png` |
| Yor Forger | `yor_forger.png` |
| Yotsuba Nakano | `yotsuba_nakano.png` |
| Yuki Suou | `yuki_suou.png` |

## Supported formats

`.png`, `.jpg` / `.jpeg`, `.gif` (animated avatars work), `.webp`

## How it works

On startup (and whenever `/reload` is run), the bot scans this folder and matches filenames to personas by their `avatarKey`. If a matching file is found, that persona's webhook messages use it as the avatar. If no file is found for a persona, its messages still send correctly under the right name — just with Discord's default webhook icon instead.

You're responsible for sourcing your own images here (fan art you have rights to use, official promotional art, etc.) — none are bundled with this project.

## Public hosting requirement

Discord's webhook API needs a real, publicly-reachable URL for avatars — it fetches the image itself server-side. This bot serves the files in this folder at `<your public URL>/avatars/<filename>` via its built-in HTTP server. For this to work on Railway:

1. Go to your service → **Settings → Networking → Public Networking**
2. Click **Generate Domain**

Railway then automatically provides `RAILWAY_PUBLIC_DOMAIN`, which the bot picks up with no extra configuration. If you're hosting elsewhere or want a custom domain, set `PUBLIC_URL` explicitly in your environment variables instead.
