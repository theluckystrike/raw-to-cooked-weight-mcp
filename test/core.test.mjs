// Fixtures: values copied from the USDA Table of Cooking Yields for Meat and Poultry, Release 2 (2014),
// USDA_CookingYields_MeatPoultry02.xlsx, plus hand-checked arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  YIELDS, UNITS, rankRows, resolveMethod, resolveUnit, groundFatClass, convertRawToCooked, convertCookedToRaw,
  calculateRawWeightToBuy, findCookingYield, listCookingYields, InputError, MORE, SOURCE,
} from '../dist/core.js';

const best = (food, method) => rankRows(food, method).matches[0].row;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('table has all 173 USDA rows (175 sheet rows minus 2 footnotes)', () => {
  assert.equal(YIELDS.length, 173);
  assert.equal(YIELDS.filter((r) => r.group === 'beef').length, 66);
  assert.equal(YIELDS.filter((r) => r.group === 'pork').length, 58);
});
test('bacon pan-fried 32%, microwaved 29%', () => {
  assert.equal(best('bacon', 'pan fry').yield_pct, 32);
  assert.equal(best('bacon', 'microwave').yield_pct, 29);
});
test('80/20 ground beef maps to medium fat (12%-22%) crumbles, pan-fried 67%', () => {
  const r = best('80/20 ground beef');
  assert.match(r.description, /medium fat \(12%-22%\), crumbles/); assert.equal(r.yield_pct, 67);
});
test('93% lean ground beef patty grilled is low fat (<12%) patty 73%', () => {
  const r = best('93% lean ground beef patty', 'grill');
  assert.match(r.description, /low fat \(<12%\), patty/); assert.equal(r.yield_pct, 73);
});
test('ground beef fat classes: 73/27 high, 85/15 medium, 90/10 low; pork 10/27 cut-offs', () => {
  assert.equal(groundFatClass('73/27', 'beef'), 'high fat'); assert.equal(groundFatClass('85/15', 'beef'), 'medium fat');
  assert.equal(groundFatClass('90/10', 'beef'), 'low fat'); assert.equal(groundFatClass('70% lean', 'pork'), 'high fat');
  assert.equal(groundFatClass('92% lean', 'pork'), 'low fat');
});
test('chicken thigh roasted: NDB 05094 broiler-fryer thigh meat and skin 69%, range 58-79%', () => {
  const r = best('chicken thigh', 'roast');
  assert.equal(r.ndb, '05094'); assert.equal(r.yield_pct, 69); assert.equal(r.min_pct, 58); assert.equal(r.max_pct, 79);
});
test('chicken breast roasted 72% with range 61-82% (AH-102, 1975)', () => {
  const r = best('chicken breast', 'roast');
  assert.equal(r.yield_pct, 72); assert.equal(r.min_pct, 61); assert.equal(r.max_pct, 82); assert.equal(r.release_year, 1975);
});
test('brisket flat braised 69%, n=20; rib eye steak bone-in grilled 85.7%', () => {
  const b = best('brisket', 'braise'); assert.equal(b.yield_pct, 69); assert.equal(b.n, 20);
  assert.equal(best('bone-in ribeye steak', 'grill').yield_pct, 85.7);
});
test('turkey breast defaults to non-enhanced roasted 72%; whole turkey 71%', () => {
  assert.equal(best('turkey breast').yield_pct, 72);
  assert.equal(best('whole turkey non-enhanced').yield_pct, 71);
});
test('raw to cooked: 2 lb chicken thigh roasted = 2 x 453.59237 x 0.69 = 625.95 g', () => {
  const r = convertRawToCooked({ food: 'chicken thigh', method: 'roast', raw_weight: 2, unit: 'lb' });
  close(r.cooked_weight.grams, 626.0, 0.05); close(r.cooked_weight.in_input_unit, 1.38, 1e-9);
  close(r.cooked_weight_range.low.grams, 526.2, 1e-9); close(r.cooked_weight_range.high.grams, 716.7, 1e-9); // x0.58, x0.79
});
test('cooked to raw: 113 g cooked 80/20 crumbles / 0.67 = 168.66 g raw', () => {
  const r = convertCookedToRaw({ food: '80/20 ground beef', cooked_weight: 113 });
  close(r.raw_weight.grams, 168.7, 1e-9);
});
test('cooked to raw by yield_id ignores food text (id 98 bacon baked 32%)', () => {
  const r = convertCookedToRaw({ yield_id: 98, cooked_weight: 32, unit: 'g' });
  assert.equal(r.yield.cooking_yield_percent, 32); close(r.raw_weight.grams, 100, 1e-9);
});
test('raw to buy: 10 x 3 oz brisket at 69% = 30 x 28.349523125 / 0.69 = 1232.6 g = 2.72 lb', () => {
  const r = calculateRawWeightToBuy({ food: 'brisket', method: 'braise', servings: 10 });
  close(r.raw_to_buy.grams, 1232.6, 1e-9); close(r.raw_to_buy.pounds, 2.717, 1e-9);
});
test('method relaxed with a note when USDA has no row (grilled chicken breast)', () => {
  const r = convertRawToCooked({ food: 'chicken breast', method: 'grilled', raw_weight: 100 });
  assert.match(r.note, /no broiled or grilled yield/); assert.equal(r.yield.cooking_yield_percent, 72);
});
test('fish and rice are refused with a coverage message', () => {
  assert.throws(() => convertRawToCooked({ food: 'salmon fillet', raw_weight: 100 }), InputError);
  assert.throws(() => findCookingYield({ food: 'white rice' }), /not in the USDA Table/);
});
test('units and methods: lb, oz exact; slow cooker = braise, pan broiled beats broiled', () => {
  close(UNITS.pound, 453.59237); close(UNITS.ounce * 16, UNITS.pound, 1e-9); assert.equal(resolveUnit('LBS'), 'pound');
  assert.equal(resolveMethod('slow cooker'), 'braise'); assert.equal(resolveMethod('pan-broiled'), 'pan_broil');
  assert.equal(resolveMethod('deep fried'), 'deep_fry'); assert.throws(() => resolveMethod('sous vide'), InputError);
  assert.throws(() => resolveUnit('cup'), InputError);
});
test('list filters: chicken 21 rows, poultry 35, beef braised rows all braised', () => {
  assert.equal(listCookingYields({ category: 'chicken' }).count, 21);
  assert.equal(listCookingYields({ category: 'poultry' }).count, 35);
  assert.ok(listCookingYields({ category: 'beef', method: 'braise' }).rows.every((r) => r.cooking_method === 'Braised'));
});
test('every result carries source, as_of and a recipetool.net more link with UTM', () => {
  const r = findCookingYield({ food: 'pork tenderloin' });
  assert.equal(r.source, SOURCE); assert.ok(r.as_of.startsWith('2014'));
  assert.equal(r.more, MORE); assert.match(r.more, /^https:\/\/recipetool\.net\/tools\/raw-to-cooked-weight-calculator\?utm_source=mcp&utm_medium=raw-to-cooked-weight-mcp$/);
});
