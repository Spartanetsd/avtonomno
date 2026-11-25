// Тести 2.9.0: «Укриття й тривога» — 70 перевірених порад із розширеним поясненням і «Цікаво знати». Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPS, TIP_SETS, ALL_TIP_GROUPS, TIP_GROUPS, TIP_GO, tipNo } from './tips.js';
import { TIPS_ENERGY, ENERGY_GROUPS } from './tips-energy.js';
import { TIPS_SHELTER, SHELTER_GROUPS, SHELTER_GROUP_ORDER } from './tips-shelter.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { sectionsFor, SECTIONS } from './shelter.js';
import { TOOL_LABEL } from './shelterui.js';

const T = TIPS_SHELTER;
const byId = (id) => T.find((t) => t.id === id);
const all = (t) => [t.t, t.d || '', t.why, t.fact || '', ...t.how, ...(t.warn || [])].filter(Boolean);
const MIX = /[Ѐ-ӿ][A-Za-z]|[A-Za-z][Ѐ-ӿ]/;

test('2.9.0: 70 порад, 10 головних, 10 груп по порядку, id не перетинаються з іншими добірками', () => {
  assert.equal(T.length, 70);
  assert.equal(new Set(T.map((t) => t.id)).size, 70, 'повтор id');
  assert.equal(new Set(T.map((t) => t.t)).size, 70, 'повтор тексту поради');
  assert.equal(T.filter((t) => t.top).length, 10);
  assert.deepEqual([...SHELTER_GROUP_ORDER].sort(), Object.keys(SHELTER_GROUPS).sort());
  assert.equal(SHELTER_GROUP_ORDER.length, 10);
  for (const g of SHELTER_GROUP_ORDER) assert.ok(T.filter((t) => t.g === g).length >= 6, `замало порад у групі ${g}`);
  const order = T.map((t) => SHELTER_GROUP_ORDER.indexOf(t.g));
  assert.ok(order.every((v) => v >= 0), 'порада з невідомою групою');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  T.forEach((t, i) => assert.equal(tipNo(t), i + 1));
  const other = new Set([...TIPS.heat, ...TIPS_ENERGY].map((t) => t.id));
  assert.ok(T.every((t) => !other.has(t.id)), 'id перетинається з іншою добіркою');
  for (const g of Object.keys(SHELTER_GROUPS)) {
    assert.ok(!(g in TIP_GROUPS) && !(g in ENERGY_GROUPS), `група ${g} перетинається`);
    assert.equal(ALL_TIP_GROUPS[g], SHELTER_GROUPS[g]);
  }
  assert.equal(TIP_SETS.shelter.list, T);
  assert.equal(TIP_SETS.shelter.back, '#/shelter');
  assert.equal(TIPS.shelter, undefined, 'укриття — не потреба головного екрана');
});

test('2.9.0: джерела, рішення, уроки, розділи й інструменти існують; головні — з переходом далі', () => {
  for (const t of T) {
    assert.ok(t.src.length >= 1, `${t.id}: без джерела`);
    assert.equal(new Set(t.src).size, t.src.length, `${t.id}: повтор джерела`);
    for (const k of t.src) {
      const s = SOURCES[k];
      assert.ok(s, `${t.id}: немає джерела ${k}`);
      assert.match(s.url, /^https:\/\//, `${k}: посилання не https`);
      assert.ok(s.org.trim() && s.title.trim(), `${k}: порожня назва`);
      // Назва видання може бути брендом зі змішаним написом (АрміяInform), але без «зет»
      assert.ok(!/[Zz]/.test(s.org) && !/[Zz]/.test(s.title) && !MIX.test(s.title), `${k}: ${s.org} — ${s.title}`);
    }
    if (t.sol) assert.ok(findAny(t.sol), `${t.id}: немає рішення ${t.sol}`);
    if (t.ls) assert.ok(LESSON_BY_ID.get(t.ls), `${t.id}: немає уроку ${t.ls}`);
    if (t.go) assert.ok(TIP_GO[t.go], `${t.id}: невідомий розділ ${t.go}`);
    if (t.tool) assert.ok(TOOL_LABEL[t.tool], `${t.id}: невідомий інструмент ${t.tool}`);
  }
  for (const t of T.filter((x) => x.top)) assert.ok(t.sol || t.ls || t.go || t.tool, `${t.id}: головна порада без переходу`);
  assert.ok(new Set(T.flatMap((t) => t.src)).size >= 45, 'джерел замало');
  // Кожен розділ із TIP_GO справді використовується якоюсь добіркою, а посилання ведуть у застосунок (2.10.0 додала «Їжу», 2.11.0 — «Воду»)
  const used = new Set(Object.values(TIP_SETS).flatMap((x) => x.list).map((t) => t.go).filter(Boolean));
  for (const href of Object.keys(TIP_GO)) {
    assert.match(href, /^#\/(shelter|prep|bag|sheet|aid|have\/(repair|water|sanitation)|calc\/(heat|water)|tips\/energy\?g=(net|phone)|tips\/heat\?g=safe)$/, href);
    assert.ok(used.has(href), `розділ ${href} ніде не використано`);
  }
  // Перша допомога — лише посиланням на розділ за наказом МОЗ № 441
  assert.ok(byId('up-help')?.src.includes('mohOrder'));
  assert.equal(byId('up-help')?.go, '#/aid');
});

test('2.9.0: текст охайний — без латинської «зет», змішаних слів, прямого апострофа й зайвих пробілів', () => {
  for (const t of T) {
    assert.ok(t.t.length >= 12 && t.t.length <= 110, `${t.id}: довжина поради ${t.t.length}`);
    assert.ok(!/[.!]$/.test(t.t), `${t.id}: порада без крапки в кінці`);
    assert.ok(t.d && t.d.length <= 230, `${t.id}: опис ${t.d?.length}`);
    assert.match(t.d, /[.!]$/, `${t.id}: опис закінчується крапкою`);
    for (const s of all(t)) {
      assert.ok(!/[Zz]/.test(s), `${t.id}: латинська «зет»`);
      assert.ok(!MIX.test(s), `${t.id}: змішані літери — ${s}`);
      assert.ok(!s.includes("'"), `${t.id}: апостроф має бути ’`);
      assert.ok(!/\s{2,}|^\s|\s$/.test(s), `${t.id}: зайві пробіли`);
      assert.ok(!/\d-\d/.test(s), `${t.id}: діапазон пишемо через «–»`);
    }
  }
  for (const g of Object.values(SHELTER_GROUPS)) for (const s of [g.label, g.sub]) assert.ok(!/[Zz]/.test(s) && !MIX.test(s), s);
  for (const v of Object.values(TIP_GO)) assert.ok(!/[Zz]/.test(v.t) && !MIX.test(v.t), v.t);
  const src = readFileSync(new URL('./tips-shelter.js', import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
  assert.ok(!/[Zz]/.test(src), 'tips-shelter.js: латинська «зет»');
});

test('2.9.0: більше тексту — довге «чому», 2–6 кроків і «Цікаво знати» в більшості порад', () => {
  let why = 0;
  let steps = 0;
  for (const t of T) {
    assert.ok(t.why && t.why.length >= 250 && t.why.length <= 520, `${t.id}: «чому» ${t.why?.length}`);
    assert.match(t.why, /[.!]$/, `${t.id}: «чому» закінчується крапкою`);
    why += t.why.length;
    assert.ok(Array.isArray(t.how) && t.how.length >= 2 && t.how.length <= 6, `${t.id}: кроків ${t.how?.length}`);
    steps += t.how.length;
    assert.ok(!t.warn || (t.warn.length >= 1 && t.warn.length <= 2), `${t.id}: застережень ${t.warn?.length}`);
    for (const s of [...t.how, ...(t.warn || [])]) {
      assert.ok(s.length >= 6 && s.length <= 170, `${t.id}: довжина «${s}»`);
      assert.match(s, /[.!]$/, `${t.id}: крапка в кінці — «${s}»`);
    }
    if (t.fact) {
      assert.ok(t.fact.length >= 40 && t.fact.length <= 300, `${t.id}: «цікаво знати» ${t.fact.length}`);
      assert.match(t.fact, /[.!]$/, `${t.id}: «цікаво знати» закінчується крапкою`);
      assert.ok(!t.why.includes(t.fact) && t.fact !== t.d, `${t.id}: факт повторює пояснення`);
    }
    assert.notEqual(t.why, t.d, `${t.id}: «чому» не повторює короткий опис`);
  }
  assert.ok(why / T.length >= 330, `«чому» в середньому коротке: ${Math.round(why / T.length)}`);
  assert.ok(T.filter((t) => t.fact).length >= 40, '«Цікаво знати» — у більшості порад');
  assert.ok(steps >= 270, `кроків замало: ${steps}`);
  // Факти не повторюються між порадами
  const facts = T.map((t) => t.fact).filter(Boolean);
  assert.equal(new Set(facts).size, facts.length, 'один факт у двох порадах');
});

test('2.9.0: безпека змісту — вогонь лише як заборона, без медичних інструкцій і саморобок, йод — тільки за вказівкою', () => {
  for (const t of T) {
    for (const s of all(t)) {
      if (/свічк/i.test(s)) assert.match(s, /заборон|не запалю|не можна|замість|жодних/i, `${t.id}: свічки — лише як заборона: ${s}`);
      assert.ok(!/наклад\w* турнікет|турнікет\w* на кінцівк|синдром\w* тривалого стиснення/i.test(s), `${t.id}: медична інструкція`);
      for (const bad of ['саморобн', 'керосин', 'гасов', 'балон', 'йодна сітк']) assert.ok(!s.toLowerCase().includes(bad), `${t.id}: ${bad}`);
    }
  }
  const iod = byId('ux-iodine');
  assert.match(iod?.t || '', /лише за офіційною вказівкою/);
  assert.ok(iod?.how.some((s) => /припиніть/.test(s)));
  assert.ok(iod?.warn?.some((s) => /розчин йоду/.test(s)));
  assert.match(byId('uh-walls')?.why || '', /«ніколи не гарантувало достатню безпеку»/);
  assert.ok(byId('uh-walls')?.t.includes('крайній захід'));
  assert.ok(byId('uh-film')?.warn?.some((s) => /не захищають від вибухової хвилі/.test(s)));
});

test('2.9.0: числа — ті, що в джерелах', () => {
  assert.match(byId('ua-siren')?.fact || '', /1000 м\/с.*«небезпечною ілюзією»/);
  assert.match(byId('ua-allclear')?.t || '', /10–15 хвилин/);
  assert.match(byId('ua-signal')?.fact || '', /3–5 хвилин/);
  assert.match(byId('ua-signal')?.why || '', /5 хвилин/);
  assert.match(byId('ua-app')?.fact || '', /1 березня 2022.*12 областей/);
  assert.match(byId('ua-filming')?.why || '', /8 років/);
  assert.match(byId('uf-check')?.why || '', /2 л на людину на добу/);
  assert.match(byId('uf-check')?.fact || '', /3 хвилини.*3 дні.*3 тижні/);
  assert.match(byId('uf-signs')?.fact || '', /50×60 см/);
  assert.match(byId('ub-what')?.why || '', /1,5 л.*3 доби/);
  assert.match(byId('uh-film')?.why || '', /115–300 мкм/);
  assert.match(byId('uh-walls')?.fact || '', /3 мм/);
  assert.match(byId('us-group')?.d || '', /10 хвилин/);
  assert.match(byId('uk-breath')?.d || '', /30 хвилин/);
  assert.match(byId('uk-school')?.fact || '', /100 м.*48 годин/);
  assert.match(byId('uc-breath')?.t || '', /на 3.*на 6/);
  assert.ok(byId('uc-breath')?.how.some((s) => /4 рази/.test(s)));
  assert.match(byId('uc-stone')?.t || '', /7–10 секунд/);
  assert.ok(byId('uc-stone')?.how.some((s) => /15–20 секунд/.test(s)));
  assert.match(byId('ux-mask')?.d || '', /2 %/);
  assert.match(byId('ux-rad')?.fact || '', /90 %/);
  assert.match(byId('ux-iodine')?.why || '', /24 години/);
  assert.match(byId('ux-iodine')?.fact || '', /40 років/);
  assert.match(byId('up-help')?.fact || '', /№ 441.*9 березня 2022/);
  assert.match(byId('ui-warm')?.fact || '', /\+4 °C/);
});

test('2.9.0: «див. пораду N» ведуть туди, куди задумано', () => {
  const want = { 20: 'ub-pets', 24: 'uh-windows', 26: 'uh-drop', 35: 'us-wait', 55: 'up-debris', 65: 'ux-seal', 66: 'ux-mask' };
  const refs = new Set();
  for (const t of T) {
    for (const s of all(t)) {
      assert.ok(!s.includes('[['), `${t.id}: нерозкрите посилання — ${s}`);
      for (const m of s.matchAll(/порад[уаи]\s+(\d+)/g)) refs.add(Number(m[1]));
    }
  }
  for (const n of refs) assert.equal(T[n - 1]?.id, want[n], `порада ${n} — не та`);
  assert.deepEqual([...refs].sort((a, b) => a - b), Object.keys(want).map(Number));
});

test('2.9.0: пошук порад — зокрема за «Цікаво знати» — і перехід із пошуку бібліотеки', async () => {
  const { searchTips } = await import('./tipsui.js');
  assert.equal(searchTips('', T).length, 70);
  assert.ok(searchTips('дрон', T).some((t) => t.id === 'uh-floors'));
  assert.ok(searchTips('ППО', T).some((t) => t.id === 'ua-filming'), 'регістр не важить');
  assert.ok(searchTips('Тарабаровою', T).some((t) => t.id === 'uk-play'), 'слово лише з «Цікаво знати»');
  assert.ok(searchTips('хвилину тиші', T).some((t) => t.id === 'up-rubble'));
  assert.ok(searchTips("пам'ятка", T).length > 0, 'прямий апостроф знаходить ’');
  assert.ok(searchTips('ЮНІСЕФ', T).some((t) => t.id === 'uk-map'), 'пошук за джерелом');
  assert.deepEqual(searchTips('такого-слова-немає', T), []);
  for (const q of ['дрон', 'уламки', 'хлор', 'двох стін', 'тривога', 'ППО', 'йод']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/tips/shelter'), q);
  }
  const sec = SECTIONS.find((s) => s.href === '#/tips/shelter');
  assert.ok(sec?.title.includes(`${T.length} перевірених порад`), 'кількість у бібліотеці збігається');
});

test('2.9.0: екран добірки — заголовок, чипи, головні, «Цікаво знати», інструменти й розділи', async () => {
  const { tipsScreens } = await import('./tipsui.js');
  const v = tipsScreens.shelter(new URLSearchParams());
  assert.equal(v.title, 'Укриття й тривога: 70 порад');
  assert.equal(v.tab, 'shelter');
  assert.ok(v.html.includes('href="#/shelter"'), 'назад — на екран «Укриття»');
  assert.equal((v.html.match(/class="chip"/g) || []).length, 12, 'чипи: головні, усі й 10 груп');
  assert.equal((v.html.match(/<li class="tip/g) || []).length, 70);
  assert.equal((v.html.match(/<aside class="tip-fact">/g) || []).length, T.filter((t) => t.fact).length);
  assert.ok(v.html.includes('Цікаво знати'));
  assert.ok(v.html.includes('«Цікаво знати»'), 'підказка згадує новий блок');
  assert.equal((v.html.match(/data-act="tool" data-v="breathe"/g) || []).length, 2);
  assert.equal((v.html.match(/data-act="tool" data-v="signal"/g) || []).length, 1);
  for (const href of new Set(T.map((t) => t.go).filter(Boolean))) assert.ok(v.html.includes(`href="${href}"`), href);
  const top = tipsScreens.shelter(new URLSearchParams('g=top'));
  assert.equal((top.html.match(/<li class="tip top"/g) || []).length, 10);
  assert.equal((top.html.match(/<details class="tip-x" open>/g) || []).length, 10, 'головні — розгорнуті');
  const calm = tipsScreens.shelter(new URLSearchParams('g=calm'));
  assert.equal((calm.html.match(/<li class="tip/g) || []).length, 6);
  const odd = tipsScreens.shelter(new URLSearchParams('g=gen'));
  assert.equal((odd.html.match(/<li class="tip/g) || []).length, 70, 'група з іншої добірки — показуємо все');
  // Інші добірки не змінилися: там немає «Цікаво знати»
  const heat = tipsScreens.heat(new URLSearchParams());
  assert.equal(heat.title, 'Як зігрітися: 100 порад');
  assert.ok(!heat.html.includes('tip-fact') && !heat.html.includes('«Цікаво знати»'));
  assert.equal(tipsScreens.energy(new URLSearchParams()).tab, 'home');
});
