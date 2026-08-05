import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Canvas } from '@napi-rs/canvas';
import { BACKGROUNDS_DIR, FONTS_DIR } from '../constants';
import { getAvatarFilePath } from '../webhooks/avatarResolver';
import { logger } from '../logger';

/**
 * Renders the image used by `/affection mood`: a persona-specific background
 * (matched by the same avatarKey used in /avatars, so e.g. avatars/alya.jpg pairs
 * with backgrounds/alya.jpg), the persona's avatar centered in a circular frame,
 * and the mood phrase in a frosted/blurred glass panel underneath it.
 *
 * Canvas is 1920x1080 to match desktop-wallpaper-sized backgrounds 1:1 (no
 * cropping needed if the source already is that size). Deliberately never
 * renders the numeric affection score or level — only the qualitative phrase.
 * Exact numbers stay admin-only via `/affection view`.
 */

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CARD_W = 1920;
const CARD_H = 1080;

const AVATAR_DIAMETER = 520;
const AVATAR_RING_WIDTH = 8;
const AVATAR_FOCUS_Y = 0.15; // bias crop toward the top so faces aren't cut off

const GAP_AVATAR_TO_PANEL = 40;

// Panel is intentionally narrower than the canvas (not edge-to-edge) — this is
// a landscape background with a compact centered card floating on it, not a
// portrait card that fills the frame.
const PANEL_WIDTH = 820;
const PANEL_RADIUS = 28;
const PANEL_PAD_X = 46;
const PANEL_PAD_TOP = 40;
const PANEL_PAD_BOTTOM = 36;
const PANEL_BLUR_PX = 28;
const PANEL_BLUR_OVERDRAW = PANEL_BLUR_PX * 2; // avoids the blur sampling transparent edges
const PANEL_OVERLAY_ALPHA = 0.44;

const TITLE_FONT = 'Poppins SemiBold';
const TITLE_SIZE = 40;
const TITLE_BLOCK_H = 52;
const TITLE_TO_PHRASE_GAP = 16;
const TITLE_BASELINE_OFFSET = Math.round(TITLE_SIZE * 0.82);

const PHRASE_FONT = 'Poppins';
const PHRASE_SIZE = 29;
const PHRASE_LINE_HEIGHT = 40;
const PHRASE_FIRST_LINE_OFFSET = Math.round(PHRASE_SIZE * 0.86);

// ---------------------------------------------------------------------------
// Mood accent color — interpolated so it never needs to expose the raw number
// ---------------------------------------------------------------------------

const NEGATIVE_ANCHOR: [number, number, number] = [90, 104, 160]; // cool blue-gray
const NEUTRAL_ANCHOR: [number, number, number] = [180, 184, 199]; // soft lavender-gray
const POSITIVE_ANCHOR: [number, number, number] = [255, 111, 165]; // warm pink

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Maps an affection level (-5..5) to an accent color. Only ever used for color —
 *  never displayed as text — so the number itself stays admin-only. */
export function moodAccentColor(level: number): string {
  const clamped = Math.max(-5, Math.min(5, level));
  const t = Math.abs(clamped) / 5;
  const anchor = clamped >= 0 ? POSITIVE_ANCHOR : NEGATIVE_ANCHOR;
  const rgb: [number, number, number] = [0, 1, 2].map((i) =>
    NEUTRAL_ANCHOR[i] + (anchor[i] - NEUTRAL_ANCHOR[i]) * t
  ) as [number, number, number];
  return rgbToHex(rgb);
}

// ---------------------------------------------------------------------------
// Fonts — bundled rather than relying on the host having any installed, since
// a bare Railway/Nixpacks container has no guarantee of system fonts.
// ---------------------------------------------------------------------------

let fontsRegistered = false;

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  fontsRegistered = true; // set first so a load failure doesn't retry every call
  try {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-Regular.ttf'), 'Poppins');
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-SemiBold.ttf'), 'Poppins SemiBold');
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-Bold.ttf'), 'Poppins Bold');
  } catch (err) {
    logger.warn('[moodCard] Failed to register bundled fonts — falling back to system default', err);
  }
}

// ---------------------------------------------------------------------------
// Background cache — mirrors avatarResolver's pattern: scan once, cache the
// avatarKey -> filename map, refresh on startup/`/reload`. Keying backgrounds
// off the exact same avatarKey as /avatars means every persona can get its own
// unique backdrop just by naming the file the same as its avatar.
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

let backgroundFileMap: Map<string, string> = new Map();

function scanBackgrounds(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (!fs.existsSync(BACKGROUNDS_DIR)) return map;
    for (const file of fs.readdirSync(BACKGROUNDS_DIR)) {
      const ext = path.extname(file).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
      map.set(path.basename(file, ext).toLowerCase(), file);
    }
  } catch (err) {
    logger.warn('[moodCard] Failed to scan backgrounds directory', err);
  }
  return map;
}

/** Rescans the backgrounds folder. Call at startup and from `/reload`. */
export function refreshBackgroundCache(): void {
  backgroundFileMap = scanBackgrounds();
  logger.info(
    backgroundFileMap.size
      ? `[moodCard] Loaded ${backgroundFileMap.size} persona background(s): ${[...backgroundFileMap.keys()].join(', ')}`
      : '[moodCard] No files in /backgrounds yet — mood cards will use a generated gradient until backgrounds are added.'
  );
}

/** Local filesystem path to a persona's raw background file, or null if none is
 *  set yet. Exposed for commands that want the unedited source image directly
 *  (e.g. `/persona profile`), as opposed to generateMoodCard's composited card. */
export function getBackgroundFilePath(avatarKey: string): string | null {
  const filename = backgroundFileMap.get(avatarKey.toLowerCase());
  return filename ? path.join(BACKGROUNDS_DIR, filename) : null;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

/** Draws `img` into the dest rect using CSS `object-fit: cover` semantics.
 *  `focusY` (0..1) biases the crop vertically — 0 keeps the top, 0.5 centers.
 *  A 1920x1080 source into a 1920x1080 dest needs no cropping at all here. */
function drawCover(
  ctx: SKRSContext2D,
  img: Awaited<ReturnType<typeof loadImage>>,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  focusY = 0.5
): void {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.width - sw) / 2;
  const sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) * focusY));
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawFallbackGradient(ctx: SKRSContext2D, accent: string): void {
  const [r, g, b] = hexToRgb(accent);
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, `rgb(${Math.round(r * 0.22)}, ${Math.round(g * 0.2)}, ${Math.round(b * 0.3)})`);
  grad.addColorStop(1, `rgb(${Math.round(r * 0.6)}, ${Math.round(g * 0.38)}, ${Math.round(b * 0.55)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

async function drawBackgroundLayer(ctx: SKRSContext2D, avatarKey: string, accent: string): Promise<void> {
  const bgPath = getBackgroundFilePath(avatarKey);
  if (bgPath) {
    try {
      const img = await loadImage(bgPath);
      drawCover(ctx, img, 0, 0, CARD_W, CARD_H, 0.5);
      return;
    } catch (err) {
      logger.warn(`[moodCard] Failed to load background "${bgPath}", using gradient fallback`, err);
    }
  }
  drawFallbackGradient(ctx, accent);
}

function drawVignette(ctx: SKRSContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  grad.addColorStop(0, 'rgba(0,0,0,0.12)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

/** Fills a `size`x`size` box (the avatar's circular clip is already active
 *  when this is called) with a gradient + the persona's initial, for when no
 *  avatar file matches. */
function drawAvatarPlaceholder(ctx: SKRSContext2D, x: number, y: number, size: number, name: string, accent: string): void {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, 'rgba(22,20,32,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `${Math.round(size * 0.4)}px "Poppins Bold"`;
  ctx.fillText((name.trim()[0] || '?').toUpperCase(), x + size / 2, y + size / 2 + size * 0.03);
  ctx.restore();
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws a frosted-glass panel: a blurred snapshot of `source` clipped to a
 *  rounded rect, darkened slightly for contrast, with a soft border — enough
 *  blur to clearly read as a separate layer from the sharp background behind it. */
function drawFrostedPanel(ctx: SKRSContext2D, source: Canvas, x: number, y: number, w: number, h: number): void {
  const blurCanvas = createCanvas(CARD_W, CARD_H);
  const bctx = blurCanvas.getContext('2d');
  bctx.filter = `blur(${PANEL_BLUR_PX}px)`;
  bctx.drawImage(
    source,
    -PANEL_BLUR_OVERDRAW,
    -PANEL_BLUR_OVERDRAW,
    CARD_W + PANEL_BLUR_OVERDRAW * 2,
    CARD_H + PANEL_BLUR_OVERDRAW * 2
  );

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, PANEL_RADIUS);
  ctx.clip();
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.fillStyle = `rgba(12, 10, 20, ${PANEL_OVERLAY_ALPHA})`;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, PANEL_RADIUS);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MoodCardOptions {
  personaName: string;
  avatarKey: string;
  phrase: string;
  /** -5..5. Used only to pick an accent color — never rendered as text. */
  level: number;
}

export async function generateMoodCard(opts: MoodCardOptions): Promise<Buffer> {
  ensureFontsRegistered();
  const accent = moodAccentColor(opts.level);

  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d');

  await drawBackgroundLayer(ctx, opts.avatarKey, accent);
  drawVignette(ctx);

  // Measure/wrap the phrase first so we know the panel height, which lets us
  // vertically center the whole avatar+panel group regardless of phrase length.
  ctx.font = `${PHRASE_SIZE}px "${PHRASE_FONT}"`;
  const maxTextWidth = PANEL_WIDTH - 2 * PANEL_PAD_X;
  const phraseLines = wrapText(ctx, opts.phrase, maxTextWidth);

  const panelHeight =
    PANEL_PAD_TOP + TITLE_BLOCK_H + TITLE_TO_PHRASE_GAP + phraseLines.length * PHRASE_LINE_HEIGHT + PANEL_PAD_BOTTOM;

  const totalContentH = AVATAR_DIAMETER + GAP_AVATAR_TO_PANEL + panelHeight;
  const avatarTop = Math.max(48, Math.round((CARD_H - totalContentH) / 2));
  const avatarRadius = AVATAR_DIAMETER / 2;
  const avatarCx = CARD_W / 2;
  const avatarCy = avatarTop + avatarRadius;

  // Avatar: drop shadow, clipped circular image (or placeholder), accent ring.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  const avatarPath = getAvatarFilePath(opts.avatarKey);
  const avatarBoxX = avatarCx - avatarRadius;
  const avatarBoxY = avatarCy - avatarRadius;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
  ctx.clip();
  if (avatarPath) {
    try {
      const avatarImg = await loadImage(avatarPath);
      drawCover(ctx, avatarImg, avatarBoxX, avatarBoxY, AVATAR_DIAMETER, AVATAR_DIAMETER, AVATAR_FOCUS_Y);
    } catch (err) {
      logger.warn(`[moodCard] Failed to load avatar "${avatarPath}"`, err);
      drawAvatarPlaceholder(ctx, avatarBoxX, avatarBoxY, AVATAR_DIAMETER, opts.personaName, accent);
    }
  } else {
    drawAvatarPlaceholder(ctx, avatarBoxX, avatarBoxY, AVATAR_DIAMETER, opts.personaName, accent);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
  ctx.lineWidth = AVATAR_RING_WIDTH;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.restore();

  // Frosted text panel, sampling the composite so far (background + avatar).
  const panelX = (CARD_W - PANEL_WIDTH) / 2;
  const panelY = avatarTop + AVATAR_DIAMETER + GAP_AVATAR_TO_PANEL;
  drawFrostedPanel(ctx, canvas, panelX, panelY, PANEL_WIDTH, panelHeight);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;

  const maxTitleWidth = PANEL_WIDTH - 2 * PANEL_PAD_X;
  ctx.font = `${TITLE_SIZE}px "${TITLE_FONT}"`;
  const titleWidth = ctx.measureText(opts.personaName).width;
  if (titleWidth > maxTitleWidth) {
    const fitSize = Math.max(22, Math.floor((TITLE_SIZE * maxTitleWidth) / titleWidth));
    ctx.font = `${fitSize}px "${TITLE_FONT}"`;
  }
  ctx.fillText(opts.personaName, CARD_W / 2, panelY + PANEL_PAD_TOP + TITLE_BASELINE_OFFSET);

  ctx.font = `${PHRASE_SIZE}px "${PHRASE_FONT}"`;
  ctx.shadowBlur = 8;
  let ty = panelY + PANEL_PAD_TOP + TITLE_BLOCK_H + TITLE_TO_PHRASE_GAP + PHRASE_FIRST_LINE_OFFSET;
  for (const line of phraseLines) {
    ctx.fillText(line, CARD_W / 2, ty);
    ty += PHRASE_LINE_HEIGHT;
  }
  ctx.restore();

  return canvas.encode('png');
}
