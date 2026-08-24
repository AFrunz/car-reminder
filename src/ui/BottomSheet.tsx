import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, motion, radius, sizes } from '../theme/tokens';
import { AppText } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Закреплённый низ шторки — обычно основная кнопка. */
  footer?: ReactNode;
  /** Правый слот заголовка: «Готово», крестик и подобное. */
  headerRight?: ReactNode;
}

/** На Android окно модалки не поджимается под клавиатуру, поэтому её высоту считаем сами. */
const KEYBOARD_SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const KEYBOARD_HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  headerRight,
}: BottomSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  /** Содержимое живёт дольше пропа visible: сначала доигрывает анимация ухода. */
  const [mounted, setMounted] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  /** Высота области внутри модалки: она честнее окна, когда система забрала часть экрана. */
  const [containerHeight, setContainerHeight] = useState(0);

  const translateY = useRef(new Animated.Value(windowHeight)).current;
  /** Замеренная высота панели: на неё шторка уезжает при закрытии. */
  const sheetHeightRef = useRef(0);
  const keyboardPadRef = useRef(0);
  const fallbackHeightRef = useRef(windowHeight);
  const mountedRef = useRef(mounted);
  const visibleRef = useRef(visible);
  const onCloseRef = useRef(onClose);
  /** Открытие ждёт первого onLayout: до него неизвестно, с какой высоты выезжать. */
  const awaitingLayoutRef = useRef(false);
  const dragStartRef = useRef(0);

  /** Клавиатура перекрывает системную навигацию, поэтому отступы не складываются. */
  const keyboardPad = Math.max(keyboardHeight, insets.bottom);
  const maxSheetHeight =
    (containerHeight > 0 ? containerHeight : windowHeight) * layout.sheet.maxHeightRatio;

  useEffect(() => {
    onCloseRef.current = onClose;
    mountedRef.current = mounted;
    keyboardPadRef.current = keyboardPad;
    fallbackHeightRef.current = windowHeight;
  });

  const animateOpen = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: motion.sheet.openDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const springBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: motion.sheet.springTension,
      friction: motion.sheet.springFriction,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  useEffect(() => {
    visibleRef.current = visible;

    if (visible) {
      setMounted(true);
      // Панель уже замерена (например, закрытие не успело доиграть) — едем сразу.
      awaitingLayoutRef.current = sheetHeightRef.current <= 0;
      if (!awaitingLayoutRef.current) animateOpen();
      return;
    }

    if (!mountedRef.current) return;
    awaitingLayoutRef.current = false;

    Animated.timing(translateY, {
      toValue: sheetHeightRef.current > 0 ? sheetHeightRef.current : fallbackHeightRef.current,
      duration: motion.sheet.closeDuration,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Прерванная анимация означает повторное открытие — содержимое не трогаем.
      if (!finished) return;
      sheetHeightRef.current = 0;
      translateY.setValue(fallbackHeightRef.current);
      setSheetHeight(0);
      setKeyboardHeight(0);
      setMounted(false);
    });
  }, [animateOpen, translateY, visible]);

  useEffect(() => {
    if (!mounted) return;
    const onShow = (event: KeyboardEvent) => {
      // Пока шторка уезжает, отступ не пересчитываем — иначе панель дёрнется вниз.
      if (visibleRef.current) setKeyboardHeight(event.endCoordinates.height);
    };
    const onHide = () => {
      if (visibleRef.current) setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(KEYBOARD_SHOW_EVENT, onShow);
    const hideSub = Keyboard.addListener(KEYBOARD_HIDE_EVENT, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [mounted]);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerHeight(event.nativeEvent.layout.height);
  }, []);

  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height <= 0) return;
      sheetHeightRef.current = height;
      setSheetHeight(height);
      if (!awaitingLayoutRef.current) return;
      awaitingLayoutRef.current = false;
      translateY.setValue(height);
      animateOpen();
    },
    [animateOpen, translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Тап по «Готово» в шапке должен доставаться кнопке: жест берём только на движении.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > motion.sheet.dragActivationDistance &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: (_event, gesture) => {
          translateY.stopAnimation();
          // Жест перехвачен уже после порога активации — вычитаем его, чтобы панель не прыгнула.
          dragStartRef.current = gesture.dy;
        },
        onPanResponderMove: (_event, gesture) => {
          // Вверх шторка не тянется.
          translateY.setValue(Math.max(0, gesture.dy - dragStartRef.current));
        },
        onPanResponderRelease: (_event, gesture) => {
          const dragged = Math.max(0, gesture.dy - dragStartRef.current);
          // Часть высоты под клавиатурой не видна, порог считаем от видимой.
          const openHeight = Math.max(
            1,
            (sheetHeightRef.current > 0 ? sheetHeightRef.current : fallbackHeightRef.current) -
              keyboardPadRef.current,
          );
          const farEnough = dragged > openHeight * motion.sheet.dismissDistanceRatio;
          const fastEnough = gesture.vy > motion.sheet.dismissVelocity;
          if (farEnough || fastEnough) {
            // Уход вниз доиграет эффект по visible — из той точки, где отпустили.
            onCloseRef.current();
            return;
          }
          springBack();
        },
        onPanResponderTerminate: springBack,
        onPanResponderTerminationRequest: () => false,
      }),
    [springBack, translateY],
  );

  const scrimOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, sheetHeight > 0 ? sheetHeight : windowHeight],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [sheetHeight, translateY, windowHeight],
  );

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root} onLayout={handleContainerLayout}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: scrimOpacity }]}
        >
          <Pressable accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          onLayout={handleSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              maxHeight: maxSheetHeight,
              paddingBottom: keyboardPad,
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.grabberWrap}>
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.header}>
              <AppText numberOfLines={1} style={styles.title}>
                {title}
              </AppText>
              {headerRight}
            </View>
          </View>
          {children ? (
            <ScrollView
              style={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : null}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingBottom: layout.sheet.grabberPaddingBottom,
    paddingTop: layout.sheet.grabberPaddingTop,
  },
  grabber: {
    borderRadius: radius.grabber,
    height: sizes.grabberHeight,
    width: sizes.grabberWidth,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: layout.sheet.headerPaddingBottom,
    paddingHorizontal: layout.sheet.paddingHorizontal,
    paddingTop: layout.sheet.headerPaddingTop,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.uiBold,
    fontSize: fontSize.sheetTitle,
  },
  /** Скролл ужимается под доступную высоту, но не растягивает короткое содержимое. */
  content: {
    flexGrow: 0,
    flexShrink: 1,
  },
  footer: {
    paddingBottom: layout.sheet.footerPaddingBottom,
    paddingHorizontal: layout.sheet.paddingHorizontal,
    paddingTop: layout.sheet.footerPaddingTop,
  },
});
