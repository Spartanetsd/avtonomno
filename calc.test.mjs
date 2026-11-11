// Тести калькуляторів. Запуск: npm test (node --test, без залежностей).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battery, waterHeat, waterNeeds, energyPlan, num, fmt, fmtHours } from './calc.js';
import { jouleWh, carnotEta, newtonTemp, fourierRelative, faradayHours } from './physics.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('num: кома як десятковий роздільник, порожнє — NaN', () => {
  assert.equal(num('2,5'), 2.5);
  assert.equal(num(' 1 000 '), 1000);
  assert.ok(Number.isNaN(num('')));
  assert.ok(Number.isNaN(num('abc')));
});

test('акумулятор: 12 В × 100 А·год × 0,85 ÷ 100 Вт = 10,2 год', () => {
  const r = battery({ voltage: 12, capacity: 100, unit: 'Ah', loadW: 100, k: 0.85 });
  assert.equal(r.ok, true);
  close(r.nominalWh, 1200);
  close(r.usableWh, 1020);
  close(r.hours, 10.2);
});

test('акумулятор: павербанк 20 000 мА·год при 3,7 В = 74 Вт·год', () => {
  const r = battery({ voltage: '3,7', capacity: '20000', unit: 'mAh', loadW: '10', k: '0,7' });
  assert.equal(r.ok, true);
  close(r.nominalWh, 74);
  close(r.usableWh, 51.8);
  close(r.hours, 5.18);
});

test('акумулятор: Вт·год не потребують напруги', () => {
  const r = battery({ capacity: 500, unit: 'Wh', loadW: 5, k: 0.85 });
  assert.equal(r.ok, true);
  close(r.hours, 85);
});

test('акумулятор: попередження, коли навантаження більше за вихід (потужність ≠ запас)', () => {
  const r = battery({ capacity: 1000, unit: 'Wh', loadW: 2000, k: 0.85, maxW: 1000 });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.level === 'danger'));
});

test('акумулятор: некоректні дані повертають помилки, а не NaN', () => {
  const r = battery({ voltage: 0, capacity: -1, unit: 'Ah', loadW: 0, k: 2 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 3);
});

test('нагрівання: 1 л від 20 до 100 °C — точно ≈93,02 Вт·год', () => {
  const r = waterHeat({ liters: 1, t0: 20, t1: 100, powerW: 2000, eff: 0.9 });
  assert.equal(r.ok, true);
  close(r.qWh, (4186 * 80) / 3600);
  close(r.sourceWh, r.qWh / 0.9);
  close(r.minutes, (r.sourceWh / 2000) * 60);
  assert.ok(r.minutes > 3 && r.minutes < 3.2);
});

test('нагрівання: інвертор додає втрати, бажана t не нижча за початкову', () => {
  const r = waterHeat({ liters: 2, t0: 15, t1: 100, powerW: 800, eff: 0.85, inverter: true });
  assert.equal(r.ok, true);
  close(r.batteryWh, r.sourceWh / 0.85);
  const bad = waterHeat({ liters: 1, t0: 80, t1: 60, powerW: 1000, eff: 0.8 });
  assert.equal(bad.ok, false);
});

test('вода: 2 дорослих × 3 доби × 7,5 л = 45 л; пиття окремо', () => {
  const r = waterNeeds({ adults: 2, kids: 0, elderly: 0, days: 3, drink: 2.5, cook: 3, hygiene: 2 });
  assert.equal(r.ok, true);
  close(r.total, 45);
  close(r.drinkingOnly, 15);
});

test('вода: спека подвоює пиття, тварини враховуються за масою', () => {
  const r = waterNeeds({ adults: 1, kids: 0, elderly: 0, days: 1, drink: 3, cook: 0, hygiene: 0, petKg: 20, hot: true });
  assert.equal(r.ok, true);
  close(r.daily, 6 + 20 * 0.06 * 1.5);
});

test('вода: наявний запас дає кількість діб', () => {
  const r = waterNeeds({ adults: 2, kids: 0, elderly: 0, days: 3, drink: 2.5, cook: 0, hygiene: 1.3, haveL: 15.2 });
  assert.equal(r.ok, true);
  close(r.daysCovered, 2);
});

test('енергопріоритети: спершу критичне, далі за порядком', () => {
  const r = energyPlan({
    availableWh: 100, days: 1, devices: [
      { name: 'Інше', watts: 50, hours: 2, cat: 5 },
      { name: 'Світло', watts: 5, hours: 4, cat: 2 },
      { name: 'Критичне', watts: 30, hours: 2, cat: 1 },
    ],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map((x) => x.name), ['Критичне', 'Світло', 'Інше']);
  assert.equal(r.rows[0].status, 'full');
  assert.equal(r.rows[1].status, 'full');
  assert.equal(r.rows[2].status, 'partial');
  close(r.rows[2].got, 20);
  close(r.autonomyDays, 100 / 180);
});

test('енергопріоритети: медичний пристрій позначається', () => {
  const r = energyPlan({ availableWh: 500, days: 2, devices: [{ name: 'Медичний', watts: 40, hours: 8, cat: 1, medical: true }] });
  assert.equal(r.ok, true);
  assert.equal(r.medical, true);
});

test('форматування українською', () => {
  assert.equal(fmt(2.5), '2,5');
  assert.equal(fmt(1234), '1 234');
  assert.equal(fmtHours(1.5), '1 год 30 хв');
  assert.equal(fmtHours(0.25), '15 хв');
});

test('фізичні міні-моделі', () => {
  assert.equal(jouleWh(100, 2), 200);
  close(carnotEta(600, 20), 1 - 293.15 / 873.15);
  close(newtonTemp(95, 20, 0, 5), 95);
  assert.ok(newtonTemp(95, 20, 6, 20) > newtonTemp(95, 20, 6, 0.45));
  close(fourierRelative(1, 0), 1);
  assert.ok(fourierRelative(0.5, 2) < 0.5);
  close(faradayHours(5), 15 / 3);
});
