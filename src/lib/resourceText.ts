import type { useTranslation } from 'react-i18next';
import type { Resource } from '../domain/resource';
import type { TextTone } from '../ui';
import type { Language } from '../i18n';
import { formatDecimal, formatNumber, formatSigned } from './format';

type Translate = ReturnType<typeof useTranslation>['t'];

export interface ResourceLine {
  text: string;
  tone: TextTone;
}

/** Остаток одним числом: километры, если они считаются, иначе месяцы. */
function shortRemaining(resource: Resource, language: Language, t: Translate): string | null {
  if (resource.kmLeft != null) {
    return t('parts.remainingKm', { km: formatSigned(resource.kmLeft, language) });
  }
  if (resource.monthsLeft != null) {
    return t('parts.remainingMonths', { months: formatSigned(resource.monthsLeft, language) });
  }
  return null;
}

/** До проверки одним числом — по той же развилке «километры, иначе месяцы». */
function inspectionRemaining(resource: Resource, language: Language, t: Translate): string | null {
  const inspection = resource.inspection;
  if (!inspection) return null;
  if (inspection.kmLeft != null) {
    return t('parts.inspectInKm', { km: formatNumber(inspection.kmLeft, language) });
  }
  if (inspection.monthsLeft != null) {
    return t('parts.inspectInMonths', { months: formatNumber(inspection.monthsLeft, language) });
  }
  return null;
}

/**
 * Подпись под названием детали — остаток ресурса словами. Для просрочки показываем
 * километровое число (со знаком минус при перепробеге) и слово «просрочено»: цвет здесь
 * означает худшее из ограничений, а число — всегда километровое.
 *
 * Прочерк остаётся только у `no-data` — когда у детали не задан ни один интервал и
 * считать попросту нечего. Ресурс, посчитанный от начала жизни машины, показывает
 * обычные числа и тон по статусу, а допущение выдаёт приписка «нет данных».
 */
export function describeResource(
  resource: Resource,
  language: Language,
  t: Translate,
): ResourceLine {
  const { status, kmLeft, monthsLeft, assumed, basis, wear } = resource;
  if (status === 'no-data') return { text: t('parts.noData'), tone: 'tertiary' };

  const withAssumption = (text: string): string =>
    assumed ? t('parts.assumed', { value: text }) : text;

  if (status === 'inspect') {
    // Само число здесь вторично: главное — сходить и посмотреть.
    const value = basis === 'inspection' ? null : shortRemaining(resource, language, t);
    const text = value ? t('parts.inspectDueWith', { value }) : t('parts.inspectDue');
    return { text: withAssumption(text), tone: 'inspect' };
  }

  const tone: TextTone =
    status === 'overdue' ? 'danger' : status === 'warn' ? 'warn' : 'secondary';

  if (basis === 'inspection') {
    const text = inspectionRemaining(resource, language, t) ?? t('parts.noData');
    return { text: withAssumption(text), tone };
  }

  if (basis === 'wear' && wear) {
    const mm = formatDecimal(wear.estimated, language);
    if (status === 'overdue') return { text: t('parts.wearOverdue', { mm }), tone };
    return {
      text:
        kmLeft != null
          ? t('parts.wearKm', { mm, km: formatNumber(kmLeft, language) })
          : t('parts.wear', { mm }),
      tone,
    };
  }

  if (assumed) {
    // Одно число вместо двух: третьим сегментом строка перестаёт читаться.
    const value = shortRemaining(resource, language, t);
    if (value === null) return { text: t('parts.noData'), tone: 'tertiary' };
    return { text: t('parts.assumed', { value }), tone };
  }

  if (status === 'overdue') {
    return {
      text:
        kmLeft != null
          ? t('parts.overdueKm', { km: formatSigned(kmLeft, language) })
          : monthsLeft != null
            ? t('parts.overdueMonths', { months: formatSigned(monthsLeft, language) })
            : t('parts.overdue'),
      tone,
    };
  }

  if (kmLeft != null && monthsLeft != null) {
    return {
      text: t('parts.remaining', {
        km: formatNumber(kmLeft, language),
        months: formatNumber(monthsLeft, language),
      }),
      tone,
    };
  }
  if (kmLeft != null) {
    return { text: t('parts.remainingKm', { km: formatNumber(kmLeft, language) }), tone };
  }
  if (monthsLeft != null) {
    return {
      text: t('parts.remainingMonths', { months: formatNumber(monthsLeft, language) }),
      tone,
    };
  }
  return { text: t('parts.noData'), tone: 'tertiary' };
}
