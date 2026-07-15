import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { FeedbackBanner } from '../components/game/FeedbackBanner';
import { AppText } from '../components/ui/AppText';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { StatPill } from '../components/ui/StatPill';
import { getKanaWordEntries } from '../data/kana';
import { normalizeDictationInput } from '../features/game/dictationGameEngine';
import { useDictationGame } from '../features/game/useDictationGame';
import { useTrackProgress } from '../features/progress/useTrackProgress';
import { speakJapanese } from '../features/speech/speak';
import { useAppTheme } from '../theme/AppThemeProvider';
import { hexToRgba, theme } from '../theme/theme';
import { RootStackScreenProps } from '../types/navigation';

const SUCCESS_COLOR = '#3E7D5C';
const ERROR_COLOR = '#B03A2E';
const STREAK_COLOR = '#356E8E';

export function DictationGameScreen(_: RootStackScreenProps<'DictationGame'>) {
  const { theme: activeTheme } = useAppTheme();
  const pool = useMemo(() => getKanaWordEntries('mixed'), []);
  const resetKey = 'dictation';
  const { state, setInputValue, submit, next, lastFeedback } = useDictationGame(
    pool,
    resetKey,
  );
  useTrackProgress('dictation', state.stats);
  const inputRef = useRef<TextInput>(null);

  // Reproduce la palabra al entrar a cada ronda y enfoca el input.
  useEffect(() => {
    speakJapanese(state.round.word.kana);
    const focusTimeout = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(focusTimeout);
  }, [state.round.roundKey, state.round.word.kana]);

  const answered = state.answerState !== 'idle';
  const canSubmit =
    !answered && normalizeDictationInput(state.inputValue).length > 0;

  return (
    <ScreenBackground scrollable keyboardShouldPersistTaps="handled">
      <ScreenHeader eyebrow="聴 · Dictado" title="Escuchá y escribí" />

      <View style={styles.statsRow}>
        <StatPill label="Aciertos" value={state.stats.correct} accentColor={SUCCESS_COLOR} />
        <StatPill label="Fallidos" value={state.stats.incorrect} accentColor={ERROR_COLOR} />
        <StatPill label="Racha" value={state.stats.streak} accentColor={STREAK_COLOR} />
      </View>

      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <Pressable
          onPress={() => speakJapanese(state.round.word.kana)}
          style={({ pressed }) => [
            styles.listenButton,
            {
              borderColor: hexToRgba(activeTheme.colors.accent, 0.4),
              backgroundColor: hexToRgba(activeTheme.colors.accent, 0.1),
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="volume-high"
            size={44}
            color={activeTheme.colors.accent}
          />
        </Pressable>
        <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
          {answered ? 'Escuchá de nuevo' : 'Tocá para escuchar'}
        </AppText>

        {answered ? (
          <View style={styles.revealBlock}>
            <AppText variant="kana" style={styles.revealKana}>
              {state.round.word.kana}
            </AppText>
            <AppText variant="bodySmall" color={activeTheme.colors.textSecondary}>
              {state.round.word.syllables.join('')} · {lastFeedback.translationText}
            </AppText>
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.feedbackSlot}>
        <FeedbackBanner
          status={lastFeedback.status}
          correctText={lastFeedback.correctText}
          selectedText={lastFeedback.selectedText}
        />
      </View>

      <View style={styles.inputSection}>
        <View
          style={[
            styles.inputUnderline,
            { borderBottomColor: hexToRgba(activeTheme.colors.textPrimary, 0.38) },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={state.inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={(event) => {
              if (answered) next();
              else submit(event.nativeEvent.text);
            }}
            editable={!answered}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            returnKeyType="done"
            maxLength={24}
            placeholder="Escribí lo que oíste (romaji)"
            placeholderTextColor={activeTheme.colors.textMuted}
            selectionColor={activeTheme.colors.accent}
            style={[styles.input, { color: activeTheme.colors.textPrimary }]}
          />
        </View>

        <PrimaryButton
          title={answered ? 'SIGUIENTE' : 'ENVIAR'}
          variant="primary"
          size="compact"
          disabled={!answered && !canSubmit}
          onPress={() => (answered ? next() : submit(state.inputValue))}
          style={styles.submitButton}
        />
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
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  listenButton: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealBlock: {
    alignItems: 'center',
    gap: 2,
    marginTop: theme.spacing.xs,
  },
  revealKana: {
    fontSize: 40,
    lineHeight: 50,
  },
  feedbackSlot: {
    minHeight: 44,
    marginBottom: theme.spacing.xs,
  },
  inputSection: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  inputUnderline: {
    minWidth: 200,
    maxWidth: '88%',
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  input: {
    fontFamily: 'ZenKakuGothicNew_500Medium',
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    paddingVertical: 0,
    minHeight: 36,
  },
  submitButton: {
    marginTop: theme.spacing.lg,
    minWidth: 180,
  },
});
