import { format, parseISO } from 'date-fns';
import { ru, enGB } from 'date-fns/locale';
import type { Language } from '../i18n';

/**
 * Разделители тысяч различаются: в русском это неразрывный пробел, в английском —
 * запятая. Пробел берём именно неразрывный, иначе число рвётся на перенос строки.
 */
export function formatNumber(value: number, language: Language): string {
  const digits = Math.round(value).toString();
  const separator = language === 'ru' ? ' ' : ',';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Со знаком: используется для перепробега, где минус несёт смысл. */
export function formatSigned(value: number, language: Language): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value), language)}`;
}

export function formatDate(iso: string, language: Language): string {
  return format(parseISO(iso), 'd MMMM yyyy', { locale: language === 'ru' ? ru : enGB });
}

export function formatShortDate(iso: string, language: Language): string {
  return format(parseISO(iso), 'dd.MM.yyyy', { locale: language === 'ru' ? ru : enGB });
}

/** ISO-дата по местным полям: `toISOString()` увёл бы день в UTC. */
export function localIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Маска даты для ручного ввода: оставляет до восьми цифр и расставляет точки сама,
 * поэтому набирать можно подряд — «12032025» превратится в «12.03.2025».
 */
export function maskShortDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** Разбирает «дд.мм.гггг» в ISO; null — дата набрана не полностью или такого дня нет. */
export function parseShortDate(input: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  // Date молча переносит 31.02 на март — сверяем поля, чтобы такой день отбросить.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

export function monthIndex(iso: string): number {
  return parseISO(iso).getMonth();
}

export function yearOf(iso: string): number {
  return parseISO(iso).getFullYear();
}

/** Дробное число из поля замера: принимает и запятую, и точку. */
export function parseDecimalInput(input: string): number | null {
  const cleaned = input.replace(',', '.').replace(/[^\d.]/g, '');
  if (cleaned.length === 0 || cleaned === '.') return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Дробное число для показа: десятые через запятую по-русски и через точку по-английски. */
export function formatDecimal(value: number, language: Language): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return language === 'ru' ? text.replace('.', ',') : text;
}

/** Разбирает то, что пользователь набрал в числовом поле, вместе с любыми разделителями. */
export function parseNumberInput(input: string): number | null {
  const cleaned = input.replace(/[^\d]/g, '');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
