import {
  calculateResource,
  calculateNextService,
  baselineForCar,
  byUrgency,
  NO_DATA,
  summarizePartEvents,
  WARN_THRESHOLD,
  type Resource,
} from './resource';

const TODAY = '2025-03-12';
// Машина 2014 года: точка отсчёта для детали, которую ни разу не меняли.
const BASELINE = baselineForCar({ year: 2014 });

describe('calculateResource', () => {
  it('считает деталь без замен неменянной с начала жизни машины', () => {
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: 12 },
      null,
      148_320,
      TODAY,
      BASELINE,
    );
    // Ресурс на 10 000 км, а машина проехала 148 320 без единой замены — это просрочка,
    // а не неизвестность.
    expect(r.assumed).toBe(true);
    expect(r.status).toBe('overdue');
    expect(r.kmLeft).toBe(-138_320);
    expect(r.value).toBe(0);
  });

  it('не помечает допущением расчёт, у которого есть запись о замене', () => {
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: 12 },
      { mileage: 145_000, date: '2025-03-01' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.assumed).toBe(false);
  });

  it('отдаёт «нет данных» только когда считать нечем — интервалы не заданы', () => {
    const r = calculateResource(
      { intervalKm: null, intervalMonths: null },
      null,
      148_320,
      TODAY,
      BASELINE,
    );
    expect(r.status).toBe('no-data');
    expect(r.value).toBeNull();
    expect(r.basis).toBeNull();
  });

  it('возвращает «нет данных», когда ни один интервал не задан', () => {
    const r = calculateResource(
      { intervalKm: null, intervalMonths: null },
      { mileage: 140_000, date: '2024-03-12' },
      148_320,
      TODAY,
      BASELINE,
    );
    expect(r.status).toBe('no-data');
  });

  it('считает кольцо по пробегу, когда километровый интервал задан', () => {
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: 12 },
      { mileage: 145_000, date: '2025-03-01' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.basis).toBe('km');
    expect(r.kmLeft).toBe(7_000);
    expect(r.value).toBe(70);
    expect(r.status).toBe('ok');
  });

  it('считает кольцо по времени, когда километрового интервала нет', () => {
    const r = calculateResource(
      { intervalKm: null, intervalMonths: 24 },
      { mileage: 100_000, date: '2024-03-12' },
      148_320,
      TODAY,
      BASELINE,
    );
    expect(r.basis).toBe('time');
    expect(r.kmLeft).toBeNull();
    expect(r.monthsLeft).toBe(12);
    expect(r.value).toBe(50);
  });

  it('обнуляет кольцо и показывает перепробег при превышении по километрам', () => {
    const r = calculateResource(
      { intervalKm: 90_000, intervalMonths: 84 },
      { mileage: 55_000, date: '2019-01-01' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.status).toBe('overdue');
    expect(r.value).toBe(0);
    expect(r.kmLeft).toBe(-3_000);
  });

  it('красит деталь в просрочку по времени, но оставляет километровый остаток на кольце', () => {
    // По пробегу израсходована половина ресурса, а срок по времени уже вышел.
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: 12 },
      { mileage: 143_000, date: '2023-01-01' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.status).toBe('overdue');
    expect(r.kmLeft).toBe(5_000);
    expect(r.monthsLeft).toBeLessThan(0);
    // Кольцо продолжает показывать километры, а не схлопывается в ноль.
    expect(r.value).toBe(50);
    expect(r.basis).toBe('km');
  });

  it('помечает деталь как требующую внимания на пороге', () => {
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: null },
      { mileage: 140_000, date: '2024-06-01' },
      148_100,
      TODAY,
      BASELINE,
    );
    expect(r.value).toBe(WARN_THRESHOLD - 1);
    expect(r.status).toBe('warn');
  });

  it('не уводит кольцо выше 100 при отрицательном пробеге с момента замены', () => {
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: null },
      { mileage: 150_000, date: '2025-03-01' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.value).toBe(100);
  });
});

describe('calculateNextService', () => {
  it('возвращает null, когда регулярных ТО нет', () => {
    expect(calculateNextService(0, 0, { mileage: 140_000, date: '2024-01-01' }, 148_000, TODAY, BASELINE))
      .toBeNull();
  });

  it('считает остаток до следующего ТО и его пробег', () => {
    const next = calculateNextService(
      10_000,
      12,
      { mileage: 145_000, date: '2024-11-12' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(next).not.toBeNull();
    expect(next!.kmLeft).toBe(7_000);
    expect(next!.dueAtMileage).toBe(155_000);
    expect(next!.monthsLeft).toBe(8);
  });

  it('считает ТО ни разу не сделанным, пока в истории нет регулярных записей', () => {
    const next = calculateNextService(10_000, 12, null, 148_000, TODAY, BASELINE);
    expect(next!.assumed).toBe(true);
    expect(next!.status).toBe('overdue');
    // Отсчёт от нулевого пробега, поэтому срок ТО наступил ещё на десяти тысячах.
    expect(next!.dueAtMileage).toBe(10_000);
  });
});

describe('проверка', () => {
  const pads = {
    intervalKm: 40_000,
    intervalMonths: null,
    inspectKm: 15_000,
    inspectMonths: 12,
  };

  it('красит деталь в «пора проверить», когда вышел срок осмотра, а замена ещё не нужна', () => {
    const r = calculateResource(
      pads,
      { mileage: 130_000, date: '2024-01-10' },
      148_000,
      TODAY,
      BASELINE,
    );
    // До замены ещё 22 000 км, но со дня замены прошло больше года — пора посмотреть.
    expect(r.kmLeft).toBe(22_000);
    expect(r.inspection?.due).toBe(true);
    expect(r.status).toBe('inspect');
  });

  it('отсчитывает проверку от последнего осмотра, а замену — от замены', () => {
    const r = calculateResource(
      pads,
      { mileage: 120_000, date: '2023-06-01' },
      148_000,
      TODAY,
      BASELINE,
      { lastInspection: { mileage: 140_000, date: '2025-01-15' } },
    );
    expect(r.kmLeft).toBe(12_000);
    expect(r.inspection?.kmLeft).toBe(7_000);
    expect(r.inspection?.due).toBe(false);
    expect(r.status).toBe('ok');
  });

  it('считает замену заодно и осмотром', () => {
    const r = calculateResource(
      pads,
      { mileage: 145_000, date: '2025-02-01' },
      148_000,
      TODAY,
      BASELINE,
      { lastInspection: { mileage: 100_000, date: '2022-01-01' } },
    );
    expect(r.inspection?.kmLeft).toBe(12_000);
    expect(r.status).toBe('ok');
  });

  it('оставляет просрочку замены красной, даже если и осмотр пропущен', () => {
    const r = calculateResource(
      pads,
      { mileage: 100_000, date: '2022-01-01' },
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.status).toBe('overdue');
  });

  it('строит кольцо по сроку проверки у детали, которую только осматривают', () => {
    const r = calculateResource(
      { intervalKm: null, intervalMonths: null, inspectKm: 15_000, inspectMonths: null },
      null,
      148_000,
      TODAY,
      BASELINE,
      { lastInspection: { mileage: 144_250, date: '2025-01-01' } },
    );
    expect(r.basis).toBe('inspection');
    expect(r.value).toBe(75);
    expect(r.kmLeft).toBeNull();
    expect(r.assumed).toBe(false);
    // «Скоро менять» у такой детали не бывает — менять её по сроку никто не просил.
    const almost = calculateResource(
      { intervalKm: null, intervalMonths: null, inspectKm: 15_000, inspectMonths: null },
      null,
      148_000,
      TODAY,
      BASELINE,
      { lastInspection: { mileage: 134_000, date: '2025-01-01' } },
    );
    expect(almost.status).toBe('ok');
  });

  it('считает неосмотренную деталь просроченной к проверке от начала жизни машины', () => {
    const r = calculateResource(
      { intervalKm: null, intervalMonths: null, inspectKm: 15_000, inspectMonths: null },
      null,
      148_000,
      TODAY,
      BASELINE,
    );
    expect(r.status).toBe('inspect');
    expect(r.assumed).toBe(true);
  });
});

describe('замер износа', () => {
  const pads = {
    intervalKm: 40_000,
    intervalMonths: null,
    inspectKm: 15_000,
    inspectMonths: null,
    wearNew: 12,
    wearMin: 3,
  };

  it('считает скорость износа по паре «замена → замер» и экстраполирует на сегодня', () => {
    // 12 → 9 мм за 30 000 км: 0,1 мм на тысячу; ещё 5 000 км — минус полмиллиметра.
    const r = calculateResource(
      pads,
      { mileage: 100_000, date: '2023-01-01' },
      135_000,
      TODAY,
      BASELINE,
      { measurement: { mileage: 130_000, date: '2025-01-01', value: 9 } },
    );
    expect(r.basis).toBe('wear');
    expect(r.wear?.estimated).toBeCloseTo(8.5);
    expect(r.wear?.extrapolated).toBe(true);
    expect(r.kmLeft).toBe(55_000);
    expect(r.value).toBe(61);
    // По интервалу деталь была бы почти выработана, но замер честнее.
    expect(r.status).toBe('ok');
  });

  it('берёт скорость из интервала, когда замена неизвестна', () => {
    const r = calculateResource(
      pads,
      null,
      140_000,
      TODAY,
      BASELINE,
      { measurement: { mileage: 140_000, date: '2025-03-01', value: 7.5 } },
    );
    // 9 мм ресурса на 40 000 км: остаток 4,5 мм — это 20 000 км.
    expect(r.kmLeft).toBe(20_000);
    expect(r.value).toBe(50);
    expect(r.assumed).toBe(false);
  });

  it('объявляет просрочку, когда оценка опустилась до предела', () => {
    const r = calculateResource(
      pads,
      { mileage: 100_000, date: '2023-01-01' },
      150_000,
      TODAY,
      BASELINE,
      { measurement: { mileage: 130_000, date: '2025-01-01', value: 4 } },
    );
    expect(r.wear?.estimated).toBeLessThanOrEqual(3);
    expect(r.status).toBe('overdue');
  });

  it('не верит замеру, сделанному до последней замены', () => {
    const r = calculateResource(
      pads,
      { mileage: 140_000, date: '2025-02-01' },
      141_000,
      TODAY,
      BASELINE,
      { measurement: { mileage: 130_000, date: '2025-01-01', value: 3.5 } },
    );
    expect(r.basis).toBe('km');
    expect(r.wear).toBeNull();
  });

  it('у шин держит в силе срок по возрасту, даже когда протектор в порядке', () => {
    const r = calculateResource(
      { intervalKm: null, intervalMonths: 72, wearNew: 9, wearMin: 4, inspectMonths: 12 },
      { mileage: 20_000, date: '2017-10-01' },
      148_000,
      TODAY,
      BASELINE,
      { measurement: { mileage: 147_000, date: '2024-11-01', value: 7 } },
    );
    expect(r.basis).toBe('wear');
    expect(r.status).toBe('overdue');
    expect(r.monthsLeft).toBeLessThan(0);
  });
});

describe('summarizePartEvents', () => {
  it('раскладывает действия на последнюю замену, проверку и свежий замер', () => {
    const summary = summarizePartEvents([
      { partId: 'p', action: 'replace', mileage: 100_000, date: '2023-01-01', measurement: null },
      { partId: 'p', action: 'inspect', mileage: 120_000, date: '2024-01-01', measurement: 10 },
      { partId: 'p', action: 'inspect', mileage: 130_000, date: '2024-09-01', measurement: 9 },
      { partId: 'p', action: 'inspect', mileage: 135_000, date: '2025-01-01', measurement: null },
    ]);
    expect(summary.p.lastChange).toEqual({ mileage: 100_000, date: '2023-01-01' });
    expect(summary.p.lastInspection).toEqual({ mileage: 135_000, date: '2025-01-01' });
    expect(summary.p.measurement).toEqual({ mileage: 130_000, date: '2024-09-01', value: 9 });
  });

  it('забывает замер старой детали после замены', () => {
    const summary = summarizePartEvents([
      { partId: 'p', action: 'inspect', mileage: 120_000, date: '2024-01-01', measurement: 4 },
      { partId: 'p', action: 'replace', mileage: 125_000, date: '2024-03-01', measurement: null },
    ]);
    expect(summary.p.measurement).toBeNull();
  });
});

describe('byUrgency', () => {
  it('ставит просрочку перед проверкой, проверку — перед «скоро менять»', () => {
    const make = (status: Resource['status'], value: number | null): Resource => ({
      ...NO_DATA,
      status,
      value,
    });
    const sorted = [
      make('ok', 80),
      make('no-data', null),
      make('warn', 10),
      make('inspect', 60),
      make('overdue', 0),
      make('ok', 40),
    ].sort(byUrgency);
    expect(sorted.map((r) => r.status)).toEqual([
      'overdue',
      'inspect',
      'warn',
      'ok',
      'ok',
      'no-data',
    ]);
    expect(sorted[3].value).toBe(40);
  });
});
