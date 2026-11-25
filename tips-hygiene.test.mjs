// Тести 2.12.0: «Побут і гігієна» — 58 перевірених порад з розширеним поясненням і «Цікаво знати». Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPS, TIPS_LABEL, TIP_SETS, ALL_TIP_GROUPS, TIP_GROUPS, TIP_GO, tipNo } from './tips.js';
import { TIPS_ENERGY, ENERGY_GROUPS } from './tips-energy.js';
import { TIPS_SHELTER, SHELTER_GROUPS } from './tips-shelter.js';
import { TIPS_FOOD, FOOD_GROUPS } from './tips-food.js';
import { TIPS_WATER, WATER_GROUPS } from './tips-water.js';
import { TIPS_HYGIENE, HYGIENE_GROUPS, HYGIENE_GROUP_ORDER } from './tips-hygiene.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { sectionsFor, SECTIONS } from './shelter.js';

const T = TIPS_HYGIENE;
const byId = (id) => T.find((t) => t.id === id);
const all = (t) => [t.t, t.d || '', t.why, t.fact || '', ...t.how, ...(t.warn || [])].filter(Boolean);
const text = (t) => all(t).join(' ');
const MIX = /[Ѐ-ӿ][A-Za-z]|[A-Za-z][Ѐ-ӿ]/;

test('2.12.0: 58 порад, 10 головних, 10 груп по порядку, id не перетинаються з іншими добірками', () => {
  assert.equal(T.length, 58);
  assert.equal(new Set(T.map((t) => t.id)).size, 58, 'повтор id');
  assert.equal(new Set(T.map((t) => t.t)).size, 58, 'повтор тексту поради');
  assert.equal(T.filter((t) => t.top).length, 10);
  assert.deepEqual([...HYGIENE_GROUP_ORDER].sort(), Object.keys(HYGIENE_GROUPS).sort());
  assert.equal(HYGIENE_GROUP_ORDER.length, 10);
  for (const g of HYGIENE_GROUP_ORDER) {
    assert.ok(T.filter((t) => t.g === g).length >= 5, `замало порад у групі ${g}`);
    assert.equal(T.filter((t) => t.g === g && t.top).length, 1, `у групі ${g} — рівно одна головна`);
  }
  const order = T.map((t) => HYGIENE_GROUP_ORDER.indexOf(t.g));
  assert.ok(order.every((v) => v >= 0), 'порада з невідомою групою');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  T.forEach((t, i) => assert.equal(tipNo(t), i + 1));
  const other = new Set([...TIPS.heat || [], ...TIPS_ENERGY, ...TIPS_SHELTER, ...TIPS_FOOD, ...TIPS_WATER].map((t) => t.id));
  assert.ok(T.every((t) => !other.has(t.id)), 'id перетинається з іншою добіркою');
  for (const g of Object.keys(HYGIENE_GROUPS)) {
    assert.ok(!(g in TIP_GROUPS) && !(g in ENERGY_GROUPS) && !(g in SHELTER_GROUPS) && !(g in FOOD_GROUPS) && !(g in WATER_GROUPS), `група ${g} перетинається`);
    assert.equal(ALL_TIP_GROUPS[g], HYGIENE_GROUPS[g]);
  }
  // «Побут і гігієна» — потреба головного екрана: посилання «Зробіть зараз» веде на добірку
  assert.equal(TIPS.hygiene, T);
  assert.equal(TIPS_LABEL.hygiene, 'як дбати про чистоту й здоров’я без води');
  assert.equal(TIP_SETS.hygiene.list, T);
  assert.equal(TIP_SETS.hygiene.back, '#/need/hygiene');
  // Решта добірок не змінилася
  assert.equal(TIPS.heat?.length, 100);
  assert.equal(TIPS.energy?.length, 100);
  assert.equal(TIPS_SHELTER.length, 70);
  assert.equal(TIPS.food?.length, 66);
  assert.equal(TIPS.water?.length, 63);
});

test('2.12.0: джерела, рішення, уроки й розділи існують; головні — з переходом далі', () => {
  for (const t of T) {
    assert.ok(t.src.length >= 1, `${t.id}: без джерела`);
    assert.equal(new Set(t.src).size, t.src.length, `${t.id}: повтор джерела`);
    for (const k of t.src) {
      const s = SOURCES[k];
      assert.ok(s, `${t.id}: немає джерела ${k}`);
      assert.match(s.url, /^https:\/\//, `${k}: посилання не https`);
      assert.ok(s.org.trim() && s.title.trim(), `${k}: порожня назва`);
      assert.ok(!/[Zz]/.test(k + s.org + s.title) && !MIX.test(s.title), `${k}: ${s.org} — ${s.title}`);
    }
    if (t.sol) assert.ok(findAny(t.sol), `${t.id}: немає рішення ${t.sol}`);
    if (t.ls) assert.ok(LESSON_BY_ID.get(t.ls), `${t.id}: немає уроку ${t.ls}`);
    if (t.go) assert.ok(TIP_GO[t.go], `${t.id}: невідомий розділ ${t.go}`);
    assert.equal(t.tool, undefined, `${t.id}: інструментів у «Гігієні» немає`);
  }
  for (const t of T.filter((x) => x.top)) assert.ok(t.sol || t.ls || t.go, `${t.id}: головна порада без переходу`);
  assert.ok(new Set(T.flatMap((t) => t.src)).size >= 45, 'джерел замало');
  // Переходи з добірки: «Що маю» — санітарія, калькулятор води, валізка, режим укриття
  const go = new Set(T.map((t) => t.go).filter(Boolean));
  for (const href of ['#/have/sanitation', '#/calc/water', '#/bag', '#/shelter']) assert.ok(go.has(href), href);
  // Рішення застосунку з потреби «Побут і гігієна» — кожне має свою головну пораду
  const sol = { 'gh-when': 'hyg-hands', 'gt-setup': 'hyg-toilet', 'gw-parts': 'hyg-wash', 'gl-bucket': 'hyg-laundry', 'gd-scrape': 'hyg-dishes', 'gr-sort': 'hyg-waste', 'gm-air': 'hyg-damp' };
  for (const [id, s] of Object.entries(sol)) assert.equal(byId(id)?.sol, s, id);
  // Українські джерела — основа: МОЗ, ЦГЗ, ЮНІСЕФ Україна, Червоний Хрест, ДСНС; переклади українською — Орегон і Малтнома
  for (const k of ['mohKidsWater', 'mohHandsKids', 'mohHandGel', 'mohShelterInf', 'upHygienePhc', 'upRespPhc', 'upPeriodPhc', 'unicefHands', 'redcrossHypo', 'dsnsPich', 'oemToiletUa', 'multcoUa']) {
    assert.ok(T.some((t) => t.src.includes(k)), `не використано ${k}`);
  }
  // Українською мовою — щонайменше третина посилань у добірці
  const keys = T.flatMap((t) => t.src);
  const ua = keys.filter((k) => /МОЗ|ЦГЗ|ЮНІСЕФ|Червоного Хреста|ДСНС|українською/.test(SOURCES[k].org + SOURCES[k].title));
  assert.ok(ua.length * 3 >= keys.length, `українських посилань ${ua.length} із ${keys.length}`);
});

test('2.12.0: текст охайний — без латинської «зет», змішаних слів, прямого апострофа й зайвих пробілів', () => {
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
      assert.ok(!/(^|\s)-\d/.test(s), `${t.id}: мінус пишемо знаком «−»`);
      assert.ok(!/(^|\s)(а|і|й|та|що|не)\s\2(\s|$)/i.test(s), `${t.id}: подвоєне слово — ${s}`);
    }
  }
  for (const g of Object.values(HYGIENE_GROUPS)) for (const s of [g.label, g.sub]) assert.ok(!/[Zz]/.test(s) && !MIX.test(s), s);
  for (const v of Object.values(TIP_GO)) assert.ok(!/[Zz]/.test(v.t) && !MIX.test(v.t), v.t);
  const src = readFileSync(new URL('./tips-hygiene.js', import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
  assert.ok(!/[Zz]/.test(src), 'tips-hygiene.js: латинська «зет»');
});

test('2.12.0: більше тексту — довге «чому», 2–6 кроків і «Цікаво знати» в більшості порад', () => {
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
  assert.ok(T.filter((t) => t.fact).length >= 34, '«Цікаво знати» — у більшості порад');
  assert.ok(steps >= 190, `кроків замало: ${steps}`);
  const facts = T.map((t) => t.fact).filter(Boolean);
  assert.equal(new Set(facts).size, facts.length, 'один факт у двох порадах');
});

test('2.12.0: безпека змісту — відбілювач лише в офіційних розведеннях, без змішування, вогню й медичних доз', () => {
  const DOSE = /чайн\S* ложк|столов\S* ложк|\d\s?мл\b|частин\S* відбілювач|відбілювач\S* на/i;
  for (const t of T) {
    const s = text(t);
    // Розведення відбілювача — лише там, де їх дають CDC, Університет Флориди й штат Юта, і завжди із застереженням
    if (DOSE.test(s)) {
      assert.ok(['laundry', 'dishes', 'waste', 'disinf'].includes(t.g), `${t.id}: розведення поза прибиранням`);
      assert.ok(t.warn?.some((w) => /Не змішуйте відбілювач/.test(w)), `${t.id}: розведення без застереження`);
      assert.ok(t.src.some((k) => ['cdcBleach', 'cdcNoroFacts', 'cdcRodent', 'cdcAdvisory', 'utahClean', 'ufDishes'].includes(k)), `${t.id}: розведення без офіційного джерела`);
    }
    // Аміак і «змішування» — лише як заборона
    for (const x of all(t)) if (/аміак/i.test(x)) assert.match(x, /не можна|застерігає|попереджає/i, `${t.id}: аміак — ${x}`);
    // Вогонь і спалювання — лише як заборона
    for (const x of all(t)) if (/спалю|спалит|підпал|над плитою|на печі|на обігрівач/i.test(x)) assert.match(x, /[Нн]е |заборонено|застерігають|спокуса/, `${t.id}: вогонь не як заборона — ${x}`);
    // Жодних доз ліків, медичних процедур і саморобних засобів
    assert.ok(!/\d\s?мг\b|таблет|ліки\b|парацетамол|ібупрофен|регідрон|промийте шлунок|викличте блювання|марганц|перманганат|саморобн\S* (антисептик|мило|засіб)/i.test(s), `${t.id}: медична чи саморобна інструкція`);
    for (const bad of ['керосин', 'бензин', 'обігрівач зі свічок', 'газова плита для тепла']) assert.ok(!s.toLowerCase().includes(bad), `${t.id}: ${bad}`);
  }
  // Ключові заборони й межі — у самих порадах
  assert.match(byId('gr-burn')?.t || '', /Не спалюйте сміття/);
  assert.match(byId('gc-nomix')?.t || '', /Ніколи не змішуйте відбілювач/);
  assert.match(byId('gl-dry')?.t || '', /а не над плитою чи на обігрівачі/);
  assert.match(byId('gr-rodent')?.t || '', /не замітайте й не пилососьте/);
  assert.match(byId('gr-sharp')?.t || '', /а не в пакет/);
  assert.match(byId('gw-unsafe')?.t || '', /з дозволу водоканалу й не ковтайте/);
  assert.match(byId('gm-small')?.t || '', /більшу — до фахівців/);
  assert.match(byId('gw-period')?.t || '', /не довше 8 годин/);
  assert.match(byId('gw-period')?.why || '', /відмовитися від тампонів/, 'ЦГЗ: в укритті — прокладки');
  assert.match(byId('gh-wipes')?.t || '', /лише крайній варіант/);
  assert.match(byId('gk-gel')?.t || '', /під наглядом дорослих/);
  assert.ok(byId('gk-gel')?.how.some((s) => /103/.test(s)), 'проковтнутий антисептик — номер 103');
  assert.ok(!byId('gk-bottle')?.how.some((s) => /спирт/.test(s)), 'пляшечки не протирають спиртом');
  // Антисептик — не менше 60 % спирту (ЦГЗ і CDC), а серветки не замінюють миття
  assert.match(byId('gh-gel')?.how.join(' ') || '', /щонайменше 60 %/);
});

test('2.12.0: числа — ті, що в джерелах', () => {
  assert.match(byId('gh-20s')?.t || '', /20 секунд/);
  assert.match(byId('gh-20s')?.d || '', /20–30 секунд.*40–60/);
  assert.match(byId('gh-gel')?.t || '', /60–80 %/);
  assert.match(byId('gh-gel')?.fact || '', /60–95 %/);
  assert.match(byId('gt-cover')?.why || '', /пів склянки/);
  assert.match(byId('gt-half')?.t || '', /наполовину/);
  assert.match(byId('gt-two')?.fact || '', /тижнями.*місяцями/);
  assert.match(byId('gw-water')?.d || '', /3 л.*10–12 л/);
  assert.match(byId('gw-water')?.why || '', /2–6 л/);
  assert.match(byId('gw-water')?.fact || '', /250 г.*200 г/);
  assert.match(byId('gw-parts')?.fact || '', /10 °C/);
  assert.match(byId('gw-period')?.why || '', /4–8 годин/);
  assert.match(byId('gl-bucket')?.why || '', /один-два десятки/);
  assert.match(byId('gl-bucket')?.fact || '', /галона.*4 л/);
  assert.match(byId('gl-sick')?.how.join(' ') || '', /≈120 мл на 8–11 л.*10 хвилин/);
  assert.match(byId('gd-three')?.d || '', /1 чайну ложку.*≈4 л/);
  assert.match(byId('gd-three')?.fact || '', /5–10 хвилин.*77 °C/);
  assert.match(byId('gd-cloth')?.t || '', /2–3 дні/);
  assert.match(byId('gr-cold')?.fact || '', /1,2 м.*45 см/);
  assert.match(byId('gr-rodent')?.d || '', /1 частина відбілювача на 9 частин води.*5 хвилин/);
  assert.match(byId('gk-baby')?.t || '', /37 °C/);
  assert.match(byId('gk-baby')?.d || '', /2 тижнів/);
  assert.match(byId('gk-diaper')?.t || '', /3–4 години/);
  assert.match(byId('gk-diaper')?.fact || '', /трильйон/);
  assert.match(byId('gk-bottle')?.t || '', /5 хвилин/);
  assert.match(byId('gk-bottle')?.why || '', /2 місяців/);
  assert.match(byId('gk-gel')?.fact || '', /70 669.*92 %/);
  assert.match(byId('gk-hot')?.fact || '', /60 °C.*6 секунд.*54 °C.*30 секунд.*49 °C.*5 хвилин/);
  assert.match(byId('gs-air')?.t || '', /тричі на день/);
  assert.match(byId('gc-bleach')?.t || '', /4 чайні ложки на ≈1 л/);
  assert.match(byId('gc-bleach')?.d || '', /5–9 %/);
  assert.match(byId('gc-bleach')?.why || '', /24 години/);
  assert.match(byId('gc-sick')?.d || '', /5–25 столових ложок.*≈4 л/);
  assert.match(byId('gm-rh')?.t || '', /30–50 %/);
  assert.match(byId('gm-rh')?.fact || '', /50 %.*30–40 %/);
  assert.match(byId('gm-small')?.t || '', /≈1 м²/);
  assert.match(byId('gm-small')?.why || '', /10 квадратних футів/);
  assert.match(byId('gm-dry')?.t || '', /24–48 годин/);
});

test('2.12.0: «див. пораду N» ведуть туди, куди задумано', () => {
  const want = { 26: 'gd-three' };
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

test('2.12.0: пошук порад — зокрема за «Цікаво знати» й джерелом — і перехід із пошуку бібліотеки', async () => {
  const { searchTips } = await import('./tipsui.js');
  assert.equal(searchTips('', T).length, 58);
  assert.ok(searchTips('антисептик', T).some((t) => t.id === 'gh-gel'));
  assert.ok(searchTips('ВАНТУЗ', T).some((t) => t.id === 'gl-bucket'), 'регістр не важить');
  assert.ok(searchTips('скріпки', T).some((t) => t.id === 'gk-diaper'), 'слово лише з «Цікаво знати»');
  assert.ok(searchTips('міцели', T).some((t) => t.id === 'gh-20s'));
  assert.ok(searchTips("зав'яз", T).length > 0, 'прямий апостроф знаходить ’');
  assert.ok(searchTips('ЮНФПА', T).some((t) => t.id === 'gw-kit'), 'пошук за джерелом');
  assert.ok(searchTips('норовірус', T).some((t) => t.id === 'gc-sick'));
  assert.ok(searchTips('гігрометр', T).some((t) => t.id === 'gm-rh'));
  assert.deepEqual(searchTips('такого-слова-немає', T), []);
  for (const q of ['гігієна', 'антисептик', 'туалет', 'прання', 'пліснява', 'підгузки', 'посуд', 'сміття', 'відбілювач', 'менструація']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/tips/hygiene'), q);
  }
  const sec = SECTIONS.find((s) => s.href === '#/tips/hygiene');
  assert.ok(sec?.title.includes(`${T.length} перевірених порад`), 'кількість у бібліотеці збігається');
  // Добірки «Вода» й «Їжа» з пошуку бібліотеки не зникли
  assert.ok(sectionsFor('бювет').some((s) => s.href === '#/tips/water'));
  assert.ok(sectionsFor('холодильник').some((s) => s.href === '#/tips/food'));
});

test('2.12.0: екран добірки — заголовок із правильною множиною, чипи, головні, «Цікаво знати» й переходи', async () => {
  const { tipsScreens } = await import('./tipsui.js');
  const v = tipsScreens.hygiene(new URLSearchParams());
  assert.equal(v.title, 'Побут і гігієна: 58 порад');
  assert.equal(v.tab, 'home');
  assert.ok(v.html.includes('href="#/need/hygiene"'), 'назад — на екран «Побут і гігієна»');
  assert.equal((v.html.match(/class="chip"/g) || []).length, 12, 'чипи: головні, усі й 10 груп');
  assert.equal((v.html.match(/<li class="tip/g) || []).length, 58);
  assert.equal((v.html.match(/<aside class="tip-fact">/g) || []).length, T.filter((t) => t.fact).length);
  assert.ok(v.html.includes('«Цікаво знати»'), 'підказка згадує блок');
  assert.ok(!v.html.includes('data-act="tool"'), 'інструментів тут немає');
  for (const href of new Set(T.map((t) => t.go).filter(Boolean))) assert.ok(v.html.includes(`href="${href}"`), href);
  for (const id of ['hyg-hands', 'hyg-toilet', 'hyg-wash', 'hyg-laundry', 'hyg-dishes', 'hyg-waste', 'hyg-damp']) assert.ok(v.html.includes(`href="#/s/${id}"`), id);
  const top = tipsScreens.hygiene(new URLSearchParams('g=top'));
  assert.equal((top.html.match(/<li class="tip top"/g) || []).length, 10);
  assert.equal((top.html.match(/<details class="tip-x" open>/g) || []).length, 10, 'головні — розгорнуті');
  const disinf = tipsScreens.hygiene(new URLSearchParams('g=disinf'));
  assert.equal((disinf.html.match(/<li class="tip/g) || []).length, 6);
  const odd = tipsScreens.hygiene(new URLSearchParams('g=boil'));
  assert.equal((odd.html.match(/<li class="tip/g) || []).length, 58, 'група з іншої добірки — показуємо все');
  // Множина в заголовках інших добірок не змінилася
  assert.equal(tipsScreens.water(new URLSearchParams()).title, 'Вода без водогону: 63 поради');
  assert.equal(tipsScreens.food(new URLSearchParams()).title, 'Їжа без світла: 66 порад');
  // Офлайн: модуль у кеші Service Worker
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("'./tips-hygiene.js'"), 'tips-hygiene.js у CORE');
  assert.match(sw, /const VERSION = 'avtonomno-v2\.\d+\.\d+'/);
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  assert.match(pkg.version, /^2\.(1[2-9]|[2-9]\d)\.\d+$/, 'версія не нижча за 2.12.0');
});
