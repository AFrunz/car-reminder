import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, radius, sizes } from '../theme/tokens';
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

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  headerRight,
}: BottomSheetProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.header}>
            <AppText numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
            {headerRight}
          </View>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
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
  footer: {
    paddingBottom: layout.sheet.footerPaddingBottom,
    paddingHorizontal: layout.sheet.paddingHorizontal,
    paddingTop: layout.sheet.footerPaddingTop,
  },
});
