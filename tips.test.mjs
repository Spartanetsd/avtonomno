// Тести 2.6.0: «Зігрітися» — 100 перевірених порад. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPS, TIPS_HEAT, TIPS_LABEL, TIP_GROUPS, TIP_GROUP_ORDER, tipNo } from './tips.js';
import { SOURCES, NEEDS } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { sectionsFor } from './shelter.js';

const texts = (t) => [t.t, t.d].filter(Boolean);

test('2.6.0: рівно 100 порад, 10 головних, кожна група заповнена й упорядкована', () => {
  assert.equal(TIPS_HEAT.length, 100);
  assert.equal(TIPS.heat, TIPS_HEAT);
  assert.equal(TIPS_LABEL.heat, 'як зігрітися');
  assert.ok(NEEDS.heat);
  assert.equal(new Set(TIPS_HEAT.map((t) => t.id)).size, 100, 'повтор id');
  assert.equal(new Set(TIPS_HEAT.map((t) => t.t)).size, 100, 'повтор тексту поради');
  assert.equal(TIPS_HEAT.filter((t) => t.top).length, 10);
  assert.deepEqual([...TIP_GROUP_ORDER].sort(), Object.keys(TIP_GROUPS).sort());
  for (const g of TIP_GROUP_ORDER) assert.ok(TIPS_HEAT.filter((t) => t.g === g).length >= 5, `замало порад у групі ${g}`);
  // Поради йдуть групами в порядку TIP_GROUP_ORDER — тоді номери на екрані «Усі» йдуть підряд 1…100
  const order = TIPS_HEAT.map((t) => TIP_GROUP_ORDER.indexOf(t.g));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  TIPS_HEAT.forEach((t, i) => assert.equal(tipNo(t), i + 1));
});

test('2.6.0: кожна порада має джерело; посилання на рішення й уроки існують', () => {
  for (const t of TIPS_HEAT) {
    assert.ok(t.src.length >= 1, `${t.id}: без джерела`);
    assert.equal(new Set(t.src).size, t.src.length, `${t.id}: повтор джерела`);
    for (const k of t.src) {
      const s = SOURCES[k];
      assert.ok(s, `${t.id}: немає джерела ${k}`);
      assert.match(s.url, /^https:\/\//, `${k}: посилання не https`);
      assert.ok(s.org.trim() && s.title.trim(), `${k}: порожня назва`);
    }
    if (t.sol) assert.ok(findAny(t.sol), `${t.id}: немає рішення ${t.sol}`);
    if (t.ls) assert.ok(LESSON_BY_ID.get(t.ls), `${t.id}: немає уроку ${t.ls}`);
  }
  // Головні 10 — дії без світла й опалення, кожна з картою рішення або уроком
  for (const t of TIPS_HEAT.filter((x) => x.top)) assert.ok(t.sol || t.ls, `${t.id}: головна порада без «докладніше»`);
});

test('2.6.0: текст порад — коротко, охайно, без латинської «зет» і змішаних слів', () => {
  const MIX = /[Ѐ-ӿ][A-Za-z]|[A-Za-z][Ѐ-ӿ]/;
  for (const t of TIPS_HEAT) {
    assert.ok(t.t.length >= 12 && t.t.length <= 110, `${t.id}: довжина поради ${t.t.length}`);
    assert.ok(!/[.!]$/.test(t.t), `${t.id}: порада без крапки в кінці`);
    if (t.d) {
      assert.ok(t.d.length <= 230, `${t.id}: задовге пояснення ${t.d.length}`);
      assert.match(t.d, /[.!]$/, `${t.id}: пояснення закінчується крапкою`);
    }
    for (const s of texts(t)) {
      assert.ok(!/[Zz]/.test(s), `${t.id}: латинська «зет»`);
      assert.ok(!MIX.test(s), `${t.id}: змішані літери — ${s}`);
      assert.ok(!s.includes("'"), `${t.id}: апостроф має бути ’`);
      assert.ok(!/\s{2,}|^\s|\s$/.test(s), `${t.id}: зайві пробіли`);
      assert.ok(!/\d-\d/.test(s), `${t.id}: діапазон пишемо через «–»`);
    }
  }
  for (const g of Object.values(TIP_GROUPS)) for (const s of [g.label, g.sub]) assert.ok(!/[Zz]/.test(s) && !MIX.test(s), s);
  for (const f of ['tips.js', 'tipsui.js']) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
    assert.ok(!/[Zz]/.test(src), `${f}: латинська «зет»`);
  }
});

test('2.6.0: небезпечне — лише як заборона, у групі «Безпечне тепло»', () => {
  const risky = /плит|духовк|мангал|гриль|вугілл|генератор|свічк|(?<![а-яіїєґ])пальник/i;
  for (const t of TIPS_HEAT.filter((x) => texts(x).some((s) => risky.test(s)))) {
    assert.equal(t.g, 'safe', `${t.id}: про вогонь і газ — лише в «Безпечному теплі»`);
  }
  const joined = TIPS_HEAT.flatMap(texts).join(' ').toLowerCase();
  for (const bad of ['саморобн', 'балон', 'вазон', 'відкритим вогнем грій']) assert.ok(!joined.includes(bad), bad);
  const oven = TIPS_HEAT.find((t) => t.id === 'f-oven');
  assert.match(oven?.t || '', /^Ніколи/);
  // Числа в порадах — ті, що в джерелах
  const byId = (id) => TIPS_HEAT.find((t) => t.id === id);
  assert.match(byId('r-thermo')?.t || '', /18 °C/);
  assert.match(byId('k-room')?.t || '', /16–20 °C/);
  assert.match(byId('f-1m')?.t || '', /1 м/);
  assert.match(byId('f-person')?.d || '', /60–100 Вт.*750–1500 Вт/);
  assert.match(byId('o-wind')?.d || '', /−18 °C.*24 км\/год.*−28 °C.*30 хвилин/);
  assert.match(byId('d-seal')?.d || '', /25 %.*10 %/);
  assert.match(byId('x-35')?.t || '', /35 °C.*103/);
});

test('2.6.0: пошук порад і швидкий перехід з пошуку бібліотеки', async () => {
  const { searchTips } = await import('./tipsui.js');
  assert.equal(searchTips('').length, 100);
  assert.ok(searchTips('штор').some((t) => t.id === 'd-curtains'));
  assert.ok(searchTips('ГРІЛКА').some((t) => t.id === 'f-bottle'));
  assert.ok(searchTips("з'їжте").some((t) => t.id === 's-snack'), 'прямий апостроф знаходить ’');
  assert.ok(searchTips('немовля шар').every((t) => t.g === 'care' || /немовл/i.test(t.t + (t.d || ''))));
  assert.deepEqual(searchTips('такого-слова-немає'), []);
  const top = TIPS_HEAT.filter((t) => t.top);
  assert.deepEqual(searchTips('', top), top);
  for (const q of ['як зігрітися', 'мерзну вдома', 'поради']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/tips/heat'), q);
  }
});
