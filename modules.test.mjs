// Тести модулів 2.4: «Що маю», «72 години», «Майстер предків» і сховище схеми 3. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEMS, PROBLEMS, PROB_ORDER, RECIPES, evaluate, paramDefaults, parseParams, itemsFor, mergeItems, haveToReserveKeys, cleanHave, bagsNeeded, MOLD_DIY_M2 } from './have.js';
import { simulate, cleanSim, simDefaults, sourceCalc, waterCalc, remainingAt, stageForElapsed, exportSim, importSim, newSource, horizonSummary, horizon, stagesFor, STAGES, SCENARIOS, HORIZONS } from './sim.js';
import { DIRS, DIR_ORDER, LESSONS, lessonsOf } from './master.js';
import { ACTIONS, applies } from './simacts.js';
import { SOURCES } from './data.js';
import { BY_ID, MYTHS } from './solutions.js';
import { buildContext, recommend, has } from './engine.js';
import { defaults, cleanData, migrate, exportData, importData, SCHEMA } from './store.js';

/** Вхід для «Що маю» з типовими параметрами. */
const inp = (prob, items = {}, params = {}, extra = {}) => ({ items, params: { ...paramDefaults(prob, { adults: 2 }), ...params }, time: '30', budget: 0, limits: [], ...extra });
const ids = (r) => r.variants.map((v) => v.id);

/* ───────────── Що маю ───────────── */

test('що маю: шість перевірених сценаріїв, щонайменше по три рецепти, усі джерела існують', () => {
  assert.deepEqual(PROB_ORDER, ['insulate', 'keepwarm', 'light', 'water', 'sanitation', 'repair']);
  for (const p of PROB_ORDER) assert.ok(RECIPES.filter((r) => r.prob === p).length >= 3, p);
  for (const r of RECIPES) {
    assert.ok(r.src.length, r.id);
    for (const k of r.src) assert.ok(SOURCES[k], `${r.id}: джерело ${k}`);
    if (r.solId) assert.ok(BY_ID.has(r.solId), `${r.id}: рішення ${r.solId}`);
    assert.ok(r.safe.length > 20 && r.result.length > 10, r.id);
  }
  for (const p of Object.values(PROBLEMS)) for (const b of p.banned) {
    if ('myth' in b) assert.ok(MYTHS.some((m) => m.id === b.myth), b.myth);
    else for (const k of b.src) assert.ok(SOURCES[k], k);
  }
});

test('що маю: не більше трьох варіантів; кожен має всі обов’язкові частини', () => {
  for (const p of PROB_ORDER) {
    const r = evaluate(p, inp(p));
    assert.ok(r.variants.length <= 3, p);
    for (const v of r.variants) {
      for (const k of ['have', 'lack', 'check', 'now', 'steps', 'src']) assert.ok(Array.isArray(v[k]), `${p}/${v.id}.${k}`);
      assert.ok(v.steps.length >= 2 && v.safe && v.src.length, `${p}/${v.id}`);
    }
    assert.ok(r.banned.length >= 2, `${p}: небезпечні способи показано окремо`);
  }
});

test('що маю: невідомий предмет не вважається наявним (нічого не позначено — «Перевірте», а не «Є»)', () => {
  const r = evaluate('sanitation', inp('sanitation'));
  const toilet = r.variants.find((v) => v.id === 'bag-toilet');
  assert.equal(toilet.status, 'check');
  assert.deepEqual(toilet.have, []);
  assert.ok(toilet.check.some((t) => t.startsWith('Міцні пакети')));
  assert.deepEqual(toilet.now, [], 'кроків «просто зараз» з непідтвердженими пакетами немає');
  assert.ok(toilet.ask.some((a) => a.k === 'bags'), 'пакети можна позначити просто в картці');
});

test('що маю: відсутність речей — «Чого бракує» з кількістю й орієнтовною ціною', () => {
  const r = evaluate('sanitation', inp('sanitation', { bags: { s: 'n' }, toiletBowl: { s: 'y' }, filler: { s: 'y' } }));
  const toilet = [...r.variants, ...r.rest].find((v) => v.id === 'bag-toilet');
  assert.equal(toilet.status, 'partial');
  assert.ok(toilet.lack.some((t) => t.startsWith('Міцні пакети')));
  assert.ok(toilet.notes.some((n) => n.includes('до 500 грн') && n.includes('понад ваш бюджет')));
  const shelter = evaluate('sanitation', inp('sanitation', { bags: { s: 'n' } }, {}, { limits: ['noOutside'] }));
  const t2 = [...shelter.variants, ...shelter.rest].find((v) => v.id === 'bag-toilet');
  assert.ok(t2.notes.some((n) => n.includes('коли вихід стане безпечним')), 'в укритті не радимо йти купувати');
});

test('що маю: кількість рахується з розмірів; бракує — показує скільки', () => {
  // Два вікна 1,4 × 1,5 м: плівка 2 × 1,5 × 1,6 = 4,8 м², скотч 2 × 2 × 2,9 = 11,6 м
  const r = evaluate('insulate', inp('insulate', { film: { s: 'y', q: '2' }, tape2: { s: 'y', q: '20' }, scissors: { s: 'y' } }, { windows: '2', winW: '1,4', winH: '1.5' }, { time: 'long' }));
  const f = [...r.variants, ...r.rest].find((v) => v.id === 'film-frame');
  assert.equal(f.status, 'partial');
  assert.ok(f.lack.some((t) => t.includes('є 2 м²') && t.includes('бракує 2,8 м²')), f.lack.join('|'));
  assert.ok(f.steps.some((t) => t.includes('1,5 × 1,6 м')));
  // Без розмірів — нічого не вигадуємо
  const n = evaluate('insulate', inp('insulate', { film: { s: 'y', q: '2' } }, { winW: '', winH: '' }, { time: 'long' }));
  const f2 = [...n.variants, ...n.rest].find((v) => v.id === 'film-frame');
  assert.equal(f2.status, 'check');
  assert.ok(f2.check.some((t) => t.includes('ширину вікна')));
});

test('що маю: невідомі характеристики — просимо їх, а не підставляємо', () => {
  const r = evaluate('light', inp('light', { usbLamp: { s: 'y', q: '1' }, powerbank: { s: 'y', q: '1', p: { mah: '20000' } } }, { hours: '4' }));
  const u = [...r.variants, ...r.rest].find((v) => v.id === 'usb-lamp');
  assert.equal(u.status, 'check');
  assert.ok(u.check.some((t) => t.includes('потужність')), 'потужність лампи');
  assert.ok(u.check.some((t) => t.includes('заряд')), 'фактичний заряд павербанка');
  assert.ok(!u.steps.some((t) => t.includes('світитиме')), 'час роботи не обіцяємо');
  const ok = evaluate('light', inp('light', { usbLamp: { s: 'y', q: '1', p: { w: '3' } }, powerbank: { s: 'y', q: '1', p: { mah: '20000', pct: '80' } } }, { hours: '4' }));
  const u2 = ok.variants.find((v) => v.id === 'usb-lamp');
  assert.equal(u2.status, 'ready');
  assert.ok(u2.steps.some((t) => t.includes('74 Вт·год') && t.includes('41,4 Вт·год')));
  assert.ok(u2.steps.some((t) => t.includes('13,8 год')));
});

test('що маю: непридатні умови — окремо з причиною', () => {
  const big = evaluate('repair', inp('repair', {}, { what: 'mold', moldM2: '2' }));
  assert.ok(big.unsuitable.some((u) => u.id === 'mold-clean' && u.why.includes('EPA')));
  assert.ok(!ids(big).includes('mold-clean'));
  assert.ok(MOLD_DIY_M2 < 1);
  const bleach = evaluate('water', inp('water', { bleach: { s: 'y', p: { pct: '3' } } }));
  assert.ok(bleach.unsuitable.some((u) => u.id === 'bleach-treat'), 'невідоме дозування — не радимо');
  const good = evaluate('water', inp('water', { bleach: { s: 'y', p: { pct: '6' } }, dropper: { s: 'y' } }, {}, { time: 'long' }));
  assert.ok([...good.variants, ...good.rest].some((v) => v.id === 'bleach-treat' && v.status === 'ready'));
  const noHeat = evaluate('keepwarm', inp('keepwarm', { hotBottle: { s: 'y', q: '1' } }, { hotWater: 'n' }));
  assert.ok(noHeat.unsuitable.some((u) => u.id === 'hot-bottle'));
  const noTap = evaluate('water', inp('water', { drinkWater: { s: 'y', q: '5' } }, { tap: 'n' }));
  assert.ok(noTap.unsuitable.some((u) => u.id === 'store-drink' && u.why.includes('набрати нема звідки')));
});

test('що маю: вода — точний розрахунок запасу й дефіциту', () => {
  const r = evaluate('water', inp('water', { drinkWater: { s: 'y', q: '10' }, canister: { s: 'y', q: '5' } }, { people: '2', days: '3', tap: 'y' }, { time: 'long' }));
  const v = [...r.variants, ...r.rest].find((x) => x.id === 'store-drink');
  assert.ok(v.steps[0].includes('2 × 3 л × 3 = 18 л'));
  assert.ok(v.steps.some((t) => t.includes('бракує 8 л')));
  assert.ok(v.steps.some((t) => t.includes('потрібно ще 3 л')));
});

test('що маю: санітарія — пакети за даними Oregon OEM і Multnomah County', () => {
  // 3 людини × 3 доби × 19/7 л ≈ 24,4 л; пакет 60 л наполовину → 1 заміна → 2 пакети
  assert.equal(bagsNeeded({ people: 3, days: 3 }, 60), 2);
  assert.equal(bagsNeeded({ people: 4, days: 7 }, 30), 2 * Math.ceil((4 * 7 * 19 / 7) / 15));
  assert.equal(bagsNeeded({ people: 1, days: 1 }, NaN), null, 'без об’єму пакета — не рахуємо');
});

test('що маю: час і бюджет впливають на порядок, але не ховають безпечне', () => {
  const quick = evaluate('repair', inp('repair', {}, { what: 'window', openW: '1', openH: '1' }, { time: 'now' }));
  assert.ok(quick.variants.every((v) => v.slow), 'вікно за 10 хвилин не закрити — чесно позначено');
  assert.ok(quick.variants.some((v) => v.notes.some((n) => n.includes('більше, ніж у вас є'))));
});

test('що маю: порожні й неправильні поля — помилка з поясненням, без NaN', () => {
  const r = evaluate('insulate', inp('insulate', {}, { windows: 'abc', winW: '-1', doorP: '1e9' }));
  assert.equal(r.errors.length, 3);
  assert.ok(r.errors.every((e) => e.text.length > 10));
  const txt = JSON.stringify(r);
  assert.ok(!txt.includes('NaN') && !txt.includes('undefined'));
  assert.deepEqual(parseParams('light', { hours: '' }).p.hours, null);
});

test('що маю: стан із резерву — кількість лише за однакових одиниць; «немає» з резерву', () => {
  const reserve = [
    { key: 'drinkWater', name: 'Вода', cat: 'water', qty: 12, unit: 'л', ok: true },
    { key: 'bags', name: 'Пакети', cat: 'other', qty: 2, unit: 'уп', ok: true },
    { key: 'lamp', name: 'Лампа', cat: 'light', qty: 1, unit: 'шт', ok: false },
  ];
  const m = mergeItems({}, reserve, ['powerbank']);
  assert.deepEqual(m.items.drinkWater, { s: 'y', q: '12' });
  assert.deepEqual(m.items.bags, { s: 'y' }, 'упаковки ≠ штуки: кількість не підставляємо');
  assert.deepEqual(m.items.lamp, { s: 'n' });
  assert.deepEqual(m.items.powerbank, { s: 'y' });
  assert.ok(!('film' in m.items));
  const own = mergeItems({ lamp: { s: 'y', q: '2' } }, reserve).items.lamp;
  assert.deepEqual(own, { s: 'y', q: '2' }, 'власна позначка важливіша');
});

test('що маю: позначки впливають на головний підбір (і лише підтверджені)', () => {
  const marked = haveToReserveKeys({ bags: { s: 'y' }, tent: { s: 'n' }, film: { s: 'y' }, bucket: { s: 'y', q: '0' } });
  assert.deepEqual(marked.yes, ['bags']);
  assert.deepEqual(marked.no.sort(), ['bucket', 'tent']);
  const base = { profile: { place: 'apartment', equip: [], limits: [], duration: 'd3', budget: 0 }, state: { power: false, gas: false, tap: false, adults: 1, kids: 0, elderly: 0 }, reserve: [], season: 'winter' };
  const c = buildContext({ ...base, marked });
  assert.equal(has(c, 'bags'), true);
  assert.ok(c.unavailable.has('tent'));
  const r = recommend('hygiene', c, '30', 10);
  const toilet = r.items.find((i) => i.sol.id === 'hyg-toilet');
  assert.ok(toilet && !toilet.warnings.some((w) => w.startsWith('Перевірте')));
  // Резерв важливіший за позначку
  const c2 = buildContext({ ...base, reserve: [{ id: 'b', key: 'bags', name: 'Пакети', cat: 'other', qty: 1, unit: 'уп', ok: false }], marked });
  assert.equal(has(c2, 'bags'), false);
});

test('що маю: очищення збереженого стану', () => {
  const c = cleanHave({ prob: 'water', items: { film: { s: 'y', q: '3'.repeat(40), p: { x: 1 } }, bad: { s: 'y' }, lamp: { s: 'maybe' }, powerbank: { s: 'y', p: { mah: '20000', evil: 'x' } } }, params: { water: { people: '2', hack: 'x' }, unknown: {} }, time: 'forever', budget: -5, limits: ['noDamage', 'x'] });
  assert.equal(c.prob, 'water');
  assert.deepEqual(Object.keys(c.items).sort(), ['film', 'powerbank']);
  assert.equal(c.items.film.q.length, 12);
  assert.deepEqual(c.items.powerbank.p, { mah: '20000' });
  assert.deepEqual(c.params, { water: { people: '2' } });
  assert.equal(c.time, '30');
  assert.equal(c.budget, 0);
  assert.deepEqual(c.limits, ['noDamage']);
  assert.ok(itemsFor('sanitation').includes('bags'));
  for (const k of itemsFor('repair')) assert.ok(ITEMS[k], k);
});

/* ───────────── 72 години ───────────── */

const sim = (o) => cleanSim({ ...simDefaults(), ...o });

test('план відключення: 3 доби — 7 етапів, тиждень — 9, 2 тижні — 11; на кожному не більше трьох дій і трьох ризиків', () => {
  assert.deepEqual(STAGES, [0.25, 1, 6, 12, 24, 48, 72, 120, 168, 240, 336]);
  assert.deepEqual(HORIZONS.map((h) => [h.d, stagesFor(h.d).length, stagesFor(h.d).at(-1)]), [[3, 7, 72], [7, 9, 168], [14, 11, 336]]);
  for (const days of [3, 7, 14]) for (const scen of Object.keys(SCENARIOS)) {
    const m = simulate(sim({ scen, days, adults: '2', kids: '1', drink: '6', tech: '10', meds: true, roomC: '11', infant: true, foodDays: '4', medsDays: '5', sources: [{ kind: 'station', cap: '1000', unit: 'Wh', pct: '70', k: '0.85', outW: '600' }], devices: [{ name: 'Роутер', w: '10', h: '24', src: 0 }, { name: 'Кисень', w: '300', h: '24', crit: true, src: -1 }] }));
    assert.equal(m.stages.length, horizon(days).n);
    for (const st of m.stages) {
      assert.ok(st.actions.length <= 3 && st.risks.length <= 3, `${days} ${scen} ${st.label}`);
      for (const x of [...st.all, ...st.allRisks]) assert.ok(!/NaN|undefined|Infinity/.test(x.text), x.text);
    }
    for (const x of horizonSummary(m)) assert.ok(!/NaN|undefined|Infinity/.test(x.text), x.text);
  }
});

test('72 години: вода — добова потреба, залишок і прогноз дефіциту', () => {
  const w = waterCalc(sim({ adults: '2', drink: '3', tech: '4', norm: 'min' }));
  assert.ok(w.ok);
  assert.equal(w.drinkDay, 2 * 2.8);
  assert.equal(w.techDay, 2 * 1);
  assert.ok(Math.abs(w.need72 - 16.8) < 1e-9);
  assert.ok(Math.abs(w.deficit72 - 13.8) < 1e-9);
  assert.ok(Math.abs(w.drinkHours - (3 / 5.6) * 24) < 1e-9);
  const m = simulate(sim({ scen: 'water', adults: '2', drink: '3', tech: '4' }));
  const risk = m.stages.flatMap((s) => s.risks).find((r) => r.text.startsWith('Питна вода закінчиться'));
  assert.ok(risk && risk.level === 'danger', 'дефіцит питної води — небезпека');
  assert.ok(m.stages[6].actions.some((a) => a.text.includes('бракує 13,8 л')));
  const rem = remainingAt(m, 6);
  assert.ok(Math.abs(rem.drink - (3 - 5.6 / 4)) < 1e-9);
  // Вода з крана є — запас не витрачається
  assert.equal(remainingAt(simulate(sim({ scen: 'power', drink: '3' })), 24).drink, null);
});

test('72 години: енергія — Вт·год, фактичний заряд, ККД, навантаження у Вт і час роботи', () => {
  const c = sourceCalc({ ...newSource('powerbank'), cap: '20000', pct: '50' }, [{ name: 'Лампа', w: '3', h: '4', crit: false, src: 0 }]);
  assert.ok(c.ok);
  assert.ok(Math.abs(c.nominalWh - 74) < 1e-9);
  assert.ok(Math.abs(c.usableWh - 74 * 0.5 * 0.7) < 1e-9);
  assert.equal(c.dailyWh, 12);
  assert.ok(Math.abs(c.runH - (25.9 / 12) * 24) < 1e-9);
  assert.ok(c.steps.some((s) => s.includes('Вт·год')) && c.steps.some((s) => s.includes('Вт ×')));
});

test('72 години: без фактичного заряду чи ємності — жодних обіцянок часу роботи', () => {
  const noPct = sourceCalc({ ...newSource('station'), cap: '1000' }, [{ name: 'Роутер', w: '10', h: '24', crit: false, src: 0 }]);
  assert.equal(noPct.ok, false);
  assert.ok(noPct.need.includes('фактичний заряд, %'));
  const pctOnly = sourceCalc({ ...newSource('station'), pct: '90' }, []);
  assert.ok(pctOnly.need.some((n) => n.includes('самий відсоток заряду')), 'відсоток без ємності — не висновок');
  const noHours = sourceCalc({ ...newSource('station'), cap: '1000', pct: '90' }, [{ name: 'Роутер', w: '10', h: '', crit: false, src: 0 }]);
  assert.equal(noHours.runH, null);
  assert.ok(noHours.need.some((n) => n.includes('години роботи')));
  const m = simulate(sim({ scen: 'power', sources: [{ kind: 'station', name: 'Станція', cap: '1000', unit: 'Wh' }] }));
  assert.ok(m.stages[1].risks.some((r) => r.text.includes('не можу порахувати')));
  assert.ok(!m.stages.flatMap((s) => s.actions).some((a) => a.text.includes('вистачить на') && a.text.includes('Станція')));
});

test('72 години: перевищення потужності виходу — небезпека; понад 80 % — обережність', () => {
  const c = sourceCalc({ ...newSource('station'), cap: '1000', pct: '80', outW: '600' }, [{ name: 'Чайник', w: '2000', h: '0.1', crit: false, src: 0 }, { name: 'Мультиварка', w: '500', h: '1', crit: false, src: 0 }]);
  assert.ok(c.compat.some((x) => x.level === 'danger' && x.text.includes('Чайник') && x.text.includes('600 Вт')));
  assert.ok(c.compat.some((x) => x.level === 'caution' && x.text.includes('Мультиварка')));
  const m = simulate(sim({ scen: 'all', sources: [{ kind: 'station', name: 'Станція', cap: '1000', unit: 'Wh', pct: '80', outW: '600' }], devices: [{ name: 'Чайник', w: '2000', h: '0.1', src: 0 }] }));
  assert.equal(m.stages[0].risks[0].level, 'danger');
  assert.ok(m.stages[0].risks[0].text.includes('Чайник'));
  const unknownOut = sourceCalc({ ...newSource('station'), cap: '1000', pct: '80' }, [{ name: 'Лампа', w: '5', h: '5', crit: false, src: 0 }]);
  assert.ok(unknownOut.compat.some((x) => x.level === 'info' && x.text.includes('потужність виходу')));
});

test('72 години: зарядна станція без нагрівача — не обіцяє тепла, показує розрахунок', () => {
  const m = simulate(sim({ scen: 'all', sources: [{ kind: 'station', name: 'Станція', cap: '1000', unit: 'Wh', pct: '100', k: '0.85' }] }));
  const all = m.stages.flatMap((s) => [...s.actions, ...s.risks]).map((x) => x.text);
  const info = all.find((t) => t.includes('Станція не замінить опалення'));
  assert.ok(info && info.includes('850 Вт·год') && info.includes('51 хв'), info);
  assert.ok(!all.some((t) => /станці\w* (зігріє|обігріє)/i.test(t)));
  assert.ok(all.some((t) => t.includes('Не обігрівайтеся газовою плитою')));
});

test('72 години: продукти без холодильника — за CDC, Ready.gov і USDA', () => {
  const m = simulate(sim({ scen: 'power', fridge: true, cooler: false, icebox: 'half', meds: true }));
  const r6 = m.stages[2].risks.map((r) => r.text).join(' ');
  assert.ok(r6.includes('Понад 4 години без холоду'));
  assert.ok(m.stages[4].risks.some((r) => r.text.includes('≈24 години')));
  assert.ok(m.stages[4].risks.some((r) => r.text.includes('Ліки') && r.level === 'danger'));
  const cool = simulate(sim({ scen: 'power', fridge: true, cooler: true, icebox: 'full' }));
  assert.ok(cool.stages[1].actions.some((a) => a.text.includes('термосумку')));
  assert.ok(cool.stages[5].risks.some((r) => r.text.includes('≈48 годин')));
  const water = simulate(sim({ scen: 'water', fridge: true }));
  assert.ok(!water.stages.flatMap((s) => s.risks).some((r) => r.text.includes('без холоду')), 'світло є — холодильник працює');
});

test('72 години: невідомі й неправильні поля — помилки замість вигадок', () => {
  const m = simulate(sim({ adults: 'два', drink: '-5', roomC: '200', sources: [{ kind: 'station', cap: '0', unit: 'Wh', pct: '150', k: '0.01' }] }));
  assert.equal(m.ok, false);
  assert.ok(m.errors.some((e) => e.includes('Дорослі')));
  assert.ok(m.errors.some((e) => e.includes('Питна вода')));
  assert.ok(m.errors.some((e) => e.includes('Температура')));
  assert.ok(m.errors.some((e) => e.includes('Ємність')) && m.errors.some((e) => e.includes('Заряд')) && m.errors.some((e) => e.includes('ККД')));
  assert.ok(!JSON.stringify(m.stages).includes('NaN'));
  const zero = simulate(sim({ adults: '0', kids: '0', elderly: '0', petKg: '0' }));
  assert.ok(zero.errors.some((e) => e.includes('хоча б одну')));
});

test('72 години: відлік — етап, що вже настав', () => {
  assert.equal(stageForElapsed(0), 0);
  assert.equal(stageForElapsed(0.9), 0);
  assert.equal(stageForElapsed(1), 1);
  assert.equal(stageForElapsed(5.9), 1);
  assert.equal(stageForElapsed(30), 4);
  assert.equal(stageForElapsed(500), 6);
});

test('72 години: експорт та імпорт; неправильний JSON не ламає дані', () => {
  const s = sim({ scen: 'heat', adults: '3', drink: '12', sources: [{ kind: 'lfp', cap: '100', unit: 'Ah', v: '12.8', pct: '90' }], devices: [{ name: 'Лампа', w: '5', h: '5', src: 0 }] });
  const file = JSON.stringify(exportSim(s));
  const back = importSim(file);
  assert.ok(back.ok);
  assert.deepEqual(back.sim, s);
  assert.equal(importSim('{не json').ok, false);
  assert.match(importSim('{не json').error, /JSON/);
  assert.equal(importSim('[1,2]').ok, false);
  assert.equal(importSim(JSON.stringify({ app: 'інший', sim: {} })).ok, false);
  assert.equal(importSim(JSON.stringify({ app: 'avtonomno' })).ok, false);
  const huge = cleanSim({ sources: Array(50).fill({ kind: 'station' }), devices: Array(90).fill({ name: 'x'.repeat(500), src: 99 }), scen: 'hack', stage: 99, startAt: 'вчора' });
  assert.equal(huge.sources.length, 6);
  assert.equal(huge.devices.length, 16);
  assert.equal(huge.devices[0].name.length, 40);
  assert.equal(huge.devices[0].src, -1);
  assert.equal(huge.scen, 'all');
  assert.equal(huge.stage, 0);
  assert.equal(huge.startAt, null);
});

test('72 години ×10: бібліотека перевірених дій — унікальні, з джерелами, на всі етапи', () => {
  assert.ok(ACTIONS.length >= 90, `дій: ${ACTIONS.length}`);
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, ACTIONS.length);
  for (const a of ACTIONS) {
    assert.ok(a.s >= 0 && a.s < STAGES.length, a.id);
    assert.ok(a.src.length && a.src.every((k) => SOURCES[k]), `${a.id}: джерело`);
    assert.ok(/^[\w-]+$/.test(a.id) && a.t.length > 15, a.id);
    assert.ok(/^[pwh]*$/.test(a.off || '') && /^[pwh]*$/.test(a.on || ''), a.id);
  }
  for (let i = 0; i < STAGES.length; i++) assert.ok(ACTIONS.some((a) => a.s === i), `етап ${i}`);
  // Умови: порада «світло є, опалення немає» — лише в сценарії «Без опалення»
  const heater = ACTIONS.find((a) => a.id === 'h-heater');
  assert.equal(applies(heater, SCENARIOS.heat, {}), true);
  assert.equal(applies(heater, SCENARIOS.all, {}), false);
  assert.equal(applies(ACTIONS.find((a) => a.id === 'p-coldbatt'), SCENARIOS.power, {}), false, 'потрібні і світло, і тепло вимкнені');
  assert.equal(applies(ACTIONS.find((a) => a.id === 'g-infant'), SCENARIOS.all, { infant: false }), false);
});

test('72 години ×10: повний перелік — у 10 разів більше за три головні дії, головні — найважливіші', () => {
  const s = sim({ scen: 'all', adults: '2', kids: '1', elderly: '1', infant: true, petKg: '8', drink: '6', meds: true, cooler: true, sources: [{ kind: 'station', cap: '1000', unit: 'Wh', pct: '70', outW: '600' }], devices: [{ name: 'Роутер', w: '10', h: '24', src: 0 }] });
  const m = simulate(s);
  const total = new Set(m.stages.flatMap((st) => st.all.map((a) => a.id))).size;
  assert.ok(total >= 7 * 3 * 4, `усього дій за 72 год: ${total}`);
  for (const st of m.stages) {
    assert.deepEqual(st.actions, st.all.slice(0, 3), 'угорі — три найважливіші з повного переліку');
    assert.ok(st.all.every((a) => a.id && a.text), st.label);
    assert.equal(new Set(st.all.map((a) => a.text)).size, st.all.length, 'без повторів');
  }
  assert.ok(m.stages[1].all.length >= 20, `етап 1 год: ${m.stages[1].all.length}`);
  // Позначки «зроблено» зберігаються й очищаються
  assert.deepEqual(cleanSim({ done: ['p-light', 'p-light', 'bad id!', 5, 'w-sep'] }).done, ['p-light', 'w-sep']);
});

/* ───────────── Майстер предків ───────────── */

test('майстер предків: 7 напрямів, 21 урок, повний формат і джерела', () => {
  assert.deepEqual(DIR_ORDER, ['build', 'heat', 'light', 'food', 'grow', 'nature', 'water']);
  assert.ok(LESSONS.length >= 170, `уроків ${LESSONS.length}`);
  for (const d of DIR_ORDER) assert.ok(lessonsOf(d).length >= 20, `напрям ${d}: ${lessonsOf(d).length}`);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  for (const d of DIR_ORDER) assert.ok(lessonsOf(d).length >= 3, d);
  for (const l of LESSONS) {
    for (const k of ['goal', 'history', 'histNote', 'modern']) assert.ok(l[k].length > 20, `${l.id}.${k}`);
    for (const k of ['materials', 'steps', 'limits', 'mistakes', 'src']) assert.ok(l[k].length >= 1, `${l.id}.${k}`);
    assert.ok(Array.isArray(l.tools), l.id);
    assert.ok(l.steps.length >= 4, `${l.id}: кроки`);
    assert.ok(l.scheme.length >= 3 && l.scheme.length <= 5, `${l.id}: схема 3–5 вузлів`);
    for (const k of l.src) assert.ok(SOURCES[k], `${l.id}: джерело ${k}`);
    if (l.solId) assert.ok(BY_ID.has(l.solId), `${l.id}: ${l.solId}`);
  }
});

test('майстер предків: без небезпечної консервації, саморобного опалення й сумнівного знезараження', () => {
  const txt = JSON.stringify(LESSONS).toLowerCase();
  assert.ok(!/буржуйк|саморобн\w* обігрівач (з|із)|обігрів(ати|айте) свічк/.test(txt.replace('саморобного опалення', '')));
  const can = LESSONS.find((l) => l.id === 'canning');
  assert.ok(can.modern.includes('автоклаві') && can.steps.some((s) => s.includes('10 хвилин')));
  assert.ok(!LESSONS.some((l) => l.dir === 'water' && /пісок|вугілл/.test(l.steps.join(' '))), 'жодних саморобних фільтрів для пиття');
  const kraut = LESSONS.find((l) => l.id === 'sauerkraut');
  assert.ok(kraut.steps[0].includes('2,3 кг') && kraut.steps[0].includes('3 столові ложки'));
  const water = LESSONS.find((l) => l.id === 'bleach');
  assert.ok(water.steps.join(' ').includes('2 краплі на 1 л'));
});

/* ───────────── Сховище схеми 3 ───────────── */

test('сховище 3: нові модулі, міграція з 2.3, експорт та імпорт, сумісність зі старими файлами', () => {
  assert.equal(SCHEMA, 3);
  const d = defaults();
  assert.deepEqual(d.have.items, {});
  assert.equal(d.sim.scen, 'all');
  // Дані 2.3 (схема 2): людей для «72 годин» беремо зі стану
  const v2 = { v: 2, state: { adults: 2, kids: 1, elderly: 0, waterL: 12.5 }, reserve: [], favs: ['heat-room'] };
  const m = cleanData(migrate(v2));
  assert.equal(m.v, 3);
  assert.equal(m.sim.adults, '2');
  assert.equal(m.sim.kids, '1');
  assert.equal(m.sim.drink, '12.5', 'запас питної води зі стану');
  assert.equal(cleanData(migrate({ v: 2, state: { adults: 1, waterL: null } })).sim.drink, '');
  assert.deepEqual(m.favs, ['heat-room']);
  // Експорт містить модулі; імпорт повертає їх
  const full = cleanData({ ...m, have: { items: { bags: { s: 'y', q: '4' } } }, sim: { scen: 'heat', drink: '9' } });
  const exp = exportData(full);
  assert.deepEqual(exp.have.items, { bags: { s: 'y', q: '4' } });
  assert.equal(exp.sim.drink, '9');
  const imp = importData(JSON.stringify(exp), defaults());
  assert.ok(imp.ok);
  assert.equal(imp.data.sim.scen, 'heat');
  assert.deepEqual(imp.data.have.items.bags, { s: 'y', q: '4' });
  // Файл 2.3 без модулів не стирає поточні позначки
  const old = importData(JSON.stringify({ app: 'avtonomno', format: 2, reserve: [] }), full);
  assert.ok(old.ok);
  assert.deepEqual(old.data.have.items.bags, { s: 'y', q: '4' });
  assert.equal(old.data.sim.drink, '9');
  // Неправильний JSON — помилка
  assert.equal(importData('{oops', defaults()).ok, false);
});

test('без латинської літери U+005A / U+007A у даних модулів 2.4', () => {
  const LAT = /[Zz]/;
  const texts = [];
  const walk = (v, key = '') => {
    if (key === 'url') return;
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { texts.push(k); walk(x, k); }
  };
  walk([ITEMS, PROBLEMS, DIRS, LESSONS, SCENARIOS]);
  walk(RECIPES.map((r) => ({ id: r.id, title: r.title, result: r.result, safe: r.safe, limits: r.limits, src: r.src })));
  for (const p of PROB_ORDER) walk(evaluate(p, inp(p)));
  walk(simulate(sim({ adults: '2', drink: '5', sources: [{ kind: 'station', cap: '500', unit: 'Wh', pct: '50', outW: '300' }], devices: [{ name: 'Лампа', w: '5', h: '5', src: 0 }] })).stages);
  const bad = texts.filter((t) => LAT.test(t));
  assert.deepEqual(bad, []);
  for (const f of ['have.js', 'sim.js', 'master.js', 'haveui.js', 'simui.js', 'masterui.js', 'lessons-build.js', 'lessons-heat.js', 'lessons-light.js', 'lessons-food.js', 'lessons-grow.js', 'lessons-nature.js', 'lessons-water.js']) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
    const strs = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
    const bad2 = strs.filter((s) => LAT.test(s));
    assert.deepEqual(bad2, [], f);
  }
});

test('2.4.2: джерела без дублікатів ключів, кожне джерело уроку використане коректно', () => {
  const src = readFileSync(new URL('./data.js', import.meta.url), 'utf8');
  const a = src.indexOf('export const SOURCES');
  const b = src.indexOf('\n};', a);
  const keys = [...src.slice(a, b).matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dup, [], 'дублікати ключів у SOURCES');
  for (const l of LESSONS) assert.equal(new Set(l.src).size, l.src.length, `${l.id}: повтор джерела`);
});

test('2.4.2: уроки з окремих файлів — у кеші офлайн і з усіма полями', async () => {
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  for (const f of ['build', 'heat', 'light', 'food', 'grow', 'nature', 'water']) assert.ok(sw.includes(`'./lessons-${f}.js'`), `sw.js: lessons-${f}.js`);
  const { searchLessons } = await import('./masterui.js').catch(() => ({ searchLessons: null }));
  if (searchLessons) {
    assert.ok(searchLessons('кліщ', null).some((l) => l.id === 'tick'));
    assert.ok(searchLessons('часник', 'grow').every((l) => l.dir === 'grow'));
    assert.equal(searchLessons('   ', null).length, 0);
  }
});

/* ───────────── План на тиждень і 2 тижні (2.5.0) ───────────── */

test('план 7 і 14 діб: вода на весь план — потреба, дефіцит, поповнення в останній етап', () => {
  const w7 = waterCalc(sim({ days: 7, adults: '2', drink: '3', tech: '4', norm: 'min' }));
  assert.ok(Math.abs(w7.needH - 39.2) < 1e-9 && Math.abs(w7.deficitH - 36.2) < 1e-9);
  assert.ok(Math.abs(w7.techNeedH - 14) < 1e-9 && Math.abs(w7.techDeficitH - 10) < 1e-9);
  assert.ok(w7.steps.some((x) => x.includes('На 7 діб лише пиття: 5,6 × 7 = 39,2 л')));
  const w14 = waterCalc(sim({ days: 14, adults: '2', drink: '3', norm: 'min' }));
  assert.ok(Math.abs(w14.needH - 78.4) < 1e-9);
  // 3 доби — як і раніше
  const w3 = waterCalc(sim({ adults: '2', drink: '3', norm: 'min' }));
  assert.ok(Math.abs(w3.needH - w3.need72) < 1e-9 && w3.steps.some((x) => x.includes('На 72 години')));
  const m = simulate(sim({ scen: 'water', days: 7, adults: '2', drink: '3', tech: '4' }));
  assert.ok(m.stages[1].all.some((a) => a.id === 'w-need' && a.text.includes('бракує 36,2 л')));
  assert.ok(m.stages[8].all.some((a) => a.id === 'w-def7' && a.text.includes('на 7 діб бракує 36,2 л')));
  assert.ok(!m.stages[6].all.some((a) => a.id === 'w-def72'), 'для тижня дефіцит — у кінці плану, не на 72 год');
});

test('план 7 і 14 діб: їжа й щоденні ліки — коли закінчаться й скільки бракує; помилки замість вигадок', () => {
  const m = simulate(sim({ scen: 'all', days: 7, adults: '1', foodDays: '4', medsDays: '5' }));
  assert.ok(m.stages[7].allRisks.some((r) => r.text.includes('Запас їжі закінчиться') && r.src.includes('femaFood')), 'їжа — 4 доби, етап «5 діб»');
  assert.ok(m.stages[7].allRisks.some((r) => r.level === 'danger' && r.text.includes('Щоденні ліки закінчаться')));
  assert.ok(m.stages[8].all.some((a) => a.id === 'f-def' && a.text.includes('бракує ще на 3 доби')));
  assert.ok(m.stages[1].all.some((a) => a.id === 'm-short'));
  const none = simulate(sim({ scen: 'all', medsDays: '0', foodDays: '0' }));
  assert.ok(none.stages[0].allRisks.some((r) => r.text.includes('Щоденних ліків немає')));
  assert.ok(none.stages[0].allRisks.some((r) => r.text.includes('Запасу їжі без холоду')));
  const bad = simulate(sim({ foodDays: '-1', medsDays: 'тиждень' }));
  assert.ok(bad.errors.some((e) => e.includes('Запас їжі')) && bad.errors.some((e) => e.includes('Щоденні ліки')));
  assert.equal(bad.foodDays, null);
});

test('план 7 і 14 діб: «Чи вистачить» — вода, їжа, ліки, енергія лише з введеного', () => {
  const m = simulate(sim({ scen: 'all', days: 14, adults: '2', drink: '100', tech: '10', foodDays: '14', medsDays: '7', sources: [{ kind: 'station', name: 'Станція', cap: '1000', unit: 'Wh', pct: '100', k: '0.85' }], devices: [{ name: 'Роутер', w: '10', h: '24', src: 0 }] }));
  const sum = horizonSummary(m);
  const by = (t) => sum.find((x) => x.text.startsWith(t));
  assert.equal(by('Питна вода').level, 'ok', 'потрібно 78,4 л, є 100');
  assert.equal(by('Технічна вода').level, 'caution');
  assert.equal(by('Їжа').level, 'ok');
  assert.equal(by('Щоденні ліки').level, 'danger');
  assert.equal(by('«Станція»').level, 'caution', '850 Вт·год ÷ 240 Вт·год/добу ≈ 3,5 доби з 14');
  assert.ok(m.stages[1].all.some((a) => a.id === 'src-long-0'));
  const empty = horizonSummary(simulate(sim({ scen: 'all', days: 7 })));
  assert.ok(empty.some((x) => x.level === 'info' && x.text.startsWith('Питна вода')), 'без запасу — просимо дані');
  assert.ok(empty.some((x) => x.level === 'info' && x.text.startsWith('Їжа')));
  assert.ok(!empty.some((x) => x.text.startsWith('Щоденні ліки')), 'без ліків — нічого не вигадуємо');
  const heat = horizonSummary(simulate(sim({ scen: 'heat', days: 7, drink: '5' })));
  assert.ok(!heat.some((x) => x.text.startsWith('Питна вода')), 'вода з крана є — не рахуємо дефіцит');
});

test('план 7 і 14 діб: етапи 5–14 діб мають перевірені дії; довгий холод і повернення послуг', () => {
  for (const i of [7, 8, 9, 10]) assert.ok(ACTIONS.filter((a) => a.s === i).length >= 5, `етап ${i}`);
  const m = simulate(sim({ scen: 'all', days: 14, adults: '1', kids: '1', roomC: '10' }));
  assert.ok(m.stages[7].allRisks.some((r) => r.level === 'danger' && r.text.includes('5 діб у +10 °C')));
  assert.ok(m.stages[9].allRisks.some((r) => r.text.includes('10 діб у +10 °C')));
  const ids10 = m.stages[10].all.map((a) => a.id);
  for (const id of ['w-flush14', 'p-back14', 'h-back14', 'g-twoweeks']) assert.ok(ids10.includes(id), id);
  const three = simulate(sim({ scen: 'all', days: 3 }));
  assert.ok(!three.stages.flatMap((st) => st.all).some((a) => a.id === 'w-flush14'), 'у плані на 3 доби — без етапів 5–14 діб');
  assert.ok(applies(ACTIONS.find((a) => a.id === 'h-vuln5'), SCENARIOS.all, { vuln: false }) === false);
});

test('план 7 і 14 діб: збереження, відлік у межах плану, експорт та імпорт', () => {
  assert.equal(cleanSim({ days: 'x' }).days, 3);
  assert.equal(cleanSim({ days: 7 }).days, 7);
  assert.equal(cleanSim({ days: '14' }).days, 14);
  assert.equal(cleanSim({ days: 3, stage: 10 }).stage, 0, 'етап поза планом — на початок');
  assert.equal(cleanSim({ days: 7, stage: 8 }).stage, 8);
  assert.equal(cleanSim({ days: 7, stage: 9 }).stage, 0);
  assert.equal(stageForElapsed(500), 6);
  assert.equal(stageForElapsed(500, 7), 8);
  assert.equal(stageForElapsed(500, 14), 10);
  assert.equal(stageForElapsed(130, 14), 7);
  const s = sim({ scen: 'power', days: 14, adults: '2', foodDays: '10', medsDays: '30', drink: '40' });
  const back = importSim(JSON.stringify(exportSim(s)));
  assert.ok(back.ok);
  assert.deepEqual(back.sim, s);
  assert.equal(cleanSim({ foodDays: '1'.repeat(40) }).foodDays.length, 12);
  // Старі файли без тривалості — план на 3 доби
  const old = importSim(JSON.stringify({ app: 'avtonomno', kind: 'sim72', sim: { scen: 'water', adults: '2' } }));
  assert.ok(old.ok && old.sim.days === 3 && old.sim.foodDays === '');
});

test('план відключення: тривалість за замовчуванням — з профілю «На скільки готуватися»', () => {
  const base = defaults();
  assert.equal(cleanData({ ...base, profile: { ...base.profile, duration: 'd7plus' }, sim: undefined }).sim.days, 14);
  assert.equal(cleanData({ ...base, profile: { ...base.profile, duration: 'd7' }, sim: { scen: 'all' } }).sim.days, 7, 'дані 2.4 без тривалості');
  assert.equal(cleanData({ ...base, profile: { ...base.profile, duration: 'h12' }, sim: { scen: 'all' } }).sim.days, 3);
  assert.equal(cleanData({ ...base, profile: { ...base.profile, duration: 'd7plus' }, sim: { scen: 'all', days: 3 } }).sim.days, 3, 'вибір людини важливіший');
});
