// Тести 2.8.0: «Енергія» — 100 перевірених порад, як пережити блекаут. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPS, TIPS_LABEL, TIP_SETS, ALL_TIP_GROUPS, TIP_GROUPS, tipNo } from './tips.js';
import { TIPS_ENERGY, ENERGY_GROUPS, ENERGY_GROUP_ORDER } from './tips-energy.js';
import { SOURCES, NEEDS } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { sectionsFor } from './shelter.js';

const T = TIPS_ENERGY;
const byId = (id) => T.find((t) => t.id === id);
const texts = (t) => [t.t, t.d].filter(Boolean);
const all = (t) => [t.t, t.d || '', t.why, ...t.how, ...(t.warn || [])].filter(Boolean);
const MIX = /[Ѐ-ӿ][A-Za-z]|[A-Za-z][Ѐ-ӿ]/;

test('2.8.0: рівно 100 порад, 10 головних, групи заповнені й упорядковані', () => {
  assert.equal(T.length, 100);
  assert.equal(TIPS.energy, T);
  assert.equal(TIPS_LABEL.energy, 'як пережити блекаут');
  assert.ok(NEEDS.energy);
  assert.equal(new Set(T.map((t) => t.id)).size, 100, 'повтор id');
  assert.equal(new Set(T.map((t) => t.t)).size, 100, 'повтор тексту поради');
  assert.equal(T.filter((t) => t.top).length, 10);
  assert.deepEqual([...ENERGY_GROUP_ORDER].sort(), Object.keys(ENERGY_GROUPS).sort());
  for (const g of ENERGY_GROUP_ORDER) assert.ok(T.filter((t) => t.g === g).length >= 5, `замало порад у групі ${g}`);
  const order = T.map((t) => ENERGY_GROUP_ORDER.indexOf(t.g));
  assert.ok(order.every((v) => v >= 0), 'порада з невідомою групою');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  T.forEach((t, i) => assert.equal(tipNo(t), i + 1));
  // id порад і груп не перетинаються з «Зігрітися» — пошук і номери не плутаються
  const heatIds = new Set(TIPS.heat.map((t) => t.id));
  assert.ok(T.every((t) => !heatIds.has(t.id)), 'id перетинається з «Зігрітися»');
  assert.ok(Object.keys(ENERGY_GROUPS).every((g) => !(g in TIP_GROUPS)), 'група перетинається з «Зігрітися»');
  for (const g of [...Object.keys(TIP_GROUPS), ...Object.keys(ENERGY_GROUPS)]) assert.ok(ALL_TIP_GROUPS[g], g);
  assert.equal(TIP_SETS.energy.list, T);
  assert.equal(TIP_SETS.energy.back, '#/need/energy');
});

test('2.8.0: кожна порада має джерело; рішення й уроки існують; головні — з «докладніше»', () => {
  for (const t of T) {
    assert.ok(t.src.length >= 1, `${t.id}: без джерела`);
    assert.equal(new Set(t.src).size, t.src.length, `${t.id}: повтор джерела`);
    for (const k of t.src) {
      const s = SOURCES[k];
      assert.ok(s, `${t.id}: немає джерела ${k}`);
      assert.match(s.url, /^https:\/\//, `${k}: посилання не https`);
      assert.ok(s.org.trim() && s.title.trim(), `${k}: порожня назва`);
      for (const x of [s.org, s.title]) assert.ok(!/[Zz]/.test(x) && !MIX.test(x), `${k}: ${x}`);
    }
    if (t.sol) assert.ok(findAny(t.sol), `${t.id}: немає рішення ${t.sol}`);
    if (t.ls) assert.ok(LESSON_BY_ID.get(t.ls), `${t.id}: немає уроку ${t.ls}`);
  }
  for (const t of T.filter((x) => x.top)) assert.ok(t.sol || t.ls, `${t.id}: головна порада без «докладніше»`);
  assert.ok(new Set(T.flatMap((t) => t.src)).size >= 60, 'джерел замало');
});

test('2.8.0: текст — коротко, охайно, без латинської «зет» і змішаних слів', () => {
  for (const t of T) {
    assert.ok(t.t.length >= 12 && t.t.length <= 110, `${t.id}: довжина поради ${t.t.length}`);
    assert.ok(!/[.!]$/.test(t.t), `${t.id}: порада без крапки в кінці`);
    if (t.d) {
      assert.ok(t.d.length <= 230, `${t.id}: задовгий опис ${t.d.length}`);
      assert.match(t.d, /[.!]$/, `${t.id}: опис закінчується крапкою`);
    }
    for (const s of all(t)) {
      assert.ok(!/[Zz]/.test(s), `${t.id}: латинська «зет»`);
      assert.ok(!MIX.test(s), `${t.id}: змішані літери — ${s}`);
      assert.ok(!s.includes("'"), `${t.id}: апостроф має бути ’`);
      assert.ok(!/\s{2,}|^\s|\s$/.test(s), `${t.id}: зайві пробіли`);
      assert.ok(!/\d-\d/.test(s), `${t.id}: діапазон пишемо через «–»`);
    }
  }
  for (const g of Object.values(ENERGY_GROUPS)) for (const s of [g.label, g.sub]) assert.ok(!/[Zz]/.test(s) && !MIX.test(s), s);
  const src = readFileSync(new URL('./tips-energy.js', import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
  assert.ok(!/[Zz]/.test(src), 'tips-energy.js: латинська «зет»');
});

test('2.8.0: у кожної поради — «чому», 1–5 кроків і, де треба, застереження', () => {
  let steps = 0;
  for (const t of T) {
    assert.ok(t.why && t.why.length >= 20 && t.why.length <= 260, `${t.id}: «чому» ${t.why?.length}`);
    assert.match(t.why, /[.!]$/, `${t.id}: «чому» закінчується крапкою`);
    assert.ok(Array.isArray(t.how) && t.how.length >= 1 && t.how.length <= 5, `${t.id}: кроків ${t.how?.length}`);
    steps += t.how.length;
    assert.ok(!t.warn || (t.warn.length >= 1 && t.warn.length <= 2), `${t.id}: застережень ${t.warn?.length}`);
    for (const s of [...t.how, ...(t.warn || [])]) {
      assert.ok(s.length >= 6 && s.length <= 170, `${t.id}: довжина «${s}»`);
      assert.match(s, /[.!]$/, `${t.id}: крапка в кінці — «${s}»`);
    }
    assert.notEqual(t.why, t.d, `${t.id}: «чому» не повторює короткий опис`);
  }
  assert.ok(steps >= 200, `кроків замало: ${steps}`);
});

test('2.8.0: генератор, пальне й свічки — лише в групах «Генератор» і «Безпека», як правила й заборони', () => {
  const risky = /генератор|бензин|пальн|свічк/i;
  for (const t of T.filter((x) => texts(x).some((s) => risky.test(s)))) {
    assert.ok(t.g === 'gen' || t.g === 'fire', `${t.id}: про вогонь і пальне — лише в «Генераторі» чи «Безпеці»`);
  }
  const joined = T.flatMap(all).join(' ').toLowerCase();
  for (const bad of ['саморобн', 'балон', 'пальник', 'гасов', 'керосин', 'на балконі став']) assert.ok(!joined.includes(bad), bad);
  for (const id of ['eg-never', 'eg-socket', 'es-plug']) assert.match(byId(id)?.t || '', /^Ніколи/, id);
  // Підключення до мережі будинку — лише через фахівця
  for (const id of ['eg-socket', 'es-plug']) assert.ok(byId(id)?.how.some((s) => /фахівц/.test(s)), id);
  // Числа в порадах — ті, що в джерелах
  assert.match(byId('eg-out')?.t || '', /6 м/);
  assert.match(byId('eh-fridge')?.d || '', /4 годин.*48/);
  assert.match(byId('es-heater')?.d || '', /750–1500 Вт.*1000 Вт·год.*40–80 хвилин/);
  assert.match(byId('es-blanket')?.d || '', /60–100 Вт.*15–25 разів/);
  assert.match(byId('eb-temp')?.t || '', /0 до 40 °C/);
  assert.match(byId('et-warm')?.why || '', /0 до 35 °C/);
  assert.match(byId('eh-wait')?.why || '', /пів години.*10–15 хвилин/);
  assert.match(byId('eh-lift')?.d || '', /30–40 хвилин/);
  assert.match(byId('ef-stub')?.d || '', /2–3 см/);
  assert.match(byId('ef-wire')?.t || '', /8–10 м/);
  assert.match(byId('eg-break')?.d || '', /30 хвилин.*5 годин/);
  assert.match(byId('en-xpon')?.why || '', /72 годин/);
  assert.match(byId('es-punkt')?.d || '', /1–1,2 кВт/);
  assert.match(byId('et-saver')?.why || '', /30 секунд.*80 %/);
});

test('2.8.0: «див. пораду N» ведуть туди, куди задумано', () => {
  const want = { 11: 'el-each', 40: 'es-watts', 59: 'en-xpon', 93: 'ef-candle', 94: 'ef-stub', 96: 'ef-coalarm' };
  const refs = new Set();
  for (const t of T) {
    for (const s of all(t)) {
      assert.ok(!s.includes('[['), `${t.id}: нерозкрите посилання — ${s}`);
      for (const m of s.matchAll(/порад[уаи]\s+(\d+)(?:–(\d+))?/g)) {
        const a = Number(m[1]), b = Number(m[2] || m[1]);
        for (let n = a; n <= b; n++) refs.add(n);
      }
    }
  }
  assert.deepEqual([...refs].sort((a, b) => a - b), Object.keys(want).map(Number));
  for (const n of refs) assert.equal(T[n - 1]?.id, want[n], `порада ${n} — не та`);
});

test('2.8.0: пошук порад і перехід з пошуку бібліотеки', async () => {
  const { searchTips } = await import('./tipsui.js');
  assert.equal(searchTips('', T).length, 100);
  assert.equal(searchTips('').length, 100, 'без списку — як і раніше, «Зігрітися»');
  assert.ok(searchTips('павербанк', T).some((t) => t.id === 'eb-cover'));
  assert.ok(searchTips('ЛІФТ', T).some((t) => t.id === 'eh-lift'));
  assert.ok(searchTips('onu', T).some((t) => t.id === 'en-onu'), 'латиниця без урахування регістру');
  assert.ok(searchTips("зв'язок", T).some((t) => t.id === 'en-plan'), 'прямий апостроф знаходить ’');
  assert.ok(searchTips('пропускної', T).some((t) => t.id === 'en-sms'), 'слово лише з «чому»');
  assert.ok(searchTips('Цензор', T).some((t) => t.id === 'es-punkt'), 'пошук за джерелом');
  assert.deepEqual(searchTips('такого-слова-немає', T), []);
  for (const q of ['блекаут', 'павербанк', 'як жити без світла', 'роутер']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/tips/energy'), q);
  }
});

test('2.8.0: екран добірки — заголовок, чипи груп, головні 10 і фільтр', async () => {
  const { tipsScreens } = await import('./tipsui.js');
  const v = tipsScreens.energy(new URLSearchParams());
  assert.equal(v.title, 'Як пережити блекаут: 100 порад');
  assert.equal((v.html.match(/class="chip"/g) || []).length, 12, 'чипи: головні, усі й 10 груп');
  assert.equal((v.html.match(/<li class="tip/g) || []).length, 100);
  assert.ok(v.html.includes('href="#/tips/energy?g=gen"'));
  const top = tipsScreens.energy(new URLSearchParams('g=top'));
  assert.equal((top.html.match(/<li class="tip top"/g) || []).length, 10);
  assert.equal((top.html.match(/<details class="tip-x" open>/g) || []).length, 10, 'головні — розгорнуті');
  const gen = tipsScreens.energy(new URLSearchParams('g=gen'));
  assert.equal((gen.html.match(/<li class="tip/g) || []).length, 12);
  const odd = tipsScreens.energy(new URLSearchParams('g=cloth'));
  assert.equal((odd.html.match(/<li class="tip/g) || []).length, 100, 'група з іншої добірки — показуємо все');
  const heat = tipsScreens.heat(new URLSearchParams());
  assert.equal(heat.title, 'Як зігрітися: 100 порад');
  assert.ok(heat.html.includes('href="#/tips/heat?g=cloth"'));
});
