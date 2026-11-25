// Тести 2.11.0: «Вода без водогону» — 63 перевірені поради з розширеним поясненням і «Цікаво знати». Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPS, TIPS_LABEL, TIP_SETS, ALL_TIP_GROUPS, TIP_GROUPS, TIP_GO, tipNo } from './tips.js';
import { TIPS_ENERGY, ENERGY_GROUPS } from './tips-energy.js';
import { TIPS_SHELTER, SHELTER_GROUPS } from './tips-shelter.js';
import { TIPS_FOOD, FOOD_GROUPS } from './tips-food.js';
import { TIPS_WATER, WATER_GROUPS, WATER_GROUP_ORDER } from './tips-water.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { sectionsFor, SECTIONS } from './shelter.js';

const T = TIPS_WATER;
const byId = (id) => T.find((t) => t.id === id);
const all = (t) => [t.t, t.d || '', t.why, t.fact || '', ...t.how, ...(t.warn || [])].filter(Boolean);
const text = (t) => all(t).join(' ');
const MIX = /[Ѐ-ӿ][A-Za-z]|[A-Za-z][Ѐ-ӿ]/;

test('2.11.0: 63 поради, 10 головних, 10 груп по порядку, id не перетинаються з іншими добірками', () => {
  assert.equal(T.length, 63);
  assert.equal(new Set(T.map((t) => t.id)).size, 63, 'повтор id');
  assert.equal(new Set(T.map((t) => t.t)).size, 63, 'повтор тексту поради');
  assert.equal(T.filter((t) => t.top).length, 10);
  assert.deepEqual([...WATER_GROUP_ORDER].sort(), Object.keys(WATER_GROUPS).sort());
  assert.equal(WATER_GROUP_ORDER.length, 10);
  for (const g of WATER_GROUP_ORDER) {
    assert.ok(T.filter((t) => t.g === g).length >= 6, `замало порад у групі ${g}`);
    assert.equal(T.filter((t) => t.g === g && t.top).length, 1, `у групі ${g} — рівно одна головна`);
  }
  const order = T.map((t) => WATER_GROUP_ORDER.indexOf(t.g));
  assert.ok(order.every((v) => v >= 0), 'порада з невідомою групою');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  T.forEach((t, i) => assert.equal(tipNo(t), i + 1));
  const other = new Set([...TIPS.heat || [], ...TIPS_ENERGY, ...TIPS_SHELTER, ...TIPS_FOOD].map((t) => t.id));
  assert.ok(T.every((t) => !other.has(t.id)), 'id перетинається з іншою добіркою');
  for (const g of Object.keys(WATER_GROUPS)) {
    assert.ok(!(g in TIP_GROUPS) && !(g in ENERGY_GROUPS) && !(g in SHELTER_GROUPS) && !(g in FOOD_GROUPS), `група ${g} перетинається`);
    assert.equal(ALL_TIP_GROUPS[g], WATER_GROUPS[g]);
  }
  // «Вода» — потреба головного екрана: посилання «Зробіть зараз» веде на добірку
  assert.equal(TIPS.water, T);
  assert.equal(TIPS_LABEL.water, 'як запасти, знезаразити й зберегти воду');
  assert.equal(TIP_SETS.water.list, T);
  assert.equal(TIP_SETS.water.back, '#/need/water');
  // Решта добірок не змінилася
  assert.equal(TIPS.heat?.length, 100);
  assert.equal(TIPS.energy?.length, 100);
  assert.equal(TIPS_SHELTER.length, 70);
  assert.equal(TIPS.food?.length, 66);
});

test('2.11.0: джерела, рішення, уроки й розділи існують; головні — з переходом далі', () => {
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
    assert.equal(t.tool, undefined, `${t.id}: інструментів у «Воді» немає`);
  }
  for (const t of T.filter((x) => x.top)) assert.ok(t.sol || t.ls || t.go, `${t.id}: головна порада без переходу`);
  assert.ok(new Set(T.flatMap((t) => t.src)).size >= 55, 'джерел замало');
  // Переходи з добірки: калькулятори, валізка, «Що маю» — вода й санітарія
  const go = new Set(T.map((t) => t.go).filter(Boolean));
  for (const href of ['#/calc/water', '#/calc/heat', '#/bag', '#/have/water', '#/have/sanitation']) assert.ok(go.has(href), href);
  // Рішення застосунку: кип’ятіння, хлорування, окремо питна й технічна, міф про кип’ятіння хімії
  assert.equal(byId('wb-1min')?.sol, 'water-boil');
  assert.equal(byId('wd-tabs')?.sol, 'water-chlorine');
  assert.equal(byId('wg-bath')?.sol, 'water-separate');
  assert.equal(byId('wb-chem')?.sol, 'myth-boil-chem');
  assert.equal(byId('wa-3l')?.sol, 'water-calc');
  // Українські джерела — основа: МОЗ, ЦГЗ, Держпродспоживслужба, КМДА й «Київводоканал», Київський ЦКПХ
  for (const k of ['phcWater', 'phcWater4', 'mohDisinfect', 'mohWays', 'mohDehyd', 'mohDrink', 'dpssWater', 'dpssLabel', 'kmdaBuvet', 'kmdaFlush', 'ukrnewsUpper', 'unianSnow', 'regionPipes']) {
    assert.ok(T.some((t) => t.src.includes(k)), `не використано ${k}`);
  }
});

test('2.11.0: текст охайний — без латинської «зет», змішаних слів, прямого апострофа й зайвих пробілів', () => {
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
    }
  }
  for (const g of Object.values(WATER_GROUPS)) for (const s of [g.label, g.sub]) assert.ok(!/[Zz]/.test(s) && !MIX.test(s), s);
  for (const v of Object.values(TIP_GO)) assert.ok(!/[Zz]/.test(v.t) && !MIX.test(v.t), v.t);
  const src = readFileSync(new URL('./tips-water.js', import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '');
  assert.ok(!/[Zz]/.test(src), 'tips-water.js: латинська «зет»');
});

test('2.11.0: більше тексту — довге «чому», 2–6 кроків і «Цікаво знати» в більшості порад', () => {
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
  assert.ok(steps >= 200, `кроків замало: ${steps}`);
  const facts = T.map((t) => t.fact).filter(Boolean);
  assert.equal(new Set(facts).size, facts.length, 'один факт у двох порадах');
});

test('2.11.0: безпека змісту — знезараження лише офіційними методами, без саморобних фільтрів і медичних доз', () => {
  for (const t of T) {
    const s = text(t);
    // Жодних неофіційних способів: марганцівка, вугілля, срібло, кремінь, виморожування, саморобні фільтри
    assert.ok(!/марганц|перманганат|активован|срібл|кремен|кремін|вимороз|саморобн|пісок і вугілля|йодн[аоу] настоянк|зеленк/i.test(s), `${t.id}: неофіційний спосіб — ${s.match(/марганц|перманганат|активован|срібл|кремен|кремін|вимороз|саморобн|йодн[аоу] настоянк|зеленк/i)?.[0]}`);
    // Краплі відбілювача — лише в групі «Знезараження» й за CDC
    if (/\d\s*крапл/.test(s)) assert.equal(t.g, 'treat', `${t.id}: дозування поза групою «Знезараження»`);
    // Таблетки — лише для знезараження води за інструкцією (або як заборона для басейну)
    for (const x of all(t)) if (/таблет/i.test(x)) assert.match(x, /знезараж|інструкц|басейн|хімі|упаков|таблетка розрахована|діоксид|прибирають|для питної води/i, `${t.id}: таблетки не для води — ${x}`);
    // Жодних доз ліків, регідратації й медичних процедур
    assert.ok(!/\d\s?мг\b|регідрон|сольов\S* розчин|промийте шлунок|викличте блювання|ложк\S* солі|ложк\S* цукру/i.test(s), `${t.id}: медична інструкція`);
    // Вогонь — лише як заборона гріти трубу
    if (/пальник|паяльн|відкрит\S* вогн/i.test(s)) assert.equal(t.g, 'pipes', `${t.id}: вогонь поза групою «Труби»`);
    for (const bad of ['керосин', 'обігрівач зі свічок', 'газова плита для тепла']) assert.ok(!s.toLowerCase().includes(bad), `${t.id}: ${bad}`);
  }
  // Ключові заборони — у самих порадах
  assert.match(byId('wb-chem')?.t || '', /Кип’ятіння не прибирає хімію, пальне, метали й нітрати/);
  assert.match(byId('wa-raw')?.t || '', /Не пийте неочищену воду/);
  assert.match(byId('ws-snow')?.t || '', /лише технічна вода/);
  assert.match(byId('ws-rain')?.t || '', /не для пиття/);
  assert.match(byId('wh-radiator')?.t || '', /не пийте/);
  assert.match(byId('wh-tank')?.t || '', /чаша — ніколи/);
  assert.match(byId('wd-pool')?.t || '', /басейну.*не беріть/);
  assert.match(byId('wd-filter')?.t || '', /не робить сумнівну воду безпечною/);
  assert.match(byId('ws-well')?.t || '', /після обстрілу поруч — не для пиття/);
  assert.match(byId('wr-wait')?.t || '', /не пийте її одразу/);
  assert.match(byId('wp-thaw')?.t || '', /ніколи відкритим вогнем/);
  assert.ok(byId('wp-thaw')?.warn?.some((s) => /Ніколи/.test(s)));
  assert.match(byId('wp-drain')?.t || '', /а не мешканці/);
  assert.match(byId('wg-bucket')?.t || '', /малюк/);
  assert.ok(byId('wh-boiler')?.warn?.some((s) => /гарячою/.test(s)), 'бойлер — застереження про гарячу воду');
  assert.ok(byId('wa-dehyd')?.how.some((s) => /103/.test(s)), 'зневоднення — з номером 103');
  assert.ok(byId('wa-dehyd')?.src.includes('mohDehyd'), 'ознаки зневоднення — за МОЗ');
  // Пляшки питного запасу не заморожуємо (ЦГЗ), а для холоду в морозилці — окремі (узгоджено з «Їжею»)
  assert.ok(byId('wt-cool')?.how.some((s) => /не заморожуйте.*окремі/.test(s)));
});

test('2.11.0: числа — ті, що в джерелах', () => {
  assert.match(byId('wa-3l')?.t || '', /72 години.*3 л/);
  assert.match(byId('wa-3l')?.d || '', /3 л.*2–4 л/);
  assert.match(byId('wa-3l')?.why || '', /27 л/);
  assert.match(byId('wa-3l')?.fact || '', /2,5–3 л.*7,5–15 л/);
  assert.match(byId('wa-thirst')?.d || '', /4 %/);
  assert.match(byId('wa-thirst')?.why || '', /2,8–3 л.*70–75 кг/);
  assert.match(byId('wa-thirst')?.fact || '', /«хочете пити — пийте»/);
  assert.match(byId('wa-noration')?.fact || '', /подвоїтися/);
  assert.match(byId('wa-dehyd')?.why || '', /менше ніж 4 рази/);
  assert.match(byId('wa-pets')?.fact || '', /1 до 4 л/);
  assert.match(byId('wt-food')?.d || '', /HDPE №2.*PP №5/);
  assert.match(byId('wt-food')?.why || '', /20 л.*8 см/);
  assert.match(byId('wt-cool')?.fact || '', /від 10 до 21 °C/);
  assert.match(byId('wt-rotate')?.d || '', /6 місяців/);
  assert.match(byId('wt-rotate')?.fact || '', /14 галонів.*53 л/);
  assert.match(byId('wt-shelter')?.t || '', /1–2 дні/);
  assert.match(byId('wt-shelter')?.fact || '', /2,5–3 л.*2–4 л/);
  assert.match(byId('wv-upper')?.fact || '', /від пів доби до доби/);
  assert.match(byId('wv-info')?.fact || '', /«Якщо не буде в місті електрики, води не буде».*Горкуценко/);
  assert.match(byId('wv-carry')?.fact || '', /1 г на мілілітр.*20 кг/);
  assert.match(byId('ws-official')?.fact || '', /500 м.*30 хвилин/);
  assert.match(byId('ws-buvet')?.d || '', /105 бюветів/);
  assert.match(byId('ws-buvet')?.why || '', /одну-дві хвилини.*трьох днів/);
  assert.match(byId('ws-buvet')?.fact || '', /від 90 до 340 м/);
  assert.match(byId('wb-1min')?.d || '', /1 хвилини.*10 хвилин/);
  assert.match(byId('wb-1min')?.fact || '', /2000 м.*3 хвилини/);
  assert.match(byId('wb-10min')?.t || '', /10 хвилин/);
  assert.match(byId('wd-tabs')?.d || '', /1 або на 10 л/);
  assert.match(byId('wd-tabs')?.why || '', /30 хвилин.*години/);
  assert.match(byId('wd-bleach')?.t || '', /5–9 %.*2 краплі.*30 хвилин/);
  assert.match(byId('wd-bleach')?.d || '', /4 краплі/);
  assert.match(byId('wd-bleach')?.why || '', /15 хвилин/);
  assert.match(byId('wd-bleach')?.fact || '', /1 %.*10 крапель/);
  assert.match(byId('wd-filter')?.why || '', /1 мкм/);
  assert.match(byId('wd-filter')?.fact || '', /0,3 мкм/);
  assert.match(byId('wg-bath')?.fact || '', /400 дітей/);
  assert.match(byId('wg-bucket')?.fact || '', /19 л.*36 см/);
  assert.match(byId('wg-flush')?.d || '', /4–8 л/);
  assert.match(byId('wg-bags')?.fact || '', /19 л/);
  assert.match(byId('wg-reuse')?.fact || '', /80–100 галонів.*300–380 л/);
  assert.match(byId('wg-tap')?.d || '', /20 л.*200 л/);
  assert.match(byId('wg-tap')?.fact || '', /6–10 л/);
  assert.match(byId('wg-shower')?.t || '', /100 л/);
  assert.match(byId('wg-shower')?.d || '', /2–3 хвилини.*20–30 л/);
  assert.match(byId('wr-flush')?.d || '', /5 хвилин/);
  assert.match(byId('wr-signs')?.t || '', /1551/);
  assert.match(byId('wr-slow')?.fact || '', /300 тис.*1 МВт/);
  assert.match(byId('wp-drip')?.fact || '', /9 %/);
  assert.match(byId('wp-thaw')?.fact || '', /55 °F.*13 °C/);
  assert.match(byId('wp-drain')?.why || '', /0 °C/);
  assert.match(byId('wp-drain')?.fact || '', /15 мм.*\+10 °C.*−15 °C.*9 хвилин.*−1 °C.*43 хвилини/);
});

test('2.11.0: «див. пораду N» ведуть туди, куди задумано', () => {
  const want = { 1: 'wa-3l', 4: 'wa-raw', 18: 'wv-valve', 21: 'wh-pipes', 32: 'wb-1min', 33: 'wb-10min', 34: 'wb-cloudy', 36: 'wb-chem', 48: 'wg-bags', 53: 'wr-flush' };
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

test('2.11.0: пошук порад — зокрема за «Цікаво знати» й джерелом — і перехід із пошуку бібліотеки', async () => {
  const { searchTips } = await import('./tipsui.js');
  assert.equal(searchTips('', T).length, 63);
  assert.ok(searchTips('бойлер', T).some((t) => t.id === 'wh-boiler'));
  assert.ok(searchTips('БЮВЕТ', T).some((t) => t.id === 'ws-buvet'), 'регістр не важить');
  assert.ok(searchTips('сеноманського', T).some((t) => t.id === 'ws-buvet'), 'слово лише з «Цікаво знати»');
  assert.ok(searchTips('Горкуценко', T).some((t) => t.id === 'wv-info'));
  assert.ok(searchTips("кип'ятіть", T).length > 0, 'прямий апостроф знаходить ’');
  assert.ok(searchTips('ЮНІСЕФ', T).some((t) => t.id === 'wa-3l'), 'пошук за джерелом');
  assert.ok(searchTips('криптоспоридій', T).some((t) => t.id === 'wd-bleach'), 'слово із застереження');
  assert.ok(searchTips('відро', T).some((t) => t.id === 'wg-bucket'));
  assert.deepEqual(searchTips('такого-слова-немає', T), []);
  for (const q of ['вода', 'бювет', 'бойлер', "кип'ятіння", 'знезараження', 'колодязь', 'зневоднення', 'водоканал']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/tips/water'), q);
  }
  const sec = SECTIONS.find((s) => s.href === '#/tips/water');
  assert.ok(sec?.title.includes(`${T.length} перевірені поради`), 'кількість у бібліотеці збігається');
  // Добірка «Їжа» з пошуку бібліотеки не зникла
  assert.ok(sectionsFor('холодильник').some((s) => s.href === '#/tips/food'));
});

test('2.11.0: екран добірки — заголовок із правильною множиною, чипи, головні, «Цікаво знати» й переходи', async () => {
  const { tipsScreens } = await import('./tipsui.js');
  const v = tipsScreens.water(new URLSearchParams());
  assert.equal(v.title, 'Вода без водогону: 63 поради');
  assert.equal(v.tab, 'home');
  assert.ok(v.html.includes('href="#/need/water"'), 'назад — на екран «Потрібна вода»');
  assert.equal((v.html.match(/class="chip"/g) || []).length, 12, 'чипи: головні, усі й 10 груп');
  assert.equal((v.html.match(/<li class="tip/g) || []).length, 63);
  assert.equal((v.html.match(/<aside class="tip-fact">/g) || []).length, T.filter((t) => t.fact).length);
  assert.ok(v.html.includes('«Цікаво знати»'), 'підказка згадує блок');
  assert.ok(!v.html.includes('data-act="tool"'), 'інструментів тут немає');
  for (const href of new Set(T.map((t) => t.go).filter(Boolean))) assert.ok(v.html.includes(`href="${href}"`), href);
  for (const id of ['water-boil', 'water-chlorine', 'myth-boil-chem', 'water-hidden']) assert.ok(v.html.includes(`href="#/s/${id}"`), id);
  const top = tipsScreens.water(new URLSearchParams('g=top'));
  assert.equal((top.html.match(/<li class="tip top"/g) || []).length, 10);
  assert.equal((top.html.match(/<details class="tip-x" open>/g) || []).length, 10, 'головні — розгорнуті');
  const boil = tipsScreens.water(new URLSearchParams('g=boil'));
  assert.equal((boil.html.match(/<li class="tip/g) || []).length, 7);
  const odd = tipsScreens.water(new URLSearchParams('g=stove'));
  assert.equal((odd.html.match(/<li class="tip/g) || []).length, 63, 'група з іншої добірки — показуємо все');
  // Множина в заголовках інших добірок не змінилася
  assert.equal(tipsScreens.food(new URLSearchParams()).title, 'Їжа без світла: 66 порад');
  assert.equal(tipsScreens.heat(new URLSearchParams()).title, 'Як зігрітися: 100 порад');
  // Офлайн: модуль у кеші Service Worker, версія 2.11.0
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("'./tips-water.js'"), 'tips-water.js у CORE');
  assert.match(sw, /const VERSION = 'avtonomno-v2\.11\.0'/);
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '2.11.0');
});
