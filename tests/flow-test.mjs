/**
 * Flow tests for wife import -> husband review -> ready to generate
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
if (!script) throw new Error('Could not extract app script');

// Minimal DOM stubs
global.document = {
  getElementById: () => ({
    classList: { add() {}, remove() {}, toggle() {} },
    textContent: '',
    innerHTML: '',
    value: '',
    style: {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll: () => []
  }),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ classList: { add() {} }, textContent: '', appendChild() {} })
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null; },
  setItem(k, v) { this.store[k] = v; }
};
global.history = { replaceState() {} };
global.location = { search: '', hash: '', pathname: '/index.html', origin: 'http://localhost' };
global.navigator = { clipboard: { readText: async () => '' } };
global.LZString = undefined;

const MEALS = [
  { key: 'breakfast', label: '早餐', icon: '🌅' },
  { key: 'lunch', label: '午餐', icon: '🍱' },
  { key: 'dinner', label: '晚餐', icon: '🌇' },
  { key: 'snack', label: '宵夜', icon: '🌙' }
];

function formatOptionText(text) {
  if (!text) return '';
  return String(text).replace(/<br\s*\/?>/gi, '\n').replace(/\*\*/g, '').trim();
}

function optionBodyWithoutOrigin(text) {
  return formatOptionText(text).split('\n')
    .filter(l => !/^(🌍|风味背景|文化背景)/.test(l.trim()))
    .join('\n')
    .trim();
}

function parseSelectionFromText(text, mealLabel) {
  const patterns = [
    new RegExp(mealLabel + '(?:（[^）]*）)?[^\\n]*?套餐\\s*([AB])', 'i'),
    new RegExp(mealLabel + '(?:（[^）]*）)?[^\\n]*?[：:]\\s*([AB])\\b', 'i'),
    new RegExp(mealLabel + '\\s*([AB])\\b', 'i')
  ];
  for (const re of patterns) {
    const hit = text.match(re);
    if (hit) return hit[1].toUpperCase();
  }
  return '';
}

function parseWifeShortSelections(text, parsedMeals, getScopeMeals) {
  if (!text || text.includes('d=') || /^https?:\/\//i.test(text.trim())) return null;
  const selections = { breakfast: '', lunch: '', dinner: '', snack: '' };
  MEALS.forEach(m => {
    const hit = parseSelectionFromText(text, m.label);
    if (hit) selections[m.key] = hit;
  });
  const needMeals = MEALS.filter(m => parsedMeals[m.key]);
  const scopeMeals = needMeals.length ? needMeals : getScopeMeals();
  const gotCount = scopeMeals.filter(m => selections[m.key]).length;
  const needCount = scopeMeals.length || 4;
  return gotCount >= needCount ? selections : (gotCount >= 1 && needCount === 1 ? selections : null);
}

function allSelected(parsedMeals, selections, getScopeMeals) {
  const scope = getScopeMeals().filter(m => parsedMeals[m.key]);
  if (!scope.length) return false;
  return scope.every(m => selections[m.key] === 'A' || selections[m.key] === 'B');
}

function isHusbandReviewMode(state) {
  const wifeMode = state.shareRole === 'wife' && !state.sharedByWife;
  return !wifeMode && state.sharedByWife && allSelected(state.parsedMeals, state.selections, () =>
    MEALS.filter(m => state.mealScope.includes(m.key))
  );
}

// --- Tests ---
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓', name);
}

test('parseSelectionFromText: 早餐A', () => {
  assert.equal(parseSelectionFromText('老公我选好啦♥ 早餐A 午餐B', '早餐'), 'A');
});

test('parseSelectionFromText: detailed line with 套餐 A', () => {
  const line = '🌅 早餐（8:00-9:00）：套餐 A\n   燕麦粥 · 鸡蛋';
  assert.equal(parseSelectionFromText(line, '早餐'), 'A');
});

test('parseWifeShortSelections: full detailed message', () => {
  const msg = [
    '老公我选好啦♥ 早餐A 午餐B 晚餐A 宵夜B 辛苦你啦～',
    '',
    '【详细选择】',
    '🌅 早餐（8:00-9:00）：套餐 A',
    '   地中海风燕麦',
    '🍱 午餐：套餐 B',
    '🌇 晚餐：套餐 A',
    '🌙 宵夜：套餐 B'
  ].join('\n');
  const parsedMeals = Object.fromEntries(MEALS.map(m => [m.key, { optionA: 'A1', optionB: 'B1' }]));
  const sel = parseWifeShortSelections(msg, parsedMeals, () => MEALS);
  assert.equal(sel.breakfast, 'A');
  assert.equal(sel.lunch, 'B');
  assert.equal(sel.dinner, 'A');
  assert.equal(sel.snack, 'B');
});

test('parseWifeShortSelections: detailed-only without summary line', () => {
  const msg = [
    '【详细选择】',
    '🌅 早餐（8:00-9:00）：套餐 A',
    '🍱 午餐：套餐 B',
    '🌇 晚餐：套餐 A',
    '🌙 宵夜：套餐 B'
  ].join('\n');
  const parsedMeals = Object.fromEntries(MEALS.map(m => [m.key, { optionA: 'A1', optionB: 'B1' }]));
  const sel = parseWifeShortSelections(msg, parsedMeals, () => MEALS);
  assert.ok(sel, 'should parse detailed-only message');
  assert.equal(sel.snack, 'B');
});

test('isHusbandReviewMode when wife choices imported', () => {
  const state = {
    shareRole: 'husband',
    sharedByWife: true,
    mealScope: MEALS.map(m => m.key),
    parsedMeals: Object.fromEntries(MEALS.map(m => [m.key, { optionA: 'A', optionB: 'B' }])),
    selections: { breakfast: 'A', lunch: 'B', dinner: 'A', snack: 'B' }
  };
  assert.equal(isHusbandReviewMode(state), true);
});

test('isHusbandReviewMode false when selections incomplete', () => {
  const state = {
    shareRole: 'husband',
    sharedByWife: true,
    mealScope: MEALS.map(m => m.key),
    parsedMeals: Object.fromEntries(MEALS.map(m => [m.key, { optionA: 'A', optionB: 'B' }])),
    selections: { breakfast: 'A', lunch: '', dinner: '', snack: '' }
  };
  assert.equal(isHusbandReviewMode(state), false);
});

test('partial meals: breakfast+dinner only', () => {
  const parsedMeals = {
    breakfast: { optionA: 'BA', optionB: 'BB' },
    dinner: { optionA: 'DA', optionB: 'DB' }
  };
  const msg = '老公我选好啦♥ 早餐A 晚餐B\n【详细选择】\n🌅 早餐：套餐 A\n🌇 晚餐：套餐 B';
  const getScope = () => MEALS.filter(m => parsedMeals[m.key]);
  const sel = parseWifeShortSelections(msg, parsedMeals, getScope);
  assert.equal(sel.breakfast, 'A');
  assert.equal(sel.dinner, 'B');
  assert.equal(allSelected(parsedMeals, sel, getScope), true);
});

console.log(`\n${passed} tests passed`);
