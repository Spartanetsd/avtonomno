// @ts-check
// «72 години» — офлайн-симулятор перших трьох діб без світла, води чи опалення.
// Точні розрахунки лише з введених даних: вода (запас, добова потреба, залишок, дефіцит),
// енергія (Вт·год, фактичний заряд, ККД, навантаження у Вт, час), сумісність (вихід джерела
// й споживання приладу), безпека продуктів без холодильника — за CDC, Ready.gov і USDA.
// Чого не знаємо — не вигадуємо: просимо дані замість обіцянок.

import { num, fmt, fmtHours, daysText, WATER_PRESETS, PET_L_PER_KG } from './calc.js';

/** Етапи часової шкали, години. */
export const STAGES = [0.25, 1, 6, 12, 24, 48, 72];
export const STAGE_LABEL = ['15 хв', '1 год', '6 год', '12 год', '24 год', '48 год', '72 год'];

/** Сценарії: що зникло. */
export const SCENARIOS = {
  power: { label: 'Без електрики', power: false, water: true, heat: true },
  water: { label: 'Без води', power: true, water: false, heat: true },
  heat: { label: 'Без опалення', power: true, water: true, heat: false },
  all: { label: 'Повне відключення', power: false, water: false, heat: false },
};
/** @typedef {keyof typeof SCENARIOS} Scen */

/**
 * Типи джерел енергії. Напругу й ККД можна змінити: тут — загальноприйняті номінали.
 * Павербанк: ємність у мА·год указують за напругою елементів ≈3,7 В; до приладу доходить ≈70 %.
 * Станція: через інвертор 230 В — ≈85 %. LiFePO4 12 В: номінал 12,8 В, ≈90 %.
 * Стартерний акумулятор авто: не більше 30 %, щоб авто завелося.
 */
export const SOURCE_KINDS = {
  powerbank: { label: 'Павербанк', unit: 'mAh', v: '3.7', k: '0.7' },
  station: { label: 'Зарядна станція', unit: 'Wh', v: '', k: '0.85' },
  lfp: { label: 'Акумулятор LiFePO4 12 В', unit: 'Ah', v: '12.8', k: '0.9' },
  car: { label: 'Стартерний акумулятор авто', unit: 'Ah', v: '12', k: '0.3' },
};
export const UNIT_LABEL = { mAh: 'мА·год', Ah: 'А·год', Wh: 'Вт·год' };

/** Обмеження довжини й кількості — щоб файл імпорту не роздув сховище. */
const MAX_SOURCES = 6, MAX_DEVICES = 16;

/**
 * @typedef {{kind:keyof typeof SOURCE_KINDS, name:string, cap:string, unit:'mAh'|'Ah'|'Wh', v:string, pct:string, k:string, outW:string}} SimSource
 * @typedef {{name:string, w:string, h:string, crit:boolean, src:number}} SimDevice
 * @typedef {{
 *   scen:Scen, stage:number, startAt:number|null,
 *   adults:string, kids:string, elderly:string, infant:boolean, petKg:string,
 *   drink:string, tech:string, norm:'min'|'basic'|'std', hot:boolean,
 *   fridge:boolean, icebox:'full'|'half'|'none', cooler:boolean, meds:boolean,
 *   roomC:string,
 *   sources:SimSource[], devices:SimDevice[]
 * }} SimState
 */

/** @returns {SimState} */
export function simDefaults() {
  return {
    scen: 'all', stage: 0, startAt: null,
    adults: '1', kids: '0', elderly: '0', infant: false, petKg: '0',
    drink: '', tech: '', norm: 'min', hot: false,
    fridge: true, icebox: 'half', cooler: false, meds: false,
    roomC: '',
    sources: [], devices: [],
  };
}

/** @param {unknown} v @param {number} max */
const s12 = (v, max = 12) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');

/**
 * Перевіряє збережений чи імпортований стан: невідоме відкидає, решту обрізає.
 * @param {any} raw
 * @returns {SimState}
 */
export function cleanSim(raw) {
  const d = simDefaults();
  if (!raw || typeof raw !== 'object') return d;
  d.scen = typeof raw.scen === 'string' && raw.scen in SCENARIOS ? /** @type {Scen} */ (raw.scen) : 'all';
  d.stage = Number.isInteger(raw.stage) && raw.stage >= 0 && raw.stage < STAGES.length ? raw.stage : 0;
  const t = Number(raw.startAt);
  d.startAt = raw.startAt != null && Number.isFinite(t) && t > 946684800000 && t < 7258118400000 ? Math.round(t) : null;
  for (const k of /** @type {const} */ (['adults', 'kids', 'elderly', 'petKg', 'drink', 'tech', 'roomC'])) if (raw[k] != null) d[k] = s12(raw[k]);
  d.infant = raw.infant === true;
  d.norm = raw.norm === 'basic' || raw.norm === 'std' ? raw.norm : 'min';
  d.hot = raw.hot === true;
  d.fridge = raw.fridge !== false;
  d.icebox = raw.icebox === 'full' || raw.icebox === 'none' ? raw.icebox : 'half';
  d.cooler = raw.cooler === true;
  d.meds = raw.meds === true;
  if (Array.isArray(raw.sources)) {
    d.sources = raw.sources.filter((x) => x && typeof x === 'object').slice(0, MAX_SOURCES).map((x) => {
      const kind = typeof x.kind === 'string' && x.kind in SOURCE_KINDS ? /** @type {keyof typeof SOURCE_KINDS} */ (x.kind) : 'station';
      const unit = x.unit === 'mAh' || x.unit === 'Ah' || x.unit === 'Wh' ? x.unit : SOURCE_KINDS[kind].unit;
      return { kind, name: s12(x.name, 40) || SOURCE_KINDS[kind].label, cap: s12(x.cap), unit: /** @type {'mAh'|'Ah'|'Wh'} */ (unit), v: s12(x.v), pct: s12(x.pct), k: s12(x.k), outW: s12(x.outW) };
    });
  }
  if (Array.isArray(raw.devices)) {
    d.devices = raw.devices.filter((x) => x && typeof x === 'object').slice(0, MAX_DEVICES).map((x) => {
      const src = Number(x.src);
      return { name: s12(x.name, 40) || 'Пристрій', w: s12(x.w), h: s12(x.h), crit: x.crit === true, src: Number.isInteger(src) && src >= -1 && src < d.sources.length ? src : -1 };
    });
  }
  return d;
}

/** Нове джерело з типовими для виду одиницями. @param {keyof typeof SOURCE_KINDS} kind @returns {SimSource} */
export function newSource(kind) {
  const k = SOURCE_KINDS[kind];
  return { kind, name: k.label, cap: '', unit: /** @type {'mAh'|'Ah'|'Wh'} */ (k.unit), v: k.v, pct: '', k: k.k, outW: '' };
}

/* ───────────── Розрахунки ───────────── */

/** Порожнє — null, нечисло — NaN. @param {string} v */
const opt = (v) => (v == null || String(v).trim() === '' ? null : num(v));

/**
 * Вода: добова потреба, залишок, дефіцит.
 * @param {SimState} s
 */
export function waterCalc(s) {
  /** @type {string[]} */ const errors = [];
  const cnt = (/** @type {string} */ v, /** @type {string} */ label) => {
    const n = opt(v);
    if (n == null) return 0;
    if (Number.isNaN(n) || n < 0 || n > 50 || !Number.isInteger(n)) { errors.push(`${label}: ціле число від 0 до 50.`); return 0; }
    return n;
  };
  const people = cnt(s.adults, 'Дорослі') + cnt(s.kids, 'Діти') + cnt(s.elderly, 'Літні люди');
  const petKgRaw = opt(s.petKg);
  const petKg = petKgRaw == null ? 0 : petKgRaw;
  if (Number.isNaN(petKg) || petKg < 0 || petKg > 500) errors.push('Маса тварин: від 0 до 500 кг.');
  if (people === 0 && !(petKg > 0)) errors.push('Додайте хоча б одну людину чи тварину.');
  const drink = opt(s.drink), tech = opt(s.tech);
  if (drink != null && (Number.isNaN(drink) || drink < 0 || drink > 100000)) errors.push('Питна вода: число від 0 л.');
  if (tech != null && (Number.isNaN(tech) || tech < 0 || tech > 100000)) errors.push('Технічна вода: число від 0 л.');
  const preset = WATER_PRESETS.find((p) => p.id === s.norm) || WATER_PRESETS[0];
  if (errors.length) return { ok: false, errors };
  const heat = s.hot ? 2 : 1;
  const petDay = (Number.isNaN(petKg) ? 0 : petKg) * PET_L_PER_KG * (s.hot ? 1.5 : 1);
  const drinkDay = people * preset.drink * heat + petDay;
  const techDay = people * (preset.cook + preset.hygiene);
  const drinkHours = drink == null ? null : drinkDay > 0 ? (drink / drinkDay) * 24 : Infinity;
  const techHours = tech == null ? null : techDay > 0 ? (tech / techDay) * 24 : Infinity;
  const need72 = drinkDay * 3;
  const deficit72 = drink == null ? null : Math.max(0, need72 - drink);
  const steps = [
    `Пиття на добу: ${people} × ${fmt(preset.drink)} л${s.hot ? ' × 2 (спека)' : ''}${petDay > 0 ? ` + тварини ${fmt(petDay)} л` : ''} = ${fmt(drinkDay)} л`,
    `Технічна на добу (їжа й гігієна, норма «${preset.label.toLowerCase()}»): ${people} × ${fmt(preset.cook + preset.hygiene)} л = ${fmt(techDay)} л`,
    `На 72 години лише пиття: ${fmt(drinkDay)} × 3 = ${fmt(need72)} л`,
  ];
  if (drink != null) steps.push(`Питної вистачить на: ${fmt(drink)} л ÷ ${fmt(drinkDay)} л/добу = ${drinkHours === Infinity ? '∞' : daysText((drinkHours || 0) / 24)}`);
  if (deficit72 != null) steps.push(deficit72 > 0 ? `Прогноз дефіциту за 72 год: ${fmt(need72)} − ${fmt(drink || 0)} = ${fmt(deficit72)} л` : 'Дефіциту питної води за 72 год немає');
  return { ok: true, people, petDay, preset, drinkDay, techDay, drink, tech, drinkHours, techHours, need72, deficit72, steps };
}

/**
 * Енергія одного джерела. Без ємності чи фактичного заряду час роботи не рахуємо.
 * @param {SimSource} src @param {SimDevice[]} devices пристрої цього джерела
 */
export function sourceCalc(src, devices) {
  /** @type {string[]} */ const errors = [];
  /** @type {string[]} */ const need = [];
  const cap = opt(src.cap), pct = opt(src.pct), k = opt(src.k), v = opt(src.v), outW = opt(src.outW);
  if (cap == null) need.push(src.pct ? 'ємність — самий відсоток заряду не каже, скільки енергії' : 'ємність');
  else if (Number.isNaN(cap) || cap <= 0 || cap > 1e7) errors.push('Ємність має бути більшою за 0.');
  if (src.unit !== 'Wh') {
    if (v == null) need.push('напругу');
    else if (Number.isNaN(v) || v <= 0 || v > 1000) errors.push('Напруга — від 0 до 1000 В.');
  }
  if (pct == null) need.push('фактичний заряд, %');
  else if (Number.isNaN(pct) || pct < 0 || pct > 100) errors.push('Заряд — від 0 до 100 %.');
  let kk = k == null ? Number(SOURCE_KINDS[src.kind]?.k || 0.85) : k;
  if (k != null && !Number.isNaN(k) && k > 1 && k <= 100) kk = k / 100;
  if (Number.isNaN(kk) || kk < 0.05 || kk > 1) errors.push('ККД — від 0,05 до 1 (або від 5 до 100 %).');
  if (outW != null && (Number.isNaN(outW) || outW <= 0 || outW > 100000)) errors.push('Потужність виходу — число більше за 0 Вт.');

  // Пристрої: навантаження у Вт і добове споживання у Вт·год
  /** @type {{level:'danger'|'caution'|'info', text:string}[]} */ const compat = [];
  let loadW = 0, dailyWh = 0;
  const unknownW = [], unknownH = [];
  for (const d of devices) {
    const w = opt(d.w), h = opt(d.h);
    if (w == null || Number.isNaN(w) || w <= 0) { unknownW.push(d.name); continue; }
    if (h == null || Number.isNaN(h) || h < 0 || h > 24) unknownH.push(d.name);
    const hh = h == null || Number.isNaN(h) ? 0 : Math.min(24, Math.max(0, h));
    loadW += w;
    dailyWh += w * hh;
    if (outW != null && !Number.isNaN(outW) && outW > 0) {
      if (w > outW) compat.push({ level: 'danger', text: `«${d.name}» ${fmt(w)} Вт більше за вихід «${src.name}» ${fmt(outW)} Вт: прилад не запуститься або спрацює захист.` });
      else if (w > 0.8 * outW) compat.push({ level: 'caution', text: `«${d.name}» бере понад 80 % виходу «${src.name}»: можливі нагрів і спрацювання захисту, особливо на пуску.` });
    }
  }
  if (outW != null && !Number.isNaN(outW) && outW > 0 && devices.length > 1 && loadW > outW && !compat.some((c) => c.level === 'danger')) compat.push({ level: 'caution', text: `Разом прилади на «${src.name}» беруть ${fmt(loadW)} Вт — більше за вихід ${fmt(outW)} Вт: вмикайте їх по черзі.` });
  if (outW == null && devices.length) compat.push({ level: 'info', text: `Перевірте на корпусі «${src.name}» максимальну потужність виходу (Вт) — без неї сумісність не перевірити.` });
  if (unknownW.length) need.push(`потужність: ${unknownW.join(', ')}`);
  if (unknownH.length) need.push(`години роботи на добу: ${unknownH.join(', ')}`);

  if (errors.length || cap == null || pct == null || (src.unit !== 'Wh' && v == null)) {
    return { ok: false, errors, need, compat, loadW, dailyWh, outW };
  }
  const nominalWh = src.unit === 'Wh' ? /** @type {number} */ (cap) : src.unit === 'Ah' ? /** @type {number} */ (cap) * /** @type {number} */ (v) : (/** @type {number} */ (cap) * /** @type {number} */ (v)) / 1000;
  const actualWh = nominalWh * (/** @type {number} */ (pct) / 100);
  const usableWh = actualWh * kk;
  const runH = dailyWh > 0 && !unknownW.length && !unknownH.length ? (usableWh / dailyWh) * 24 : null;
  const steps = [
    src.unit === 'Wh' ? `Номінал: ${fmt(nominalWh)} Вт·год` : `Номінал: ${fmt(/** @type {number} */ (cap))} ${UNIT_LABEL[src.unit]} × ${fmt(/** @type {number} */ (v))} В${src.unit === 'mAh' ? ' ÷ 1000' : ''} = ${fmt(nominalWh)} Вт·год`,
    `Фактично зараз: ${fmt(nominalWh)} × ${fmt(/** @type {number} */ (pct))} % = ${fmt(actualWh)} Вт·год`,
    `Доступно з ККД ${fmt(kk)}: ${fmt(actualWh)} × ${fmt(kk)} = ${fmt(usableWh)} Вт·год`,
  ];
  if (dailyWh > 0) steps.push(`Споживання: ${devices.filter((d) => opt(d.w) > 0).map((d) => `${fmt(Number(opt(d.w)))} Вт × ${fmt(Math.min(24, Math.max(0, Number(opt(d.h)) || 0)))} год`).join(' + ')} = ${fmt(dailyWh)} Вт·год на добу`);
  if (runH != null) steps.push(`Вистачить на: ${fmt(usableWh)} ÷ ${fmt(dailyWh)} × 24 = ${fmtHours(runH)}`);
  return { ok: true, errors, need, compat, loadW, dailyWh, outW, nominalWh, actualWh, usableWh, k: kk, runH, steps };
}

/**
 * Повна модель: вода, енергія, продукти, температура й етапи з діями й ризиками.
 * @param {SimState} s
 */
export function simulate(s) {
  const sc = SCENARIOS[s.scen] || SCENARIOS.all;
  const water = waterCalc(s);
  const sources = s.sources.map((src, i) => ({ src, i, calc: sourceCalc(src, s.devices.filter((d) => d.src === i)) }));
  const loose = s.devices.filter((d) => d.src < 0 || d.src >= s.sources.length);
  const roomRaw = opt(s.roomC);
  const roomC = roomRaw == null || Number.isNaN(roomRaw) || roomRaw < -40 || roomRaw > 60 ? null : roomRaw;
  /** @type {string[]} */ const errors = [];
  if (roomRaw != null && roomC == null) errors.push('Температура в кімнаті: число від −40 до +60 °C.');
  if (!water.ok) errors.push(...(water.errors || []));
  for (const x of sources) errors.push(...x.calc.errors.map((e) => `${x.src.name}: ${e}`));
  const vulnerable = (opt(s.kids) || 0) > 0 || (opt(s.elderly) || 0) > 0 || s.infant;
  const stages = STAGES.map((t, i) => stageAt(i, t, { s, sc, water, sources, loose, roomC, vulnerable }));
  return { ok: errors.length === 0, errors, scen: sc, water, sources, loose, roomC, vulnerable, stages };
}

/**
 * @typedef {{text:string, src:string[], pri:number, level?:'danger'|'caution'|'info'}} Item
 */

/**
 * Дії й ризики етапу: щонайбільше по три найважливіші.
 * @param {number} i @param {number} t год
 * @param {any} m
 */
function stageAt(i, t, m) {
  const { s, sc, water, sources, loose, roomC, vulnerable } = m;
  /** @type {Item[]} */ const acts = [];
  /** @type {Item[]} */ const risks = [];
  const act = (/** @type {number} */ pri, /** @type {string} */ text, /** @type {string[]} */ src) => acts.push({ pri, text, src });
  const risk = (/** @type {number} */ pri, /** @type {'danger'|'caution'|'info'} */ level, /** @type {string} */ text, /** @type {string[]} */ src) => risks.push({ pri, level, text, src });
  const prev = i > 0 ? STAGES[i - 1] : 0;
  const crossed = (/** @type {number} */ h) => h > prev && h <= t;

  /* — Електрика — */
  if (!sc.power) {
    if (i === 0) {
      act(90, 'Увімкніть ліхтар чи LED-лампу. Свічки — лише крайній засіб і ніколи без нагляду.', ['cdcStorm', 'nfpaCandle']);
      act(70, 'Вимкніть із розеток техніку: коли світло повернеться, можливі стрибки напруги.', ['readyOutage']);
      if (s.fridge || s.icebox !== 'none') act(86, 'Не відчиняйте холодильник і морозильник без потреби.', ['readyOutage', 'cdcFood']);
      risk(78, 'danger', 'Генератор — лише надворі, щонайменше за 6 м від вікон і дверей; ніколи в квартирі, на балконі чи в під’їзді.', ['readyOutage', 'mohGen']);
    }
    if (i === 1) {
      act(76, 'Телефони — в режим енергозбереження; один лишіть на зв’язку.', ['cdcOutage']);
      if (s.fridge && s.cooler) act(82, 'Якщо світла не буде понад 4 години — перекладіть швидкопсувне в термосумку з льодом.', ['cdcFood']);
    }
    if (i === 3) act(55, 'Заряджайтеся в пункті незламності, коли вихід безпечний.', ['punkty']);
    // Продукти: холодильник ≈4 год, морозильник повний ≈48 год, наполовину ≈24 год
    if (s.fridge && crossed(4)) {
      if (s.cooler) act(84, 'Швидкопсувне тримайте в термосумці з льодом; перевіряйте термометром: не тепліше 4 °C.', ['readyOutage', 'cdcFood']);
      else risk(92, 'danger', 'Понад 4 години без холоду: м’ясо, рибу, яйця, молоко й залишки страв із холодильника викиньте. Не куштуйте, щоб перевірити.', ['cdcFood', 'readyOutage']);
    }
    if (s.icebox === 'half' && t === 24) risk(88, 'caution', 'Наполовину заповнений морозильник тримає холод ≈24 години. Продукти з кристалами льоду чи не тепліші за 4 °C можна готувати або заморозити знову.', ['readyOutage', 'cdcFood']);
    if (s.icebox === 'full' && t === 48) risk(88, 'caution', 'Повний морозильник тримає холод ≈48 годин. Перевірте продукти: з кристалами льоду чи не тепліші за 4 °C — можна, решту — викиньте.', ['readyOutage', 'cdcFood']);
    if (s.meds && t === 24) risk(93, 'danger', 'Ліки, що потребують холоду: понад добу без світла — замініть їх, якщо в інструкції не сказано інше; порадьтеся з фармацевтом.', ['readyOutage']);
    if (t >= 6 && t <= 24) risk(40, 'info', 'Не виносьте продукти на балкон чи в сніг: сонце розморожує, а температура коливається.', ['usdaSnow']);
    // Пристрої без живлення
    for (const d of loose) {
      if (d.crit && i <= 1) risk(97, 'danger', `Критичний пристрій «${d.name}» не підключено до джерела — без світла він не працює. Плануйте живлення чи переїзд туди, де є електрика.`, ['readyOutage']);
    }
    // Джерела: коли закінчиться заряд
    for (const x of sources) {
      const c = x.calc;
      if (!c.ok) { if (i === 1) risk(60, 'info', `«${x.src.name}»: не можу порахувати, на скільки вистачить — вкажіть ${c.need.join(', ')}.`, []); continue; }
      if (i === 1 && c.runH != null) act(74, `«${x.src.name}»: ≈${fmt(c.usableWh)} Вт·год — вистачить на ${fmtHours(c.runH)} для вибраних приладів.`, []);
      if (i === 1 && c.runH == null && !c.need.length) act(50, `«${x.src.name}»: ≈${fmt(c.usableWh)} Вт·год. Додайте прилади з потужністю й годинами — порахую час.`, []);
      if (c.runH != null && c.runH <= t && c.runH > prev) {
        const crit = s.devices.some((d) => d.src === x.i && d.crit);
        risk(crit ? 96 : 80, crit ? 'danger' : 'caution', `«${x.src.name}» розрядиться приблизно через ${fmtHours(c.runH)}${crit ? ' — разом із критичним пристроєм' : ''}. Залиште заряд на найважливіше.`, []);
      }
    }
  }
  // Сумісність — одразу, коли все вмикають від джерел
  if (i === 0 && !sc.power) for (const x of sources) for (const c of x.calc.compat) if (c.level !== 'info') risk(c.level === 'danger' ? 99 : 70, c.level, c.text, []);

  /* — Вода — */
  if (!sc.water && water.ok) {
    if (i === 0) {
      act(88, water.drink != null ? `Розділіть воду: ${fmt(water.drink)} л питної — лише на пиття.` : 'Розділіть воду: питна — лише на пиття. Вкажіть запас — порахую, на скільки вистачить.', ['cdcWaterSupply']);
      act(58, 'Воду невідомого походження не пийте без знезараження.', ['cdcWater']);
    }
    if (i === 1) act(80, `Потреба лише на пиття — ${fmt(water.drinkDay)} л на добу${water.drinkHours != null ? `; запасу вистачить на ${water.drinkHours === Infinity ? '∞' : daysText(water.drinkHours / 24, true)}` : ''}.`, ['sphere', 'readyWater']);
    if (water.drinkHours != null && water.drinkHours <= t && water.drinkHours > prev) risk(98, 'danger', `Питна вода закінчиться приблизно через ${fmtHours(water.drinkHours)}. Шукайте бутильовану воду чи пункт видачі, коли вихід безпечний.`, ['readyWater']);
    if (water.drinkHours != null && water.drinkHours < t && i > 0 && !(water.drinkHours > prev)) risk(90, 'danger', `Питної води вже немає — дефіцит ${fmt(water.drinkDay * (t - water.drinkHours) / 24)} л на цей час.`, ['readyWater']);
    if (water.techHours != null && water.techHours <= t && water.techHours > prev) risk(76, 'caution', `Технічна вода закінчиться через ${fmtHours(water.techHours)}: питну на змив не витрачайте — туалет у подвійних пакетах.`, ['toiletKC']);
    if (i === 3) act(62, 'Воду після миття рук і посуду збирайте для змиву.', ['readyWater']);
    if (t === 24 && water.drink != null) act(78, `За добу на пиття піде ${fmt(water.drinkDay)} л; лишиться ≈${fmt(Math.max(0, water.drink - water.drinkDay))} л.`, ['sphere']);
    if (t === 72 && water.deficit72 != null && water.deficit72 > 0) act(85, `Поповніть питну воду: на 72 години бракує ${fmt(water.deficit72)} л.`, ['readyWater']);
  }
  if (sc.water && i === 0 && water.ok && water.drink != null) act(30, `Вода з крана є. Якщо зникне, ${fmt(water.drink)} л питного запасу вистачить на ${water.drinkHours === Infinity ? '∞' : daysText((water.drinkHours || 0) / 24, true)}.`, ['readyWater']);

  /* — Тепло — */
  if (!sc.heat) {
    if (i === 0) {
      act(87, 'Зберіться в одній кімнаті й зачиніть двері в інші.', ['cdcStorm', 'readyWinter']);
      act(80, 'Вдягніться шарами: шапка, теплі шкарпетки, светр.', ['cdcStorm']);
      risk(95, 'danger', 'Не обігрівайтеся газовою плитою, мангалом, генератором чи саморобним обігрівачем — чадний газ і пожежа.', ['cdcCO', 'readyOutage']);
    }
    if (i === 1) act(68, 'Покладіть рушник під двері; вентиляцію не закривайте.', ['readyWinter']);
    if (i === 2) act(72, 'Підготуйте тепле ліжко: навіс з ковдр зі щілиною для повітря, спальник, грілка з гарячою (не окропом) водою.', ['cdcStorm', 'hotBottle']);
    if (i === 3 && s.infant) risk(94, 'danger', 'Немовля не повинне спати в холодній кімнаті; у ліжечку — без подушок і ковдр, у теплому комбінезоні.', ['cdcStorm']);
    if (i === 3) act(50, 'Перевірте літніх сусідів і родичів.', ['cdcStorm']);
    if (sc.power && i === 1) act(74, 'Світло є: сертифікований електрообігрівач — напряму в розетку, щонайменше за 1 м від штор, меблів і постелі; без нагляду не залишайте.', ['cdcStorm']);
    // Станція не замінює опалення: показуємо розрахунком, не обіцянкою
    const st = sources.find((/** @type {any} */ x) => x.src.kind === 'station' && x.calc.ok);
    if (!sc.power && i === 1 && st) risk(52, 'info', `Станція не замінить опалення: обігрівач на 1 000 Вт спорожнив би її ≈${fmt(st.calc.usableWh)} Вт·год за ${fmtHours(st.calc.usableWh / 1000)}. Тепло — утепленням, одягом, електроковдрою, якщо вона є.`, ['cdcStorm']);
    if (roomC != null) {
      if (roomC <= 12 && (i === 1 || t === 24)) risk(95, 'danger', `У кімнаті ${roomC > 0 ? '+' : ''}${fmt(roomC)} °C — це небезпечно холодно. Плануйте перехід у тепле місце чи пункт незламності, щойно це безпечно.`, ['phe', 'punkty']);
      else if (roomC < 16 && vulnerable && (i === 1 || t === 24)) risk(84, 'caution', `${fmt(roomC)} °C — замало для дітей, літніх і хворих: тримайте їх у найтеплішій кімнаті й стежте за самопочуттям.`, ['phe', 'cdcWinter']);
      else if (roomC < 18 && i === 4) risk(60, 'info', `${fmt(roomC)} °C: стежте за ознаками переохолодження — тремтіння, сонливість, сплутаність.`, ['cdcWinter']);
    } else if (i === 1) {
      act(48, 'Поставте термометр у кімнаті: від температури залежить, чи пора переходити в тепле місце.', ['phe']);
    }
    if (t === 48) act(66, 'Якщо в житлі +12 °C і нижче й тепліше не стає — переходьте в тепле місце, коли це безпечно.', ['phe', 'punkty']);
  }

  /* — Підсумок 72 год — */
  if (t === 72) act(60, 'Ситуація триває — поповніть запаси й заряд, коли вихід безпечний; пункти незламності — для тепла, води й заряджання.', ['punkty']);

  acts.sort((a, b) => b.pri - a.pri);
  risks.sort((a, b) => b.pri - a.pri);
  return { t, label: STAGE_LABEL[i], actions: dedupe(acts).slice(0, 3), risks: dedupe(risks).slice(0, 3) };
}

/** @param {Item[]} a */
function dedupe(a) {
  const seen = new Set();
  return a.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
}

/** Стан ресурсів на момент t годин — для «що лишилося». @param {ReturnType<typeof simulate>} m @param {number} t */
export function remainingAt(m, t) {
  const out = { drink: /** @type {number|null} */ (null), tech: /** @type {number|null} */ (null), sources: /** @type {{name:string, wh:number|null, pct:number|null}[]} */ ([]) };
  if (m.water.ok && !m.scen.water) {
    const w = /** @type {any} */ (m.water);
    if (w.drink != null) out.drink = Math.max(0, w.drink - (w.drinkDay * t) / 24);
    if (w.tech != null) out.tech = Math.max(0, w.tech - (w.techDay * t) / 24);
  }
  for (const x of m.sources) {
    const c = /** @type {any} */ (x.calc);
    if (!c.ok || m.scen.power) { out.sources.push({ name: x.src.name, wh: c.ok ? c.usableWh : null, pct: null }); continue; }
    const left = Math.max(0, c.usableWh - (c.dailyWh * t) / 24);
    out.sources.push({ name: x.src.name, wh: left, pct: c.usableWh > 0 ? (left / c.usableWh) * 100 : null });
  }
  return out;
}

/** Етап, у якому людина зараз: останній, чий час уже настав. @param {number} hours */
export function stageForElapsed(hours) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (hours >= STAGES[i]) idx = i;
  return idx;
}

/* ───────────── Експорт / імпорт ───────────── */

/** @param {SimState} s */
export function exportSim(s) {
  return { app: 'avtonomno', kind: 'sim72', format: 1, exported: new Date().toISOString(), sim: cleanSim(s) };
}

/**
 * Розбирає файл симуляції. Приймає також повну копію даних застосунку з полем sim.
 * @param {string} text
 * @returns {{ok:true, sim:SimState} | {ok:false, error:string}}
 */
export function importSim(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'Файл не є коректним JSON.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Неочікуваний формат файлу.' };
  if (raw.app && raw.app !== 'avtonomno') return { ok: false, error: 'Це файл іншого застосунку.' };
  const body = raw.sim;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'У файлі немає даних симуляції (sim).' };
  return { ok: true, sim: cleanSim(body) };
}
