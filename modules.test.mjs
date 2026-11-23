// Тести модулів 2.4: «Що маю», «72 години», «Майстер предків» і сховище схеми 3. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEMS, PROBLEMS, PROB_ORDER, RECIPES, evaluate, paramDefaults, parseParams, itemsFor, mergeItems, haveToReserveKeys, cleanHave, bagsNeeded, MOLD_DIY_M2 } from './have.js';
import { simulate, cleanSim, simDefaults, sourceCalc, waterCalc, remainingAt, stageForElapsed, exportSim, importSim, newSource, STAGES, SCENARIOS } from './sim.js';
import { DIRS, DIR_ORDER, LESSONS, lessonsOf } from './master.js';
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

test('72 години: сім етапів 15 хв … 72 год, на кожному не більше трьох дій і трьох ризиків', () => {
  assert.deepEqual(STAGES, [0.25, 1, 6, 12, 24, 48, 72]);
  for (const scen of Object.keys(SCENARIOS)) {
    const m = simulate(sim({ scen, adults: '2', kids: '1', drink: '6', tech: '10', meds: true, roomC: '11', infant: true, sources: [{ kind: 'station', cap: '1000', unit: 'Wh', pct: '70', k: '0.85', outW: '600' }], devices: [{ name: 'Роутер', w: '10', h: '24', src: 0 }, { name: 'Кисень', w: '300', h: '24', crit: true, src: -1 }] }));
    assert.equal(m.stages.length, 7);
    for (const st of m.stages) {
      assert.ok(st.actions.length <= 3 && st.risks.length <= 3, `${scen} ${st.label}`);
      for (const x of [...st.actions, ...st.risks]) assert.ok(!/NaN|undefined|Infinity/.test(x.text), x.text);
    }
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

/* ───────────── Майстер предків ───────────── */

test('майстер предків: 7 напрямів, 21 урок, повний формат і джерела', () => {
  assert.deepEqual(DIR_ORDER, ['build', 'heat', 'light', 'food', 'grow', 'nature', 'water']);
  assert.ok(LESSONS.length >= 21);
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
  for (const f of ['have.js', 'sim.js', 'master.js', 'haveui.js', 'simui.js', 'masterui.js']) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
    const strs = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
    const bad2 = strs.filter((s) => LAT.test(s));
    assert.deepEqual(bad2, [], f);
  }
});
