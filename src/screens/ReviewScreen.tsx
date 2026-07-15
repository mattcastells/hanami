import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/ui/AppText';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SpeakButton } from '../components/ui/SpeakButton';
import { StatPill } from '../components/ui/StatPill';
import { useSrs } from '../features/srs/SrsProvider';
import {
  buildSrsDeck,
  countQueue,
  selectQueue,
  SrsItem,
} from '../features/srs/srsStore';
import { localDayString } from '../features/progress/progressStore';
import { useAppTheme } from '../theme/AppThemeProvider';
import { theme } from '../theme/theme';
import { RootStackScreenProps } from '../types/navigation';

const SUCCESS_COLOR = '#3E7D5C';
const ERROR_COLOR = '#B03A2E';

type Phase = 'intro' | 'review' | 'done';

export function ReviewScreen({ navigation }: RootStackScreenProps<'Review'>) {
  const { theme: activeTheme } = useAppTheme();
  const { data, recordReview } = useSrs();
  const deck = useMemo(() => buildSrsDeck(), []);
  const today = localDayString(new Date());

  const [phase, setPhase] = useState<Phase>('intro');
  const [queue, setQueue] = useState<SrsItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  const counts = useMemo(
    () => countQueue(deck, data.states, today),
    // Solo importa en la intro; se congela al empezar la sesión.
    [deck, data.states, today],
  );

  const startReview = () => {
    const nextQueue = selectQueue(deck, data.states, today);
    if (nextQueue.length === 0) return;
    setQueue(nextQueue);
    setIndex(0);
    setRevealed(false);
    setKnownCount(0);
    setPhase('review');
  };

  const grade = (known: boolean) => {
    const item = queue[index];
    if (!item) return;
    recordReview(item.key, known);
    if (known) setKnownCount((current) => current + 1);

    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      setPhase('done');
    } else {
      setIndex(nextIndex);
      setRevealed(false);
    }
  };

  if (phase === 'intro') {
    const nothingToDo = counts.due === 0 && counts.fresh === 0;
    return (
      <ScreenBackground scrollable={false}>
        <ScreenHeader eyebrow="復習 · Repaso" title="Repaso espaciado" />
        <GlassCard contentStyle={styles.introContent}>
          <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
            El repaso te muestra lo que ya viste cuando toca volver a verlo, más
            algunas cosas nuevas. Te autoevaluás con cada tarjeta.
          </AppText>
          <View style={styles.statsRow}>
            <StatPill label="Para repasar" value={counts.due} accentColor={activeTheme.colors.accent} />
            <StatPill label="Nuevas" value={Math.min(counts.fresh, 10)} accentColor={SUCCESS_COLOR} />
          </View>
          {nothingToDo ? (
            <AppText variant="body" color={activeTheme.colors.textSecondary} style={styles.centered}>
              ¡Estás al día! Volvé más tarde. (◕‿◕)
            </AppText>
          ) : (
            <PrimaryButton title="EMPEZAR REPASO" size="compact" onPress={startReview} />
          )}
        </GlassCard>
      </ScreenBackground>
    );
  }

  if (phase === 'done') {
    return (
      <ScreenBackground scrollable={false}>
        <ScreenHeader eyebrow="復習 · Repaso" title="Repaso terminado" />
        <GlassCard contentStyle={styles.introContent}>
          <AppText variant="display" style={styles.centered}>
            お疲れさま
          </AppText>
          <View style={styles.statsRow}>
            <StatPill label="Repasadas" value={queue.length} accentColor={activeTheme.colors.accent} />
            <StatPill label="Las sabías" value={knownCount} accentColor={SUCCESS_COLOR} />
          </View>
          <View style={styles.doneActions}>
            <PrimaryButton
              title="OTRO REPASO"
              size="compact"
              onPress={startReview}
              style={styles.doneButton}
            />
            <PrimaryButton
              title="VOLVER"
              variant="ghost"
              size="compact"
              onPress={() => navigation.goBack()}
              style={styles.doneButton}
            />
          </View>
        </GlassCard>
      </ScreenBackground>
    );
  }

  const item = queue[index];

  return (
    <ScreenBackground scrollable={false}>
      <ScreenHeader
        eyebrow="復習 · Repaso"
        title={`${index + 1} / ${queue.length}`}
      />

      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <SpeakButton text={item.front} style={styles.speakCorner} />
        <AppText variant="kana" style={styles.front}>
          {item.front}
        </AppText>

        {revealed ? (
          <AppText
            variant="body"
            color={activeTheme.colors.textSecondary}
            style={styles.back}
          >
            {item.back}
          </AppText>
        ) : (
          <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
            ¿Te acordás?
          </AppText>
        )}
      </GlassCard>

      {revealed ? (
        <View style={styles.gradeRow}>
          <PrimaryButton
            title="NO SABÍA"
            variant="secondary"
            size="compact"
            onPress={() => grade(false)}
            style={styles.gradeButton}
          />
          <PrimaryButton
            title="SÍ SABÍA"
            variant="primary"
            size="compact"
            onPress={() => grade(true)}
            style={styles.gradeButton}
          />
        </View>
      ) : (
        <PrimaryButton
          title="MOSTRAR"
          variant="primary"
          size="compact"
          onPress={() => setRevealed(true)}
          style={styles.showButton}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  introContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  centered: {
    textAlign: 'center',
  },
  card: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  cardContent: {
    padding: theme.spacing.xl,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  speakCorner: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    zIndex: 2,
  },
  front: {
    fontSize: 56,
    lineHeight: 68,
    textAlign: 'center',
  },
  back: {
    textAlign: 'center',
    lineHeight: 24,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  gradeButton: {
    flex: 1,
  },
  showButton: {
    width: '100%',
  },
  doneActions: {
    gap: theme.spacing.sm,
  },
  doneButton: {
    width: '100%',
  },
});
