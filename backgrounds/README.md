# Mood Card Backgrounds

Drop backdrop images in this folder and `/affection mood` will use them when it builds its card (persona art centered on top, mood line underneath on a frosted glass panel). No code changes needed.

## Naming convention

Same convention as `avatars/` — this is intentional, so the two folders stay easy to keep in sync:

- lowercase
- spaces → underscores
- match the persona's `avatarKey` field in `src/personas/<id>.ts` (the exact same filename you'd use in `avatars/`, just in this folder instead)

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

`.png`, `.jpg` / `.jpeg`, `.gif` (first frame only — the card is a static image), `.webp`

## Image guidance

Any resolution or aspect ratio works — the image is cropped to fill the card (like CSS `object-fit: cover`), centered. Roughly 1000px+ on the short side looks sharpest; very small or heavily compressed images will look soft once stretched to fill the frame.

## How it works

On startup (and whenever `/reload` is run), the bot scans this folder and matches filenames to personas by their `avatarKey` — the exact same lookup `avatars/` uses. If a matching file is found, `/affection mood` uses it as that persona's card background. **If no file is found for a persona, its mood card still works** — it just falls back to a generated gradient (tinted to match the mood's color) instead of erroring out. You can add backgrounds gradually, persona by persona, at your own pace.

You're responsible for sourcing your own images here (fan art you have rights to use, official promotional art, etc.) — none are bundled with this project.

## No public hosting required

Unlike `avatars/`, nothing here needs to be publicly reachable. Backgrounds are composited server-side into the mood card image, which is then uploaded straight to Discord as a file attachment — so `PUBLIC_URL` / `RAILWAY_PUBLIC_DOMAIN` (needed for avatars) has no bearing on this feature.
