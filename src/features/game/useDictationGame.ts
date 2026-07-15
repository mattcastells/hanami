import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { WordPracticeEntry } from '../../data/wordVocabulary';
import { useAppSettings } from '../../settings/AppSettingsProvider';
import {
  createInitialDictationState,
  DictationSessionState,
  moveToNextDictationRound,
  submitDictationAnswer,
  updateDictationInput,
} from './dictationGameEngine';

export function useDictationGame(pool: WordPracticeEntry[], resetKey: string) {
  const {
    settings: { hapticsEnabled },
  } = useAppSettings();
  const [state, setState] = useState<DictationSessionState>(() =>
    createInitialDictationState(pool),
  );
  const stateRef = useRef(state);
  const [lastFeedback, setLastFeedback] = useState<{
    status: DictationSessionState['answerState'];
    correctText: string;
    selectedText?: string | null;
    translationText?: string;
  }>({ status: 'idle', correctText: '', selectedText: null });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const initial = createInitialDictationState(pool);
    stateRef.current = initial;
    setState(initial);
    setLastFeedback({ status: 'idle', correctText: '', selectedText: null });
  }, [pool, resetKey]);

  const setInputValue = (value: string) => {
    setState((current) => {
      const next = updateDictationInput(current, value);
      stateRef.current = next;
      return next;
    });
  };

  const submit = (rawInput?: string) => {
    const current = stateRef.current;
    const submitted = submitDictationAnswer(current, rawInput);
    if (submitted === current) return;

    const typed = (rawInput ?? current.inputValue).trim();
    stateRef.current = submitted;
    setState(submitted);
    setLastFeedback({
      status: submitted.answerState,
      correctText: current.round.word.kana,
      selectedText: typed,
      translationText: current.round.word.translations[0] ?? '',
    });

    if (hapticsEnabled) {
      void Haptics.notificationAsync(
        submitted.answerState === 'correct'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    }
  };

  const next = () => {
    const current = stateRef.current;
    if (current.answerState === 'idle') return;
    const nextState = moveToNextDictationRound(current, pool);
    stateRef.current = nextState;
    setState(nextState);
    setLastFeedback({ status: 'idle', correctText: '', selectedText: null });
  };

  return { state, setInputValue, submit, next, lastFeedback };
}
