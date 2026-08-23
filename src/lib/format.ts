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

export function monthIndex(iso: string): number {
  return parseISO(iso).getMonth();
}

export function yearOf(iso: string): number {
  return parseISO(iso).getFullYear();
}

/** Разбирает то, что пользователь набрал в числовом поле, вместе с любыми разделителями. */
export function parseNumberInput(input: string): number | null {
  const cleaned = input.replace(/[^\d]/g, '');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
