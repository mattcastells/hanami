import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { StreakCard } from '../components/progress/StreakCard';
import { AppText } from '../components/ui/AppText';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { KANJI_LIST } from '../data/kanji';
import { useAppTheme } from '../theme/AppThemeProvider';
import { theme } from '../theme/theme';
import { KanaScript } from '../types/game';
import { RootStackScreenProps } from '../types/navigation';

type HomeRow = {
  glyph: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

const WEEKDAY_KANJI = ['日', '月', '火', '水', '木', '金', '土'];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((current - start) / 86_400_000);
}

function greetingFor(hour: number) {
  if (hour < 5) return { jp: 'こんばんは', es: 'Buenas noches' };
  if (hour < 12) return { jp: 'おはよう', es: 'Buenos días' };
  if (hour < 14) return { jp: 'こんにちは', es: 'Buen mediodía' };
  if (hour < 19) return { jp: 'こんにちは', es: 'Buenas tardes' };
  return { jp: 'こんばんは', es: 'Buenas noches' };
}

// Day + time written in kanji/hiragana for reading practice, e.g. 水曜日・午後3時5分.
function japaneseDateTime(date: Date): string {
  const day = `${WEEKDAY_KANJI[date.getDay()]}曜日`;
  const hours = date.getHours();
  const period = hours < 12 ? '午前' : '午後';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = date.getMinutes();
  return `${day}・${period}${hour12}時${minutes}分`;
}

// Entrada escalonada: fade + translateY 8->0, 120ms, stagger 30ms por fila.
function AnimatedRow({ index, children }: { index: number; children: React.ReactNode }) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 120,
      delay: index * 30,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function HomeScreen({ navigation }: RootStackScreenProps<'Home'>) {
  const { theme: activeTheme } = useAppTheme();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const greeting = greetingFor(now.getHours());
  const dateTimeJp = japaneseDateTime(now);
  const kanjiOfDay = KANJI_LIST[dayOfYear(now) % KANJI_LIST.length];

  const goToKana = (script: KanaScript) =>
    navigation.navigate('KanaGroups', { script });

  const rows: HomeRow[] = [
    {
      glyph: '復',
      title: 'Repasar',
      subtitle: 'Repaso espaciado del día',
      onPress: () => navigation.navigate('Review'),
    },
    {
      glyph: 'あ',
      title: 'Hiragana',
      subtitle: 'Silabario básico',
      onPress: () => goToKana('hiragana'),
    },
    {
      glyph: 'ア',
      title: 'Katakana',
      subtitle: 'Extranjerismos',
      onPress: () => goToKana('katakana'),
    },
    {
      glyph: '混',
      title: 'Hiragana + Katakana',
      subtitle: 'Ambos silabarios mezclados',
      onPress: () => goToKana('mixed'),
    },
    {
      glyph: '漢',
      title: 'Kanji',
      subtitle: 'Ideogramas',
      onPress: () => navigation.navigate('KanjiHub'),
    },
    {
      glyph: '語',
      title: 'Vocabulario',
      subtitle: 'Palabra guiada, completar, constructor',
      onPress: () => navigation.navigate('Vocabulary'),
    },
    {
      glyph: '絵',
      title: 'Imágenes',
      subtitle: 'Matcheá palabra con imagen',
      onPress: () => navigation.navigate('EmojiGame', { script: 'mixed' }),
    },
    {
      glyph: '時',
      title: 'Horarios',
      subtitle: 'Leer y escribir la hora',
      onPress: () => navigation.navigate('TimesGame'),
    },
    {
      glyph: '聴',
      title: 'Dictado',
      subtitle: 'Escuchá y escribí lo que oís',
      onPress: () => navigation.navigate('DictationGame'),
    },
    {
      glyph: '発',
      title: 'Pronunciación',
      subtitle: 'Hablá y recibí feedback',
      onPress: () => navigation.navigate('PronunciationGame'),
    },
  ];

  return (
    <ScreenBackground scrollable>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AppText variant="overline" color={activeTheme.colors.textMuted}>
            日本語
          </AppText>
          <AppText variant="bodySmall" color={activeTheme.colors.textSecondary}>
            {dateTimeJp}
          </AppText>
        </View>
        <AppText variant="display">{greeting.jp}</AppText>
        <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
          {greeting.es}
        </AppText>
      </View>

      <StreakCard />

      <View style={styles.list}>
        {rows.map((row, index) => (
          <AnimatedRow key={row.title} index={index}>
            <Pressable
              onPress={row.onPress}
              style={({ pressed }) => [
                styles.row,
                { borderTopColor: activeTheme.colors.line },
                index === rows.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: activeTheme.colors.line,
                },
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant="headline"
                style={[styles.glyph, { color: activeTheme.colors.accent }]}
              >
                {row.glyph}
              </AppText>
              <View style={styles.rowText}>
                <AppText variant="bodyStrong">{row.title}</AppText>
                <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
                  {row.subtitle}
                </AppText>
              </View>
              <AppText variant="body" color={activeTheme.colors.textMuted}>
                ›
              </AppText>
            </Pressable>
          </AnimatedRow>
        ))}
      </View>

      <Pressable
        onPress={() =>
          navigation.navigate('KanjiDraw', {
            categoryIds: [kanjiOfDay.category],
            kanjiId: kanjiOfDay.id,
          })
        }
        style={({ pressed }) => [
          styles.kanjiCard,
          {
            borderColor: activeTheme.colors.line,
            backgroundColor: activeTheme.colors.backgroundSecondary,
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.kanjiCardText}>
          <AppText variant="label" color={activeTheme.colors.textMuted}>
            KANJI DEL DÍA
          </AppText>
          <AppText variant="bodyStrong">{kanjiOfDay.meaning}</AppText>
          <AppText variant="bodySmall" color={activeTheme.colors.textSecondary}>
            {kanjiOfDay.readings.join(' · ')}
            {kanjiOfDay.example ? `  ·  ${kanjiOfDay.example}` : ''}
          </AppText>
        </View>
        <AppText style={[styles.kanjiGlyph, { color: activeTheme.colors.accent }]}>
          {kanjiOfDay.kanji}
        </AppText>
      </Pressable>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  list: {
    marginBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxs,
    borderTopWidth: 1,
    minHeight: 64,
  },
  glyph: {
    width: 32,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kanjiCard: {
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    overflow: 'hidden',
  },
  kanjiCardText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kanjiGlyph: {
    fontFamily: 'ZenOldMincho_700Bold',
    fontSize: 56,
    lineHeight: 62,
  },
  pressed: {
    opacity: 0.7,
  },
});
