import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, type ProductTheme } from './tokens';

type HeaderProps = {
  theme: ProductTheme;
  kids?: boolean;
  trailing?: ReactNode;
};

export function ProductHeader({ theme, kids = false, trailing }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={[styles.mark, { backgroundColor: theme.brand }]}>
        <Text style={styles.markText}>{kids ? '棋' : '帅'}</Text>
      </View>
      <View style={styles.brandCopy}>
        <Text style={[styles.brand, { color: theme.text }]}>{kids ? 'QiliChess Kids' : 'QiliChess'}</Text>
        <Text style={[styles.brandSub, { color: theme.muted }]}>{kids ? '今天也和棋子做朋友' : 'PLAY WITH INTENT'}</Text>
      </View>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

type ActionButtonProps = {
  accessibilityHint?: string;
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  theme: ProductTheme;
  tone?: 'primary' | 'quiet' | 'gold';
  compact?: boolean;
};

export function ActionButton({ accessibilityHint, children, disabled = false, onPress, theme, tone = 'primary', compact = false }: ActionButtonProps) {
  const backgroundColor = tone === 'primary' ? theme.brand : tone === 'gold' ? theme.accent : theme.surfaceRaised;
  const color = tone === 'quiet' ? theme.text : tone === 'gold' ? '#4a3505' : '#ffffff';
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        theme.kind === 'kids' && tone === 'primary' && styles.kidsButton,
        compact && styles.buttonCompact,
        { backgroundColor, borderColor: tone === 'quiet' ? theme.border : backgroundColor },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{children}</Text>
    </Pressable>
  );
}

type NavItem = { id: string; label: string; icon: string };

type BottomNavigationProps = {
  activeId: string;
  items: readonly NavItem[];
  onChange: (id: string) => void;
  theme: ProductTheme;
};

export function BottomNavigation({ activeId, items, onChange, theme }: BottomNavigationProps) {
  return (
    <View style={[styles.nav, { backgroundColor: theme.nav, borderColor: theme.border }]}>
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[styles.navItem, theme.kind === 'kids' && active && { backgroundColor: theme.accent }]}
          >
            <View style={[styles.navIconWrap, active && { backgroundColor: theme.kind === 'kids' ? '#ffffff55' : theme.surfaceRaised }]}> 
              <Text style={[styles.navIcon, { color: theme.kind === 'kids' ? (active ? '#173149' : '#b8cad4') : (active ? theme.text : theme.subtle) }]}>{item.icon}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.navLabel, { color: theme.kind === 'kids' ? (active ? '#173149' : '#b8cad4') : (active ? theme.text : theme.subtle) }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, theme }: { value: number; theme: ProductTheme }) {
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(safeValue * 100) }} style={[styles.progressTrack, { backgroundColor: theme.border }]}>
      <View style={[styles.progressFill, { backgroundColor: theme.kind === 'kids' ? theme.accent : theme.brand, width: `${safeValue * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 64, paddingHorizontal: space.md, paddingVertical: space.xs },
  mark: { alignItems: 'center', borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 },
  markText: { color: '#fffaf1', fontSize: 22, fontWeight: '900' },
  brandCopy: { marginLeft: space.sm },
  brand: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  brandSub: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  trailing: { alignItems: 'flex-end', flex: 1 },
  button: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm },
  buttonCompact: { minHeight: 42, paddingHorizontal: space.md, paddingVertical: space.xs },
  buttonText: { fontSize: 15, fontWeight: '900' },
  kidsButton: { shadowColor: '#bc3934', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  nav: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingBottom: 7, paddingHorizontal: space.xs, paddingTop: 6 },
  navItem: { alignItems: 'center', borderRadius: radius.md, flex: 1, minWidth: 0, paddingVertical: 3 },
  navIconWrap: { alignItems: 'center', borderRadius: radius.round, height: 28, justifyContent: 'center', minWidth: 42, paddingHorizontal: 9 },
  navIcon: { fontSize: 16, fontWeight: '900' },
  navLabel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  progressTrack: { borderRadius: radius.round, height: 7, overflow: 'hidden' },
  progressFill: { borderRadius: radius.round, height: '100%' },
});
