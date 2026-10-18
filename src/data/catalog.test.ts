import { CATALOG, hasInterval } from './catalog';
import ru from '../i18n/locales/ru';
import en from '../i18n/locales/en';

describe('каталог', () => {
  it('переведён целиком на оба языка', () => {
    for (const entry of CATALOG) {
      expect(ru.catalog).toHaveProperty([entry.key]);
      expect(en.catalog).toHaveProperty([entry.key]);
    }
  });

  it('не даёт общего срока замены деталям, которые меняют поштучно', () => {
    for (const entry of CATALOG.filter((e) => e.scope === 'each')) {
      expect([entry.key, entry.intervalKm, entry.intervalMonths]).toEqual([entry.key, null, null]);
    }
  });

  it('задаёт износ только парой, где новая деталь толще предела', () => {
    for (const entry of CATALOG) {
      if (entry.wearNew === undefined && entry.wearMin === undefined) continue;
      expect(entry.wearNew).toBeGreaterThan(entry.wearMin as number);
    }
  });

  it('считает отслеживаемой деталь, у которой есть только срок проверки', () => {
    expect(hasInterval({ intervalKm: null, intervalMonths: null, inspectKm: 15_000 })).toBe(true);
    expect(hasInterval({ intervalKm: null, intervalMonths: null })).toBe(false);
  });

  it('больше не содержит антикоррозийной обработки', () => {
    expect(CATALOG.some((entry) => entry.key === 'rust-proofing')).toBe(false);
  });
});
