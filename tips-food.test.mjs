// Тести 2.10.0: «Їжа без світла» — 66 перевірених порад із розширеним поясненням і «Цікаво знати». Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPS, TIPS_LABEL, TIP_SETS, ALL_TIP_GROUPS, TIP_GROUPS, TIP_GO, tipNo } from './tips.js';
import { TIPS_ENERGY, ENERGY_GROUPS } from './tips-energy.js';
import { TIPS_SHELTER, SHELTER_GROUPS } from './tips-shelter.js';
import { TIPS_FOOD, FOOD_GROUPS, FOOD_GROUP_ORDER } from './tips-food.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { sectionsFor, SECTIONS } from './shelter.js';

const T = TIPS_FOOD;
const byId = (id) => T.find((t) => t.id === id);
const all = (t) => [t.t, t.d || '', t.why, t.fact || '', ...t.how, ...(t.warn || [])].filter(Boolean);
const text = (t) => all(t).join(' ');
const MIX = /[Ѐ-ӿ][A-Za-z]|[A-Za-z][Ѐ-ӿ]/;

test('2.10.0: 66 порад, 10 головних, 10 груп по порядку, id не перетинаються з іншими добірками', () => {
  assert.equal(T.length, 66);
  assert.equal(new Set(T.map((t) => t.id)).size, 66, 'повтор id');
  assert.equal(new Set(T.map((t) => t.t)).size, 66, 'повтор тексту поради');
  assert.equal(T.filter((t) => t.top).length, 10);
  assert.deepEqual([...FOOD_GROUP_ORDER].sort(), Object.keys(FOOD_GROUPS).sort());
  assert.equal(FOOD_GROUP_ORDER.length, 10);
  for (const g of FOOD_GROUP_ORDER) {
    assert.ok(T.filter((t) => t.g === g).length >= 6, `замало порад у групі ${g}`);
    assert.equal(T.filter((t) => t.g === g && t.top).length, 1, `у групі ${g} — рівно одна головна`);
  }
  const order = T.map((t) => FOOD_GROUP_ORDER.indexOf(t.g));
  assert.ok(order.every((v) => v >= 0), 'порада з невідомою групою');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  T.forEach((t, i) => assert.equal(tipNo(t), i + 1));
  const other = new Set([...TIPS.heat || [], ...TIPS_ENERGY, ...TIPS_SHELTER].map((t) => t.id));
  assert.ok(T.every((t) => !other.has(t.id)), 'id перетинається з іншою добіркою');
  for (const g of Object.keys(FOOD_GROUPS)) {
    assert.ok(!(g in TIP_GROUPS) && !(g in ENERGY_GROUPS) && !(g in SHELTER_GROUPS), `група ${g} перетинається`);
    assert.equal(ALL_TIP_GROUPS[g], FOOD_GROUPS[g]);
  }
  // «Їжа» — потреба головного екрана: посилання «Зробіть зараз» веде на добірку
  assert.equal(TIPS.food, T);
  assert.equal(TIPS_LABEL.food, 'як зберегти й приготувати їжу без світла');
  assert.equal(TIP_SETS.food.list, T);
  assert.equal(TIP_SETS.food.back, '#/need/food');
  // Решта добірок не змінилася
  assert.equal(TIPS.heat?.length, 100);
  assert.equal(TIPS.energy?.length, 100);
  assert.equal(TIPS_SHELTER.length, 70);
});

test('2.10.0: джерела, рішення, уроки й розділи існують; головні — з переходом далі', () => {
  for (const t of T) {
    assert.ok(t.src.length >= 1, `${t.id}: без джерела`);
    assert.equal(new Set(t.src).size, t.src.length, `${t.id}: повтор джерела`);
    for (const k of t.src) {
      const s = SOURCES[k];
      assert.ok(s, `${t.id}: немає джерела ${k}`);
      assert.match(s.url, /^https:\/\//, `${k}: посилання не https`);
      assert.ok(s.org.trim() && s.title.trim(), `${k}: порожня назва`);
      assert.ok(!/[Zz]/.test(s.org) && !/[Zz]/.test(s.title) && !MIX.test(s.title), `${k}: ${s.org} — ${s.title}`);
    }
    if (t.sol) assert.ok(findAny(t.sol), `${t.id}: немає рішення ${t.sol}`);
    if (t.ls) assert.ok(LESSON_BY_ID.get(t.ls), `${t.id}: немає уроку ${t.ls}`);
    if (t.go) assert.ok(TIP_GO[t.go], `${t.id}: невідомий розділ ${t.go}`);
    assert.equal(t.tool, undefined, `${t.id}: інструментів у «Їжі» немає`);
  }
  for (const t of T.filter((x) => x.top)) assert.ok(t.sol || t.ls || t.go, `${t.id}: головна порада без переходу`);
  assert.ok(new Set(T.flatMap((t) => t.src)).size >= 55, 'джерел замало');
  // Переходи з добірки: калькулятори, валізка, чадний газ у «Зігрітися»
  const go = new Set(T.map((t) => t.go).filter(Boolean));
  for (const href of ['#/calc/heat', '#/calc/water', '#/bag', '#/tips/heat?g=safe']) assert.ok(go.has(href), href);
  // Небезпечне — з картками-попередженнями: газова плита для тепла, мангал у приміщенні
  assert.equal(byId('fg-noheat')?.sol, 'myth-gas-stove');
  assert.equal(byId('ff-never')?.sol, 'myth-grill');
  assert.equal(byId('ft-doubt')?.sol, 'myth-smell-food');
  assert.equal(byId('ff-outside')?.sol, 'food-burner');
  // Українські джерела — основа: МОЗ, Держпродспоживслужба, ДСНС, «Газмережі», ЮНІСЕФ
  for (const k of ['mohFoodOut', 'dpssOutage', 'dpssSchool', 'dsnsHotDrink', 'gasVin', 'unicefBreast', 'tsnDpssStock']) {
    assert.ok(T.some((t) => t.src.includes(k)), `не використано ${k}`);
  }
});

test('2.10.0: текст охайний — без латинської «зет», змішаних слів, прямого апострофа й зайвих пробілів', () => {
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
  for (const g of Object.values(FOOD_GROUPS)) for (const s of [g.label, g.sub]) assert.ok(!/[Zz]/.test(s) && !MIX.test(s), s);
  for (const v of Object.values(TIP_GO)) assert.ok(!/[Zz]/.test(v.t) && !MIX.test(v.t), v.t);
  const src = readFileSync(new URL('./tips-food.js', import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
  assert.ok(!/[Zz]/.test(src), 'tips-food.js: латинська «зет»');
});

test('2.10.0: більше тексту — довге «чому», 2–6 кроків і «Цікаво знати» в більшості порад', () => {
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
  assert.ok(why / T.length >= 380, `«чому» в середньому коротке: ${Math.round(why / T.length)}`);
  assert.ok(T.filter((t) => t.fact).length >= 36, '«Цікаво знати» — у більшості порад');
  assert.ok(steps >= 220, `кроків замало: ${steps}`);
  const facts = T.map((t) => t.fact).filter(Boolean);
  assert.equal(new Set(facts).size, facts.length, 'один факт у двох порадах');
});

test('2.10.0: безпека змісту — вогонь і газ лише як правила, жодної консервації, без медичних інструкцій', () => {
  const FIRE = /пальник|картридж|балон|мангал|гриль|вугілл|хібачі/i;
  for (const t of T) {
    const s = text(t);
    // Пальник, балон, мангал — лише в групах про плиту й вогонь
    if (!['stove', 'flame'].includes(t.g)) assert.ok(!FIRE.test(s), `${t.id}: «${s.match(FIRE)?.[0]}» поза групами безпеки`);
    // Консервація — лише як заборона купувати чи їсти
    for (const x of all(t)) {
      if (/консервац/i.test(x)) assert.match(x, /не купу|не їжте|не їсти|стихійн|законсерв/i, `${t.id}: консервація не як заборона — ${x}`);
    }
    assert.ok(!/закатайте|закатати|стерилізуйте банк|закрутіть банк|маринуйте|рецепт/i.test(s), `${t.id}: інструкція з консервування`);
    // Жодних доз ліків і медичних процедур
    assert.ok(!/таблетк|доз[уаи]|\d\s?мг\b|промийте шлунок|викличте блювання/i.test(s), `${t.id}: медична інструкція`);
    for (const bad of ['саморобн', 'керосин', 'обігрівач зі свічок']) assert.ok(!s.toLowerCase().includes(bad), `${t.id}: ${bad}`);
  }
  // Кожна порада групи «Пальник і мангал» — правило з обмеженням
  for (const t of T.filter((x) => x.g === 'flame')) assert.match(text(t), /ніколи|лише|тільки|не спіть|не для дітей|подалі/i, t.id);
  assert.match(byId('ff-outside')?.how.join(' ') || '', /Ніколи — в укритті, підвалі, машині, наметі/);
  assert.match(byId('ff-never')?.t || '', /тільки надворі й ніколи біля відчиненого вікна/);
  assert.match(byId('fg-noheat')?.t || '', /не грійтеся/);
  assert.ok(byId('fg-noheat')?.warn?.some((s) => /103/.test(s)), 'ознаки чадного газу — з номером 103');
  assert.match(byId('fg-oil')?.t || '', /не лийте воду/);
  assert.match(byId('ft-home')?.t || '', /Не купуйте консервацію/);
  assert.match(byId('fn-beans')?.t || '', /без варіння не їжте/);
  // Немовлята: грудне вигодовування — найбезпечніше, суміш — за CDC, мед — не раніше року
  assert.ok(byId('fb-breast')?.top);
  assert.match(byId('fb-rtf')?.d || '', /найбезпечніший/);
  assert.ok(byId('fb-powder')?.warn?.some((s) => /хімічним забрудненням/.test(s)));
  assert.match(byId('fb-honey')?.t || '', /до року/);
});

test('2.10.0: числа — ті, що в джерелах', () => {
  assert.match(byId('fr-closed')?.d || '', /4 годин.*48.*24/);
  assert.match(byId('fr-closed')?.fact || '', /«Саме тому годинник не замінює термометр»/);
  assert.match(byId('fr-thermo')?.d || '', /\+4 °C.*−18 °C/);
  assert.match(byId('fr-thermo')?.fact || '', /20 хвилин/);
  assert.match(byId('fo-dryice')?.d || '', /11 кг.*280 л.*3–4 доби/);
  assert.match(byId('fo-dryice')?.fact || '', /23 кг.*0,5 м³.*2 доби/);
  assert.ok(byId('fo-thaw')?.how.some((s) => /30 хвилин/.test(s)));
  assert.match(byId('fo-thaw')?.fact || '', /півтора раза/);
  assert.match(byId('fo-bag')?.fact || '', /\+4 °C.*\+5 °C.*\+60 °C/);
  assert.match(byId('fo-noadd')?.fact || '', /4 години.*\+4 °C/);
  assert.match(byId('ft-keep')?.fact || '', /8 годин.*\+10 °C/);
  assert.match(byId('ft-keep')?.why || '', /2 години.*\+4 °C/);
  assert.match(byId('ft-mold')?.t || '', /2,5 см/);
  assert.match(byId('fs-days')?.t || '', /7–12 днів/);
  assert.match(byId('fs-days')?.d || '', /7, 10 чи 12 діб/);
  assert.match(byId('fs-what')?.why || '', /0,3 г.*10 г на 100 г/);
  assert.match(byId('fs-place')?.d || '', /\+29 °C/);
  assert.match(byId('fs-place')?.why || '', /\+38 °C/);
  assert.match(byId('fs-place')?.fact || '', /12 000 франків/);
  assert.match(byId('fs-long')?.d || '', /30 років/);
  assert.match(byId('fs-long')?.fact || '', /20 років/);
  assert.match(byId('fs-dates')?.t || '', /«Вжити до».*«краще спожити до»/);
  assert.match(byId('fn-opened')?.t || '', /2 години.*годину/);
  assert.match(byId('fn-opened')?.why || '', /\+32 °C/);
  assert.match(byId('fn-cans')?.fact || '', /12–18 місяців.*2–5 років/);
  assert.match(byId('fn-beans')?.t || '', /4–5/);
  assert.match(byId('fn-beans')?.d || '', /10 хвилин/);
  assert.match(byId('fn-beans')?.why || '', /5 годин/);
  assert.match(byId('fn-beans')?.fact || '', /\+80 °C.*вп’ятеро.*\+75 °C/);
  assert.match(byId('fh-retained')?.why || '', /1916/);
  assert.match(byId('fh-retained')?.fact || '', /1917.*5,7 л.*4 години.*\+78 °C.*8 годин.*\+68 °C/);
  assert.match(byId('fh-lid')?.why || '', /10–14.*16–20.*22–24.*24–26 см/);
  assert.match(byId('fh-station')?.d || '', /93 Вт·год/);
  assert.match(byId('fh-station')?.fact || '', /900–1200 Вт/);
  assert.match(byId('fh-70')?.d || '', /\+70 °C/);
  assert.ok(byId('fh-70')?.how.some((s) => /\+74 °C/.test(s)));
  assert.match(byId('fg-match')?.why || '', /6 секунд/);
  assert.ok(byId('fg-match')?.how.some((s) => /1 хвилину/.test(s)));
  assert.match(byId('fg-air')?.why || '', /2 м³/);
  assert.match(byId('fg-smell')?.t || '', /104/);
  assert.ok(byId('fg-smell')?.how.some((s) => /112/.test(s)));
  assert.ok(byId('fg-oil')?.how.some((s) => /101/.test(s)));
  assert.ok(byId('ff-sleep')?.how.some((s) => /103/.test(s)));
  assert.match(byId('fb-powder')?.t || '', /5 хвилин/);
  assert.match(byId('fb-powder')?.d || '', /\+70 °C/);
  assert.match(byId('fb-time')?.why || '', /2 годин.*години.*24 години/);
  assert.match(byId('fb-honey')?.why || '', /12 місяців/);
  assert.ok(byId('fk-hands')?.how.some((s) => /60 %/.test(s)));
});

test('2.10.0: «див. пораду N» ведуть туди, куди задумано', () => {
  const want = { 6: 'fr-back', 7: 'fo-bag', 8: 'fo-thaw', 16: 'ft-cans' };
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

test('2.10.0: пошук порад — зокрема за «Цікаво знати» й джерелом — і перехід із пошуку бібліотеки', async () => {
  const { searchTips } = await import('./tipsui.js');
  assert.equal(searchTips('', T).length, 66);
  assert.ok(searchTips('термос', T).some((t) => t.id === 'fh-thermos'));
  assert.ok(searchTips('ХОЛОДИЛЬНИК', T).some((t) => t.id === 'fr-closed'), 'регістр не важить');
  assert.ok(searchTips('Наполеон', T).some((t) => t.id === 'fs-place'), 'слово лише з «Цікаво знати»');
  assert.ok(searchTips("з'їжте", T).length > 0, 'прямий апостроф знаходить ’');
  assert.ok(searchTips('ЮНІСЕФ', T).some((t) => t.id === 'fb-breast'), 'пошук за джерелом');
  assert.ok(searchTips('сухий лід', T).some((t) => t.id === 'fo-dryice'));
  assert.ok(searchTips('ботулізм', T).some((t) => t.id === 'ft-home'));
  assert.deepEqual(searchTips('такого-слова-немає', T), []);
  for (const q of ['холодильник', 'термос', 'консерви', 'суміш', 'пальник', 'їжа', 'морозилка', 'окріп']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/tips/food'), q);
  }
  const sec = SECTIONS.find((s) => s.href === '#/tips/food');
  assert.ok(sec?.title.includes(`${T.length} перевірених порад`), 'кількість у бібліотеці збігається');
});

test('2.10.0: екран добірки — заголовок, чипи, головні, «Цікаво знати» й переходи', async () => {
  const { tipsScreens } = await import('./tipsui.js');
  const v = tipsScreens.food(new URLSearchParams());
  assert.equal(v.title, 'Їжа без світла: 66 порад');
  assert.equal(v.tab, 'home');
  assert.ok(v.html.includes('href="#/need/food"'), 'назад — на екран «Потрібна їжа»');
  assert.equal((v.html.match(/class="chip"/g) || []).length, 12, 'чипи: головні, усі й 10 груп');
  assert.equal((v.html.match(/<li class="tip/g) || []).length, 66);
  assert.equal((v.html.match(/<aside class="tip-fact">/g) || []).length, T.filter((t) => t.fact).length);
  assert.ok(v.html.includes('«Цікаво знати»'), 'підказка згадує блок');
  assert.ok(!v.html.includes('data-act="tool"'), 'інструментів тут немає');
  for (const href of new Set(T.map((t) => t.go).filter(Boolean))) assert.ok(v.html.includes(`href="${href}"`), href);
  for (const id of ['food-storage', 'myth-gas-stove', 'food-burner']) assert.ok(v.html.includes(`href="#/s/${id}"`), id);
  const top = tipsScreens.food(new URLSearchParams('g=top'));
  assert.equal((top.html.match(/<li class="tip top"/g) || []).length, 10);
  assert.equal((top.html.match(/<details class="tip-x" open>/g) || []).length, 10, 'головні — розгорнуті');
  const baby = tipsScreens.food(new URLSearchParams('g=baby'));
  assert.equal((baby.html.match(/<li class="tip/g) || []).length, 6);
  const odd = tipsScreens.food(new URLSearchParams('g=calm'));
  assert.equal((odd.html.match(/<li class="tip/g) || []).length, 66, 'група з іншої добірки — показуємо все');
  // Офлайн: модуль у кеші Service Worker
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("'./tips-food.js'"), 'tips-food.js у CORE');
  assert.match(sw, /const VERSION = 'avtonomno-v2\.\d+\.\d+'/, 'версія кешу — 2.x');
});
