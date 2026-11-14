import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildContext, has, resourceStatus, recommend, safetyGate } from './engine.js';
import { SOLUTIONS } from './solutions.js';
import { SCHEMA, cleanData, defaults, exportData, importData } from './store.js';
import { SYMPTOMS } from './safety.js';

function ctx({ equip = [], reserve = [], power = false, gas = false, outsideSafe = null, stationW = null, kettleW = null, place = 'apartment' } = {}) {
  return buildContext({
    profile: { ...defaults().profile, equip, stationW, kettleW, place },
    state: { ...defaults().state, power, gas, outsideSafe }, reserve, season: 'winter',
  });
}

test('2.1: звичайне обладнання невідоме, поки його не підтвердили', () => {
  const c = ctx();
  for (const key of ['blankets', 'bucket', 'bags']) {
    assert.equal(has(c, key), false, key);
    assert.equal(resourceStatus(c, key), 'unknown', key);
  }
  const confirmed = ctx({ reserve: [{ key:'bucket', name:'Відро', cat:'other', id:'1', ok:true, qty:1 }] });
  assert.equal(resourceStatus(confirmed, 'bucket'), 'available');
  const unavailable = ctx({ reserve: [{ key:'bucket', name:'Відро', cat:'other', id:'1', ok:false, qty:1 }] });
  assert.equal(resourceStatus(unavailable, 'bucket'), 'unavailable');
  assert.equal(has(unavailable, 'bucket'), false);
});

test('2.1: позитивний запис у резерві має перевагу над старим недоступним', () => {
  const c = ctx({ reserve: [
    { key:'blankets', name:'Старий запис', id:'1', ok:false, qty:1 },
    { key:'blankets', name:'Актуальні ковдри', id:'2', ok:true, qty:2 },
  ] });
  assert.equal(resourceStatus(c, 'blankets'), 'available');
});

test('2.1: станція без чайника/AC/потужності не дозволяє обіцяти окріп', () => {
  const boil = SOLUTIONS.find((s) => s.id === 'water-boil');
  assert.ok(boil);
  for (const options of [
    { equip:['station'] },
    { equip:['station','electricKettle'] },
    { equip:['station','electricKettle','stationAC'] },
    { equip:['station','electricKettle','stationAC'], stationW:300, kettleW:1500 },
    { equip:['station','electricKettle','stationAC'], stationW:300, kettleW:0 },
  ]) {
    const c = ctx(options);
    assert.equal(c.heatSource, false, JSON.stringify(options));
    assert.equal(has(c, 'heatSource'), false);
    assert.ok(!recommend('water', c, '5', 50).items.some((x) => x.sol.id === 'water-boil'));
  }
  const valid = ctx({ equip:['station','electricKettle','stationAC'], stationW:350, kettleW:250 });
  assert.ok(!recommend('food', ctx({equip:['station']}), '30', 50).items.some((x) => x.sol.id === 'food-lowpower'));
  assert.equal(valid.heatSource, true, 'потужності й AC підтверджені');
  assert.equal(safetyGate(boil, valid).ok, true);
});

test('2.1: вихід надвір заблоковано за невідомих/небезпечних умов', () => {
  const trip = SOLUTIONS.find((s) => s.uses.outside === true);
  assert.ok(trip);
  for (const outsideSafe of [null, false]) {
    const c = ctx({ outsideSafe });
    assert.equal(safetyGate(trip, c).ok, false);
    for (const need of ['heat','food','water','energy','cool','hygiene']) {
      const result = recommend(need, c, 'long', 100);
      for (const item of [...result.items, ...result.more]) {
        assert.ok(item.sol.uses.outside !== true && item.sol.uses.outside !== 'unlessCar');
      }
    }
  }
  assert.equal(safetyGate(trip, ctx({ outsideSafe:true })).ok, true);
});

test('2.1: резервна копія зберігає тему, калькулятори та історію без увімкнення тривоги', () => {
  const d = cleanData({
    profile: { ...defaults().profile, stationW: 300, kettleW: 200 },
    state: { ...defaults().state, outsideSafe: false },
    settings: { ...defaults().settings, theme:'black', contrast:true },
    calc: { battery: { watts:25, hours:4 } },
    reserve: [{ key:'drinkWater', name:'Вода', cat:'water', id:'a', qty:10, ok:true, unit:'л' }],
    shelter: { since:Date.UTC(2026, 10, 12), after:null, count:8, minutes:315, last:Date.UTC(2026, 10, 11) },
  });
  assert.equal(SCHEMA, 3);
  const backup = exportData(d);
  assert.equal(backup.shelter.since, null);
  assert.equal(backup.settings.theme, 'black');
  const result = importData(JSON.stringify(backup), defaults());
  assert.ok(result.ok);
  assert.equal(result.data.settings.theme, 'black');
  assert.equal(result.data.profile.stationW, 300);
  assert.equal(result.data.profile.kettleW, 200);
  assert.equal(result.data.state.outsideSafe, false);
  assert.deepEqual(result.data.calc, { battery: { watts:25, hours:4 } });
  assert.equal(result.data.shelter.since, null);
  assert.equal(result.data.shelter.count, 8);
  assert.equal(result.data.shelter.minutes, 315);
  const old = importData(JSON.stringify({ app:'avtonomno', reserve:[] }), d);
  assert.ok(old.ok);
  assert.equal(old.data.settings.theme, 'black', 'старі експорти не скидають тему');
});

test('2.1: CO — спершу негайний вихід, а не маніпуляції з приладами', () => {
  const co = SYMPTOMS.find((s) => s.id === 'co');
  assert.ok(co);
  assert.match(co.act[0], /Негайно залиште/);
  assert.match(co.act[1], /103 або 112/);
});

test('2.1: робочий процес GitHub Pages уже в каталозі workflows', () => {
  const path = new URL('./.github/workflows/pages-deploy.yml', import.meta.url);
  assert.ok(existsSync(path));
  const workflow = readFileSync(path, 'utf8');
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run check/);
  assert.ok(!existsSync(new URL('./pages-deploy.yml', import.meta.url)), 'копія в корені не потрібна');
});
