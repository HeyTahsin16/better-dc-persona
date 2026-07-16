import { Persona } from '../types';

// Imports and the PERSONAS map below are both kept in A-Z order (by display name) —
// purely for convenience when cross-referencing against avatars/README.md, not because
// it matters functionally. listPersonas() re-sorts at runtime regardless, so insertion
// order here never actually affects output.
import { hayasaka } from './hayasaka';
import { alya } from './alya';
import { amiya } from './amiya';
import { anis } from './anis';
import { arimaKana } from './arimaKana';
import { asuna } from './asuna';
import { bocchi } from './bocchi';
import { cc } from './cc';
import { chika } from './chika';
import { chisatoNishikigi } from './chisatoNishikigi';
import { chizuru } from './chizuru';
import { erinaNakiri } from './erinaNakiri';
import { fern } from './fern';
import { frieren } from './frieren';
import { hakari } from './hakari';
import { hayaseYuuka } from './hayaseYuuka';
import { ichika } from './ichika';
import { kita } from './kita';
import { irohaIsshiki } from './irohaIsshiki';
import { itsuki } from './itsuki';
import { kafka } from './kafka';
import { kaguya } from './kaguya';
import { mai } from './mai';
import { makima } from './makima';
import { makiseKurisu } from './makiseKurisu';
import { march7th } from './march7th';
import { marin } from './marin';
import { mikuNakano } from './mikuNakano';
import { mitsuri } from './mitsuri';
import { miyano } from './miyano';
import { nijika } from './nijika';
import { nino } from './nino';
import { rem } from './rem';
import { rin } from './rin';
import { ryo } from './ryo';
import { silverWolf } from './silverWolf';
import { stelle } from './stelle';
import { tatsumaki } from './tatsumaki';
import { violet } from './violet';
import { yor } from './yor';
import { yotsuba } from './yotsuba';
import { yukiSuou } from './yukiSuou';

// ─── To add a new persona in the future ────────────────────────────────────
// 1. Create src/personas/<id>.ts exporting a `Persona` object (copy an existing file as a template).
// 2. Import it above and add it below, in alphabetical order by display name if convenient.
// 3. Redeploy — it will show up in /persona list and can be activated with /persona set or /mypersona set.

export const PERSONAS: Record<string, Persona> = {
  [hayasaka.id]: hayasaka,
  [alya.id]: alya,
  [amiya.id]: amiya,
  [anis.id]: anis,
  [arimaKana.id]: arimaKana,
  [asuna.id]: asuna,
  [bocchi.id]: bocchi,
  [cc.id]: cc,
  [chika.id]: chika,
  [chisatoNishikigi.id]: chisatoNishikigi,
  [chizuru.id]: chizuru,
  [erinaNakiri.id]: erinaNakiri,
  [fern.id]: fern,
  [frieren.id]: frieren,
  [hakari.id]: hakari,
  [hayaseYuuka.id]: hayaseYuuka,
  [ichika.id]: ichika,
  [kita.id]: kita,
  [irohaIsshiki.id]: irohaIsshiki,
  [itsuki.id]: itsuki,
  [kafka.id]: kafka,
  [kaguya.id]: kaguya,
  [mai.id]: mai,
  [makima.id]: makima,
  [makiseKurisu.id]: makiseKurisu,
  [march7th.id]: march7th,
  [marin.id]: marin,
  [mikuNakano.id]: mikuNakano,
  [mitsuri.id]: mitsuri,
  [miyano.id]: miyano,
  [nijika.id]: nijika,
  [nino.id]: nino,
  [rem.id]: rem,
  [rin.id]: rin,
  [ryo.id]: ryo,
  [silverWolf.id]: silverWolf,
  [stelle.id]: stelle,
  [tatsumaki.id]: tatsumaki,
  [violet.id]: violet,
  [yor.id]: yor,
  [yotsuba.id]: yotsuba,
  [yukiSuou.id]: yukiSuou,
};

// Always A-Z by display name — this is the single source every listing/autocomplete
// pulls from, so the order is consistent everywhere without needing to sort at each call site.
export function listPersonas(): Persona[] {
  return Object.values(PERSONAS).sort((a, b) => a.name.localeCompare(b.name));
}

export function getPersona(id: string): Persona | undefined {
  return PERSONAS[id];
}

export function isValidPersonaId(id: string): boolean {
  return id in PERSONAS;
}

function parseVersionParts(v: string): number[] {
  return v.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0); // descending — newest first
    if (diff !== 0) return diff;
  }
  return 0;
}

// Only returns versions that actually introduced at least one persona — a version
// that only shipped other features (e.g. v3.1, v3.3) simply won't appear here.
export function listVersions(): string[] {
  const versions = new Set(listPersonas().map(p => p.addedInVersion));
  return [...versions].sort(compareVersionsDesc);
}

// Discord caps static slash-command choices at 25 — with 40+ personas and counting,
// selection has to go through autocomplete instead. This powers that: a case-insensitive
// search across name/id/source, optionally scoped to a single version for browsing
// ("show me what v3.6 added" instead of needing to know a name), always returned A-Z,
// capped to Discord's 25-result limit either way.
export function searchPersonas(query: string, version?: string): Persona[] {
  const q = query.trim().toLowerCase();
  let candidates = listPersonas(); // already A-Z
  if (version) candidates = candidates.filter(p => p.addedInVersion === version);
  if (!q) return candidates.slice(0, 25);
  return candidates
    .filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.source.toLowerCase().includes(q))
    .slice(0, 25);
}
