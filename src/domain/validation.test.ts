import {
  validateServiceRecord,
  validateMileageUpdate,
  effectiveMileage,
} from './validation';
import type { ServiceRecord } from './types';

const TODAY = '2025-03-12';

const record = (id: string, date: string, mileage: number): ServiceRecord => ({
  id,
  carId: 'car-1',
  date,
  mileage,
  kind: 'scheduled',
  totalCost: null,
  createdAt: date,
});

const history = [
  record('a', '2024-07-18', 136_400),
  record('b', '2024-11-04', 141_000),
  record('c', '2025-03-12', 148_320),
];

describe('validateServiceRecord', () => {
  it('пропускает запись, которая укладывается между соседними по пробегу', () => {
    expect(validateServiceRecord({ date: '2024-09-01', mileage: 138_000 }, history, TODAY))
      .toEqual([]);
  });

  it('разрешает две записи с одинаковым пробегом', () => {
    expect(validateServiceRecord({ date: '2025-03-12', mileage: 148_320 }, history, TODAY))
      .toEqual([]);
  });

  it('запрещает дату в будущем', () => {
    const errors = validateServiceRecord({ date: '2025-04-01', mileage: 150_000 }, history, TODAY);
    expect(errors.map((e) => e.code)).toContain('date-in-future');
  });

  it('ловит пробег меньше, чем у более ранней записи', () => {
    const errors = validateServiceRecord({ date: '2024-12-01', mileage: 139_000 }, history, TODAY);
    const conflict = errors.find((e) => e.code === 'mileage-below-earlier-record');
    expect(conflict).toBeDefined();
    expect(conflict!.conflictsWith!.id).toBe('b');
  });

  it('ловит пробег больше, чем у более поздней записи', () => {
    const errors = validateServiceRecord({ date: '2024-08-01', mileage: 145_000 }, history, TODAY);
    const conflict = errors.find((e) => e.code === 'mileage-above-later-record');
    expect(conflict).toBeDefined();
    expect(conflict!.conflictsWith!.id).toBe('b');
  });

  it('не сравнивает редактируемую запись саму с собой', () => {
    expect(validateServiceRecord({ id: 'b', date: '2024-11-04', mileage: 141_000 }, history, TODAY))
      .toEqual([]);
  });

  it('позволяет сдвинуть редактируемую запись в допустимый диапазон', () => {
    expect(validateServiceRecord({ id: 'b', date: '2024-11-04', mileage: 140_000 }, history, TODAY))
      .toEqual([]);
  });
});

describe('validateMileageUpdate', () => {
  it('запрещает опустить пробег ниже максимума из истории', () => {
    const errors = validateMileageUpdate(140_000, history);
    expect(errors[0].code).toBe('mileage-below-history');
    expect(errors[0].conflictsWith!.id).toBe('c');
  });

  it('разрешает пробег на уровне максимума и выше', () => {
    expect(validateMileageUpdate(148_320, history)).toEqual([]);
    expect(validateMileageUpdate(150_000, history)).toEqual([]);
  });
});

describe('effectiveMileage', () => {
  it('берёт максимум из введённого вручную и истории', () => {
    expect(effectiveMileage(100_000, history)).toBe(148_320);
    expect(effectiveMileage(150_000, history)).toBe(150_000);
  });
});
