// Pure core: USDA Table of Cooking Yields for Meat and Poultry, Release 2 (2014). No I/O.
import { YIELDS } from './data.js';
import type { YieldRow } from './types.js';

export const REPO = 'raw-to-cooked-weight-mcp';
export const SITE = 'https://recipetool.net';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const MORE = `${SITE}/tools/raw-to-cooked-weight-calculator?${UTM}`;
export const SOURCE = 'https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.pdf';
export const SOURCE_PAGE = 'https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/cooking-yields/';
export const AS_OF = '2014-09 (USDA Table of Cooking Yields for Meat and Poultry, Release 2; file checked 2026-11-03)';
export { YIELDS };

export class InputError extends Error {}

export const round = (x: number, d = 1) => { const f = 10 ** d; return Math.round(x * f) / f; };

// Weight units. Pound and ounce are exact (NIST SP 811: 1 lb = 0.45359237 kg, 1 oz = 1/16 lb).
export const UNITS: Record<string, number> = { gram: 1, kilogram: 1000, ounce: 28.349523125, pound: 453.59237 };
const UNIT_ALIASES: Record<string, string> = {
  g: 'gram', gram: 'gram', grams: 'gram', gr: 'gram',
  kg: 'kilogram', kilo: 'kilogram', kilos: 'kilogram', kilogram: 'kilogram', kilograms: 'kilogram',
  oz: 'ounce', ounce: 'ounce', ounces: 'ounce',
  lb: 'pound', lbs: 'pound', pound: 'pound', pounds: 'pound',
};
export function resolveUnit(u: string): string {
  const k = UNIT_ALIASES[u.trim().toLowerCase().replace(/\.$/, '')];
  if (!k) throw new InputError(`Unknown unit "${u}". Use g, kg, oz or lb.`);
  return k;
}

// Cooking method families. Each maps to the USDA "Preparation Method" labels it covers.
export const METHODS: Record<string, { label: string; matches: string[]; words: string[] }> = {
  roast: { label: 'Baked or roasted', matches: ['Baked or Roasted, unspecified', 'Roasted', 'Baked or Roasted, specified time'], words: ['roast', 'roasted', 'bake', 'baked', 'oven', 'smoked', 'smoke'] },
  grill: { label: 'Broiled or grilled', matches: ['Broiled or Grilled', 'Grilled', 'Broiled', 'Broiled or grilled'], words: ['grill', 'grilled', 'broil', 'broiled', 'bbq', 'barbecue', 'barbecued', 'barbeque'] },
  braise: { label: 'Braised', matches: ['Braised'], words: ['braise', 'braised', 'pot roast', 'slow cook', 'slow cooker', 'crock pot', 'crockpot', 'pressure cook', 'instant pot'] },
  simmer: { label: 'Poached, simmered or stewed', matches: ['Poached, Simmered or Stewed'], words: ['poach', 'poached', 'simmer', 'simmered', 'stew', 'stewed', 'boil', 'boiled'] },
  pan_fry: { label: 'Pan-fried or sauteed', matches: ['Pan-fried', 'Pan-fried or Sauteed', 'Pan-browned'], words: ['pan fry', 'pan fried', 'pan-fry', 'pan-fried', 'fry', 'fried', 'saute', 'sauteed', 'sear', 'seared', 'brown', 'browned', 'skillet', 'stir fry'] },
  pan_broil: { label: 'Pan-broiled', matches: ['Pan-broiled', 'Pan broiled'], words: ['pan broil', 'pan broiled', 'pan-broil', 'pan-broiled', 'griddle'] },
  deep_fry: { label: 'Fried in deep fat', matches: ['Fried in deep fat'], words: ['deep fry', 'deep fried', 'deep-fry', 'deep-fried'] },
  microwave: { label: 'Microwaved', matches: ['Microwaved'], words: ['microwave', 'microwaved'] },
};
export function resolveMethod(m: string): string {
  const s = m.trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  if (METHODS[s.replace(/ /g, '_')]) return s.replace(/ /g, '_');
  // Longest phrase wins so "pan broiled" beats "broiled" and "deep fried" beats "fried".
  let best: [string, number] | null = null;
  for (const [k, v] of Object.entries(METHODS)) {
    for (const w of v.words) {
      const ww = w.replace(/-/g, ' ');
      if ((s === ww || s.includes(ww)) && (!best || ww.length > best[1])) best = [k, ww.length];
    }
  }
  if (!best) throw new InputError(`Unknown cooking method "${m}". Use one of: ${Object.keys(METHODS).join(', ')} (roast, grill, braise, simmer, pan_fry, pan_broil, deep_fry, microwave).`);
  return best[0];
}
export const methodFamily = (row: YieldRow) => Object.keys(METHODS).find((k) => METHODS[k].matches.includes(row.method)) ?? 'other';

// Ground meat: "80/20", "85% lean", "93/7" to the USDA fat class of that species.
export function groundFatClass(q: string, species: 'beef' | 'pork'): string | null {
  let fat: number | null = null;
  const ratio = q.match(/(\d{2})\s*\/\s*(\d{1,2})\b/);
  const lean = q.match(/(\d{2})\s*%?\s*lean/);
  const fatm = q.match(/(\d{1,2})\s*%?\s*fat/);
  if (ratio) fat = Number(ratio[2]);
  else if (lean) fat = 100 - Number(lean[1]);
  else if (fatm) fat = Number(fatm[1]);
  if (fat === null) return null;
  if (species === 'beef') return fat < 12 ? 'low fat' : fat <= 22 ? 'medium fat' : 'high fat';
  return fat < 10 ? 'low fat' : fat <= 27 ? 'medium fat' : 'high fat';
}

const SYN: Array<[RegExp, string]> = [
  [/\bhamburgers?\b|\bburgers?\b/g, 'ground patty'],
  [/\bmince(d)?\b|\bminced meat\b/g, 'ground'],
  [/\bmeatloaf\b|\bmeat loaf\b/g, 'ground loaf'],
  [/\bribeye\b/g, 'rib eye'],
  [/\btri tip\b|\btritip\b/g, 'tri-tip'],
  [/\bfilet mignon\b|\bfillet\b|\bfilet\b/g, 'tenderloin'],
  [/\bnew york strip\b|\bstrip steak\b|\bny strip\b|\bstrip\b/g, 'top loin steak'],
  [/\bbuffalo\b/g, 'bison'],
  [/\bvenison\b/g, 'deer'],
  [/\bpork chops?\b/g, 'pork chops'],
  [/\bbaby back ribs?\b|\bbabyback\b/g, 'backribs'],
  [/\bback ribs?\b/g, 'backribs back ribs'],
  [/\bspare ribs?\b/g, 'spareribs'],
  [/\bpork butt\b|\bboston butt\b/g, 'pork shoulder blade roasts'],
  [/\bpicnic\b/g, 'arm picnic'],
  [/\bdrumsticks?\b|\blegs?\b(?=.*chicken|.*turkey)/g, 'drumstick'],
  [/\bthighs\b/g, 'thigh'],
  [/\bwings\b/g, 'wing'],
  [/\bbreasts\b/g, 'breast'],
  [/\bcrumbled\b|\bloose\b/g, 'crumbles'],
  [/\bpatties\b/g, 'patty'],
  [/\bchops\b/g, 'chops'],
  [/\boffal\b|\borgan\b/g, 'variety meats'],
];
const STOP = new Set(['the', 'of', 'a', 'an', 'and', 'raw', 'cooked', 'meat', 'piece', 'pieces', 'fresh', 'how', 'much', 'weight', 'to', 'in', 'with', 'for', 'separable', 'all', 'grades', 'trimmed', 'fat', 'lean']);
const stem = (w: string) => (w.length > 4 && w.endsWith('es') && !w.endsWith('ies') ? w.slice(0, -1) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9>< -]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);

export function normalizeQuery(q: string): string {
  let s = ` ${q.toLowerCase()} `;
  const species: 'beef' | 'pork' | null = /\bpork\b/.test(s) ? 'pork' : /\b(beef|hamburger|burger|mince|ground|meatloaf|meat loaf)\b/.test(s) && !/\b(turkey|chicken|bison|elk|deer|venison|emu|ostrich|lamb|veal)\b/.test(s) ? 'beef' : null;
  if (species && /\b(ground|hamburger|burger|mince|meatloaf|meat loaf|\d{2}\s*\/\s*\d{1,2})\b/.test(s)) {
    const fc = groundFatClass(s, species);
    if (fc) s += ` ${fc} ground `;
    if (!/\bground\b/.test(s)) s += ' ground ';
  }
  for (const [re, rep] of SYN) s = s.replace(re, ` ${rep} `);
  return s.replace(/\s+/g, ' ').trim();
}

// Foods the USDA meat and poultry table does not cover; refuse instead of returning a wrong cut.
const NOT_COVERED = /\b(fish|salmon|tuna|cod|tilapia|halibut|trout|shrimp|prawns?|crab|lobster|scallops?|mussels?|clams?|oysters?|squid|seafood|duck|goose|quail|rabbit|goat|tofu|tempeh|seitan|rice|pasta|noodles?|quinoa|beans?|lentils?|oats?|potato(es)?|vegetables?|eggs?)\b/i;

export interface Match { row: YieldRow; score: number }

/** Rank table rows for a free-text food. Method, when given, filters to that family. */
export function rankRows(food: string, method?: string): { matches: Match[]; methodKey: string | null; methodRelaxed: boolean } {
  if (!food || !food.trim()) throw new InputError('food is required, for example "chicken thigh", "80/20 ground beef patty" or "pork tenderloin".');
  if (NOT_COVERED.test(food)) return { matches: [], methodKey: method ? resolveMethod(method) : null, methodRelaxed: false };
  const norm = normalizeQuery(food);
  const q = [...new Set(tokens(norm))];
  if (!q.length) throw new InputError(`Could not read a food name from "${food}".`);
  const methodKey = method ? resolveMethod(method) : null;
  const methodHint = methodKey;
  const score = (r: YieldRow) => {
    const d = new Set(tokens(`${r.description} ${r.group}`));
    let s = 0;
    for (const t of q) if (d.has(t)) s += t === 'beef' || t === 'pork' || t === 'chicken' || t === 'turkey' ? 2 : 1;
    // Fat class tokens (low/medium/high) must agree when the query names one.
    for (const fc of ['low', 'medium', 'high']) if (q.includes(fc) && d.has(fc) === false && /ground/.test(r.description)) s -= 1.5;
    if (/retail/.test(r.description)) s -= 0.5; // generic rows rank under a named cut
    if (/(^|, )enhanced/.test(r.description) && !q.includes('enhanced')) s -= 0.3;
    if (/\bground\b/i.test(r.description) && q.includes('ground')) {
      // No fat class named: default to the medium class (80/20 and 85/15 sit there).
      if (!['low', 'medium', 'high'].some((c) => q.includes(c)) && /medium fat/.test(r.description)) s += 0.3;
      // No form named: patty for grill and pan-broil, loaf for oven, crumbles otherwise.
      if (!['patty', 'loaf', 'crumble'].some((f) => q.includes(f))) {
        const form = methodHint === 'grill' || methodHint === 'pan_broil' ? 'patty' : methodHint === 'roast' ? 'loaf' : 'crumbles';
        if (r.description.includes(form)) s += 0.3;
      }
    }
    if (q.includes('ham') && (/\bfresh\b/.test(norm) ? /fresh/.test(r.description) : /cured/.test(r.description))) s += 0.5;
    if (/variety meats/.test(r.description) && !q.some((t) => ['liver', 'heart', 'kidney', 'tripe', 'brain', 'gizzard', 'giblet', 'feet', 'chitterling', 'stomach', 'variety'].includes(t))) s -= 3;
    return s;
  };
  // A species word in the query must appear in the row: "chicken thigh" never returns a turkey thigh.
  const SPECIES = ['beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'bison', 'deer', 'elk', 'emu', 'ostrich'];
  const want = SPECIES.filter((s) => q.includes(s));
  const all = YIELDS.filter((r) => !want.length || want.some((s) => tokens(r.description).includes(s)))
    .map((row) => ({ row, score: score(row) })).filter((m) => m.score > 0);
  const order = (a: Match, b: Match) => b.score - a.score || (b.row.n ?? 0) - (a.row.n ?? 0) || a.row.description.length - b.row.description.length;
  all.sort(order);
  if (!all.length) return { matches: [], methodKey, methodRelaxed: false };
  const top = all[0].score;
  if (methodKey) {
    const inFamily = all.filter((m) => methodFamily(m.row) === methodKey);
    // Keep the method only if it does not cost the food match more than one term.
    if (inFamily.length && inFamily[0].score >= top - 1) return { matches: inFamily, methodKey, methodRelaxed: false };
    return { matches: all, methodKey, methodRelaxed: true };
  }
  return { matches: all, methodKey, methodRelaxed: false };
}

export function rowOut(r: YieldRow) {
  return {
    yield_id: r.id,
    food: r.description,
    category: r.group,
    cooking_method: r.method,
    cooking_yield_percent: round(r.yield_pct, 1),
    weight_change_percent: round(r.yield_pct - 100, 1),
    yield_range_percent: r.min_pct != null && r.max_pct != null ? [round(r.min_pct, 1), round(r.max_pct, 1)] : null,
    samples: r.n,
    standard_deviation: r.sd,
    moisture_change_percent: r.moisture_change_pct,
    fat_change_percent: r.fat_change_pct,
    usda_ndb_number: r.ndb,
    data_year: r.release_year,
  };
}

function pick(food: string | undefined, method: string | undefined, yieldId: number | undefined) {
  if (yieldId !== undefined) {
    const row = YIELDS.find((r) => r.id === yieldId);
    if (!row) throw new InputError(`No yield_id ${yieldId}. Valid ids are 1-${YIELDS.length}; use find_cooking_yield to look one up.`);
    return { row, alternatives: [] as YieldRow[], note: null as string | null };
  }
  const { matches, methodKey, methodRelaxed } = rankRows(food ?? '', method);
  if (!matches.length) {
    throw new InputError(`"${food}" is not in the USDA Table of Cooking Yields for Meat and Poultry. It covers beef, pork, chicken, turkey, lamb, veal, bison, elk, deer, emu and ostrich cuts, ground meat, bacon, ham and some organ meats. It has no fish, seafood, rice, pasta or vegetables.`);
  }
  const row = matches[0].row;
  const note = methodRelaxed
    ? `USDA has no ${METHODS[methodKey!].label.toLowerCase()} yield for a close match to "${food}"; the closest row uses ${row.method.toLowerCase()}.`
    : null;
  return { row, alternatives: matches.slice(1, 6).map((m) => m.row), note };
}

const basics = () => ({ source: SOURCE, source_page: SOURCE_PAGE, as_of: AS_OF, more: MORE });
const caveat = 'USDA yield is hot cooked weight divided by raw weight of the same piece, measured in USDA research kitchens; your result moves with doneness, trim, bone and pan juices.';

export function findCookingYield(a: { food: string; method?: string; limit?: number }) {
  const { matches, methodKey, methodRelaxed } = rankRows(a.food, a.method);
  if (!matches.length) pick(a.food, a.method, undefined); // throws the coverage message
  const rows = matches.slice(0, a.limit ?? 5).map((m) => rowOut(m.row));
  const b = rows[0];
  const summary = `${b.food}, ${b.cooking_method.toLowerCase()}: USDA cooking yield ${b.cooking_yield_percent}% (cooked weight = ${b.cooking_yield_percent}% of raw, a ${Math.abs(b.weight_change_percent)}% loss)` +
    `${b.yield_range_percent ? `, range ${b.yield_range_percent[0]}-${b.yield_range_percent[1]}% across ${b.samples ?? 'several'} samples` : ''}.` +
    `${methodRelaxed ? ` No ${METHODS[methodKey!].label.toLowerCase()} row matched closely, so other methods are shown.` : ''} ${rows.length - 1} other close rows follow. Source: USDA Table of Cooking Yields for Meat and Poultry (2014).`;
  return { summary, query: a.food, method_filter: methodKey ? METHODS[methodKey].label : null, best_match: b, other_matches: rows.slice(1), how_to_use: 'cooked weight = raw weight x yield / 100; raw weight = cooked weight / (yield / 100).', ...basics() };
}

function weightOut(grams: number) {
  return { grams: round(grams, 1), ounces: round(grams / UNITS.ounce, 2), pounds: round(grams / UNITS.pound, 3), kilograms: round(grams / 1000, 3) };
}

export function convertRawToCooked(a: { food?: string; method?: string; yield_id?: number; raw_weight: number; unit?: string }) {
  const unit = resolveUnit(a.unit ?? 'gram');
  if (!(a.raw_weight > 0)) throw new InputError('raw_weight must be a positive number.');
  const { row, alternatives, note } = pick(a.food, a.method, a.yield_id);
  const g = a.raw_weight * UNITS[unit];
  const cooked = (g * row.yield_pct) / 100;
  const lo = row.min_pct != null ? (g * row.min_pct) / 100 : null;
  const hi = row.max_pct != null ? (g * row.max_pct) / 100 : null;
  const cookedIn = cooked / UNITS[unit];
  const summary = `${a.raw_weight} ${unit}${a.raw_weight === 1 ? '' : 's'} raw ${row.description.toLowerCase()} (${row.method.toLowerCase()}) cooks down to about ${round(cookedIn, 2)} ${unit}s (${round(cooked, 0)} g) at the USDA cooking yield of ${row.yield_pct}%` +
    `${lo != null && hi != null ? `; USDA samples ranged ${round(lo / UNITS[unit], 2)}-${round(hi / UNITS[unit], 2)} ${unit}s` : ''}. ${note ? note + ' ' : ''}${caveat}`;
  return {
    summary, input: { raw_weight: a.raw_weight, unit }, cooked_weight: { ...weightOut(cooked), in_input_unit: round(cookedIn, 2) },
    cooked_weight_range: lo != null && hi != null ? { low: weightOut(lo), high: weightOut(hi) } : null,
    weight_lost: weightOut(g - cooked), yield: rowOut(row), note, other_matches: alternatives.map(rowOut).slice(0, 4), ...basics(),
  };
}

export function convertCookedToRaw(a: { food?: string; method?: string; yield_id?: number; cooked_weight: number; unit?: string }) {
  const unit = resolveUnit(a.unit ?? 'gram');
  if (!(a.cooked_weight > 0)) throw new InputError('cooked_weight must be a positive number.');
  const { row, alternatives, note } = pick(a.food, a.method, a.yield_id);
  const g = a.cooked_weight * UNITS[unit];
  const raw = g / (row.yield_pct / 100);
  const rawIn = raw / UNITS[unit];
  const summary = `${a.cooked_weight} ${unit}${a.cooked_weight === 1 ? '' : 's'} of cooked ${row.description.toLowerCase()} (${row.method.toLowerCase()}) came from about ${round(rawIn, 2)} ${unit}s (${round(raw, 0)} g) raw, using the USDA cooking yield of ${row.yield_pct}%. ` +
    `Use the raw weight with raw nutrition data when you log food or scale a recipe. ${note ? note + ' ' : ''}${caveat}`;
  return {
    summary, input: { cooked_weight: a.cooked_weight, unit }, raw_weight: { ...weightOut(raw), in_input_unit: round(rawIn, 2) },
    raw_weight_range: row.min_pct && row.max_pct ? { if_yield_was_high: weightOut(g / (row.max_pct / 100)), if_yield_was_low: weightOut(g / (row.min_pct / 100)) } : null,
    yield: rowOut(row), note, other_matches: alternatives.map(rowOut).slice(0, 4), ...basics(),
  };
}

export function calculateRawWeightToBuy(a: { food?: string; method?: string; yield_id?: number; servings: number; cooked_serving_size?: number; unit?: string }) {
  const unit = resolveUnit(a.unit ?? 'ounce');
  if (!(a.servings > 0)) throw new InputError('servings must be a positive number.');
  const size = a.cooked_serving_size ?? (unit === 'ounce' ? 3 : unit === 'gram' ? 85 : unit === 'pound' ? 0.1875 : 0.085);
  const { row, note } = pick(a.food, a.method, a.yield_id);
  const cookedG = a.servings * size * UNITS[unit];
  const rawG = cookedG / (row.yield_pct / 100);
  const summary = `For ${a.servings} servings of ${size} ${unit}${size === 1 ? '' : 's'} cooked ${row.description.toLowerCase()} (${row.method.toLowerCase()}), buy about ${round(rawG / UNITS.pound, 2)} lb (${round(rawG, 0)} g) raw at the USDA cooking yield of ${row.yield_pct}%. ` +
    `Weights are for the cut as described; a bone-in cut still includes its bone in the cooked weight. ${note ?? ''}`.trim();
  return { summary, servings: a.servings, cooked_serving_size: { amount: size, unit }, cooked_total: weightOut(cookedG), raw_to_buy: weightOut(rawG), yield: rowOut(row), note, ...basics() };
}

export function listCookingYields(a: { category?: string; method?: string }) {
  const cats = ['beef', 'pork', 'poultry', 'lamb, veal and game', 'sausages and luncheon meats'];
  let rows = YIELDS;
  if (a.category) {
    const c = a.category.toLowerCase();
    const key = /chicken|turkey|poultry/.test(c) ? 'poultry' : /lamb|veal|game|bison|deer|elk/.test(c) ? 'lamb, veal and game' : /sausage/.test(c) ? 'sausages and luncheon meats' : cats.find((x) => x.startsWith(c) || c.startsWith(x));
    if (!key) throw new InputError(`Unknown category "${a.category}". Use beef, pork, poultry, lamb (lamb, veal and game) or sausage.`);
    const sp = c.match(/chicken|turkey/)?.[0];
    rows = rows.filter((r) => (sp ? r.description.toLowerCase().startsWith(sp) : r.group === key));
  }
  if (a.method) { const m = resolveMethod(a.method); rows = rows.filter((r) => methodFamily(r) === m); }
  const out = rows.map((r) => ({ yield_id: r.id, food: r.description, cooking_method: r.method, cooking_yield_percent: round(r.yield_pct, 1) }));
  const ys = rows.map((r) => r.yield_pct);
  const summary = `${out.length} USDA cooking yield rows${a.category ? ` for ${a.category}` : ''}${a.method ? ` cooked by ${METHODS[resolveMethod(a.method)].label.toLowerCase()}` : ''}` +
    (ys.length ? `, yields from ${Math.min(...ys)}% to ${Math.max(...ys)}%.` : '.') + ' Pass a yield_id to convert_raw_to_cooked or convert_cooked_to_raw to use an exact row.';
  return { summary, count: out.length, rows: out, ...basics() };
}

// Text for the Worker home page.
export const HOME = {
  short: 'raw-to-cooked',
  description: 'MCP server for raw to cooked weight of meat and poultry by cut and cooking method, from the USDA Table of Cooking Yields for Meat and Poultry.',
  intro: 'Raw to cooked weight and cooked to raw weight for beef, pork, chicken, turkey, lamb, veal, bison and game, by cut and cooking method, from the 173 measured rows of the USDA Table of Cooking Yields for Meat and Poultry (ARS). No key, no sign-up.',
  site_line: `A raw to cooked weight calculator and recipe nutrition tools are on <a href="${MORE}">recipetool.net</a>.`,
};
