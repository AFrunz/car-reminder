import { calculateResource, calculateNextService, WARN_THRESHOLD } from './resource';

const TODAY = '2025-03-12';

describe('calculateResource', () => {
  it('возвращает «нет данных», когда деталь ни разу не меняли', () => {
    const r = calculateResource({ intervalKm: 10_000, intervalMonths: 12 }, null, 148_320, TODAY);
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
    );
    expect(r.status).toBe('no-data');
  });

  it('считает кольцо по пробегу, когда километровый интервал задан', () => {
    const r = calculateResource(
      { intervalKm: 10_000, intervalMonths: 12 },
      { mileage: 145_000, date: '2025-03-01' },
      148_000,
      TODAY,
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
    );
    expect(r.value).toBe(100);
  });
});

describe('calculateNextService', () => {
  it('возвращает null, когда регулярных ТО нет', () => {
    expect(calculateNextService(0, 0, { mileage: 140_000, date: '2024-01-01' }, 148_000, TODAY))
      .toBeNull();
  });

  it('считает остаток до следующего ТО и его пробег', () => {
    const next = calculateNextService(
      10_000,
      12,
      { mileage: 145_000, date: '2024-11-12' },
      148_000,
      TODAY,
    );
    expect(next).not.toBeNull();
    expect(next!.kmLeft).toBe(7_000);
    expect(next!.dueAtMileage).toBe(155_000);
    expect(next!.monthsLeft).toBe(8);
  });

  it('отдаёт «нет данных», пока не было ни одного регулярного ТО', () => {
    const next = calculateNextService(10_000, 12, null, 148_000, TODAY);
    expect(next!.status).toBe('no-data');
    expect(next!.dueAtMileage).toBeNull();
  });
});
