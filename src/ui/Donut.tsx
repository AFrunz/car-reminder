import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../theme/ThemeProvider';
import type { ResourceStatus } from '../domain/resource';
import { MonoText, type TextTone } from './Text';

/** Толщина кольца в долях диаметра: у крупного кольца полоса визуально тоньше. */
const THICKNESS_SMALL = 0.12;
const THICKNESS_LARGE = 0.09;
const LARGE_FROM = 100;
/** Кегль подписи в долях диаметра: 13 при 44 и 45 при 150 — как в макете. */
const LABEL_RATIO = 0.3;
const NO_DATA_LABEL = '—';

const STATUS_TONE: Record<ResourceStatus, TextTone> = {
  ok: 'ok',
  warn: 'warn',
  overdue: 'danger',
  'no-data': 'tertiary',
};

export interface DonutProps {
  size: number;
  /** 0..100; null — данных о замене нет. */
  value: number | null;
  status: ResourceStatus;
  /** Подпись в центре; для «нет данных» всегда прочерк. */
  label?: string;
}

export function Donut({ size, value, status, label }: DonutProps) {
  const colors = useColors();

  const strokeWidth = size * (size >= LARGE_FROM ? THICKNESS_LARGE : THICKNESS_SMALL);
  const center = size / 2;
  // Радиус считается по средней линии полосы, иначе кольцо вылезет за границы svg.
  const ringRadius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const filled = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;

  const arcColor =
    status === 'ok' ? colors.ok : status === 'warn' ? colors.warn : colors.danger;
  const trackColor = status === 'overdue' ? colors.ringTrackDanger : colors.ringTrack;
  const text = status === 'no-data' ? NO_DATA_LABEL : (label ?? String(value ?? ''));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {status !== 'no-data' && filled > 0 ? (
          // Окружность в svg начинается на «трёх часах» и идёт по часовой стрелке,
          // поэтому поворот на -90° переносит старт дуги наверх, а видимый отрезок
          // штриха длиной filled × длина окружности задаётся смещением пунктира.
          <Circle
            cx={center}
            cy={center}
            r={ringRadius}
            stroke={arcColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - filled)}
            rotation={-90}
            originX={center}
            originY={center}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.label]} pointerEvents="none">
        <MonoText tone={STATUS_TONE[status]} weight="semibold" size={Math.round(size * LABEL_RATIO)}>
          {text}
        </MonoText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
