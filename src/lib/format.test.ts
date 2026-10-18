import { maskShortDate, parseDecimalInput, parseShortDate } from './format';

describe('ввод даты', () => {
  it('расставляет точки по мере набора', () => {
    expect(maskShortDate('1')).toBe('1');
    expect(maskShortDate('120')).toBe('12.0');
    expect(maskShortDate('1203')).toBe('12.03');
    expect(maskShortDate('12032025')).toBe('12.03.2025');
    expect(maskShortDate('12.03.20251')).toBe('12.03.2025');
  });

  it('не мешает стирать: точка без следующих цифр исчезает', () => {
    expect(maskShortDate('12.03.')).toBe('12.03');
  });

  it('разбирает полную дату и отбрасывает несуществующие дни', () => {
    expect(parseShortDate('12.03.2025')).toBe('2025-03-12');
    expect(parseShortDate('29.02.2024')).toBe('2024-02-29');
    expect(parseShortDate('29.02.2025')).toBeNull();
    expect(parseShortDate('31.04.2025')).toBeNull();
    expect(parseShortDate('12.03.20')).toBeNull();
  });
});

describe('ввод замера', () => {
  it('принимает и запятую, и точку', () => {
    expect(parseDecimalInput('6,5')).toBe(6.5);
    expect(parseDecimalInput('6.5')).toBe(6.5);
    expect(parseDecimalInput('7')).toBe(7);
    expect(parseDecimalInput('')).toBeNull();
  });
});
