import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { AppText } from '../components/ui/AppText';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { StatPill } from '../components/ui/StatPill';
import { SpeakButton } from '../components/ui/SpeakButton';
import { getKanaWordEntries } from '../data/kana';
import { WordPracticeEntry } from '../data/wordVocabulary';
import { GameStats } from '../features/game/gameEngine';
import {
  comparePronunciation,
  PronunciationResult,
} from '../features/game/pronunciation';
import { useTrackProgress } from '../features/progress/useTrackProgress';
import { useAppTheme } from '../theme/AppThemeProvider';
import { hexToRgba, theme } from '../theme/theme';
import { RootStackScreenProps } from '../types/navigation';

const SUCCESS_COLOR = '#3E7D5C';
const ERROR_COLOR = '#B03A2E';
const STREAK_COLOR = '#356E8E';

type Phase = 'idle' | 'listening' | 'result';

function pickWord(pool: WordPracticeEntry[], previousId?: string) {
  const candidates =
    previousId && pool.length > 1
      ? pool.filter((entry) => entry.id !== previousId)
      : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const EMPTY_STATS: GameStats = { correct: 0, incorrect: 0, streak: 0, answered: 0 };

export function PronunciationGameScreen(
  _: RootStackScreenProps<'PronunciationGame'>,
) {
  const { theme: activeTheme } = useAppTheme();
  const pool = useMemo(() => getKanaWordEntries('mixed'), []);

  const [word, setWord] = useState<WordPracticeEntry>(() => pickWord(pool));
  const [phase, setPhase] = useState<Phase>('idle');
  const [interim, setInterim] = useState('');
  const [heard, setHeard] = useState('');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [errorText, setErrorText] = useState<string | null>(null);

  useTrackProgress('pronunciation', stats);

  const phaseRef = useRef<Phase>('idle');
  const expectedRef = useRef(word.kana);
  const setPhaseSafe = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  useEffect(() => {
    expectedRef.current = word.kana;
  }, [word]);

  const stopRecognition = () => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // no-op
    }
  };

  const startSpeaking = async () => {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setErrorText('Se necesita permiso de micrófono.');
      return;
    }
    setErrorText(null);
    setInterim('');
    setHeard('');
    setResult(null);
    setPhaseSafe('listening');
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'ja-JP',
        interimResults: true,
        continuous: false,
      });
    } catch {
      setPhaseSafe('idle');
      setErrorText('No se pudo iniciar el reconocimiento de voz.');
    }
  };

  const evaluate = (transcript: string) => {
    const verdict = comparePronunciation(expectedRef.current, transcript);
    setHeard(transcript);
    setResult(verdict);
    setPhaseSafe('result');
    const ok = verdict === 'correct' || verdict === 'close';
    setStats((current) => ({
      correct: current.correct + (ok ? 1 : 0),
      incorrect: current.incorrect + (ok ? 0 : 1),
      streak: ok ? current.streak + 1 : 0,
      answered: current.answered + 1,
    }));
  };

  const nextWord = () => {
    stopRecognition();
    setInterim('');
    setHeard('');
    setResult(null);
    setPhaseSafe('idle');
    setWord((current) => pickWord(pool, current.id));
  };

  useSpeechRecognitionEvent('result', (event) => {
    if (phaseRef.current !== 'listening') return;
    const transcript = event.results[0]?.transcript ?? '';
    if (!event.isFinal) {
      setInterim(transcript);
      return;
    }
    setInterim('');
    evaluate(transcript);
  });

  useSpeechRecognitionEvent('end', () => {
    // Terminó sin resultado final (silencio): volver a idle para reintentar.
    if (phaseRef.current === 'listening') {
      setPhaseSafe('idle');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (phaseRef.current !== 'listening') return;
    setPhaseSafe('idle');
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setErrorText('No hay permiso o servicio de reconocimiento de voz.');
    } else if (event.error === 'no-speech') {
      setErrorText('No te escuché. Probá de nuevo.');
    }
  });

  useFocusEffect(
    useCallback(() => {
      return () => stopRecognition();
    }, []),
  );

  const resultColor =
    result === 'correct'
      ? SUCCESS_COLOR
      : result === 'close'
        ? STREAK_COLOR
        : ERROR_COLOR;
  const resultLabel =
    result === 'correct'
      ? '¡Perfecto!'
      : result === 'close'
        ? 'Casi'
        : 'Probá de nuevo';

  return (
    <ScreenBackground scrollable={false}>
      <ScreenHeader eyebrow="発 · Pronunciación" title="Decilo en voz alta" />

      <View style={styles.statsRow}>
        <StatPill label="Bien" value={stats.correct} accentColor={SUCCESS_COLOR} />
        <StatPill label="Mal" value={stats.incorrect} accentColor={ERROR_COLOR} />
        <StatPill label="Racha" value={stats.streak} accentColor={STREAK_COLOR} />
      </View>

      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <SpeakButton text={word.kana} style={styles.speakCorner} />
        <AppText variant="kana" style={styles.wordKana}>
          {word.kana}
        </AppText>
        <AppText variant="bodySmall" color={activeTheme.colors.textSecondary}>
          {word.syllables.join('')} · {word.translations[0]}
        </AppText>

        {phase === 'listening' ? (
          <AppText
            variant="body"
            color={activeTheme.colors.accent}
            style={styles.statusLine}
          >
            Escuchando... {interim ? `“${interim}”` : ''}
          </AppText>
        ) : phase === 'result' ? (
          <View style={styles.resultBlock}>
            <AppText variant="title" color={resultColor}>
              {resultLabel}
            </AppText>
            <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
              Escuché: {heard || '—'}
            </AppText>
          </View>
        ) : (
          <View style={styles.resultBlock} />
        )}
      </GlassCard>

      {errorText ? (
        <AppText
          variant="bodySmall"
          color={activeTheme.colors.error}
          style={styles.errorText}
        >
          {errorText}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {phase === 'result' ? (
          <PrimaryButton
            title="SIGUIENTE"
            variant="primary"
            size="compact"
            onPress={nextWord}
            style={styles.actionButton}
          />
        ) : (
          <PrimaryButton
            title={phase === 'listening' ? 'ESCUCHANDO...' : 'HABLAR'}
            variant="primary"
            size="compact"
            icon={
              <MaterialCommunityIcons
                name="microphone"
                size={18}
                color={activeTheme.colors.white}
              />
            }
            disabled={phase === 'listening'}
            onPress={() => void startSpeaking()}
            style={styles.actionButton}
          />
        )}
        {phase === 'result' ? (
          <Pressable onPress={() => void startSpeaking()} hitSlop={8} style={styles.retry}>
            <AppText variant="label" color={activeTheme.colors.textSecondary}>
              REINTENTAR
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  speakCorner: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    zIndex: 2,
  },
  wordKana: {
    fontSize: 52,
    lineHeight: 64,
    textAlign: 'center',
  },
  statusLine: {
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  resultBlock: {
    marginTop: theme.spacing.sm,
    minHeight: 48,
    alignItems: 'center',
    gap: 2,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  actions: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionButton: {
    minWidth: 200,
  },
  retry: {
    paddingVertical: theme.spacing.xs,
  },
});
