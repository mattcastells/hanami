import { WordPracticeEntry } from '../../data/wordVocabulary';
import { AnswerState, GameStats } from './gameEngine';

// Dictado: se reproduce una palabra en japonés (TTS) y el usuario escribe lo que oyó.
// Se acepta la lectura en romaji (lo más cómodo de tipear) o directamente el kana.

export type DictationRound = {
  word: WordPracticeEntry;
  acceptedAnswers: string[];
  roundKey: string;
};

export type DictationSessionState = {
  round: DictationRound;
  answerState: AnswerState;
  inputValue: string;
  stats: GameStats;
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function normalizeDictationInput(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function buildAcceptedAnswers(word: WordPracticeEntry): string[] {
  // romaji (sílabas unidas) + kana; ambos normalizados.
  return [
    normalizeDictationInput(word.syllables.join('')),
    normalizeDictationInput(word.kana),
  ];
}

export function createDictationRound(
  pool: WordPracticeEntry[],
  previousRoundKey?: string,
): DictationRound {
  const promptPool =
    previousRoundKey && pool.length > 1
      ? pool.filter((entry) => entry.id !== previousRoundKey)
      : pool;

  const word = pickRandom(promptPool);
  return {
    word,
    acceptedAnswers: buildAcceptedAnswers(word),
    roundKey: word.id,
  };
}

export function createInitialDictationState(
  pool: WordPracticeEntry[],
): DictationSessionState {
  return {
    round: createDictationRound(pool),
    answerState: 'idle',
    inputValue: '',
    stats: { correct: 0, incorrect: 0, streak: 0, answered: 0 },
  };
}

export function updateDictationInput(
  state: DictationSessionState,
  inputValue: string,
): DictationSessionState {
  if (state.answerState !== 'idle') return state;
  return { ...state, inputValue };
}

export function submitDictationAnswer(
  state: DictationSessionState,
  rawInput?: string,
): DictationSessionState {
  if (state.answerState !== 'idle') return state;

  const submitted = normalizeDictationInput(rawInput ?? state.inputValue);
  if (!submitted) return state;

  const isCorrect = state.round.acceptedAnswers.includes(submitted);

  return {
    ...state,
    inputValue: '',
    answerState: isCorrect ? 'correct' : 'incorrect',
    stats: {
      correct: state.stats.correct + (isCorrect ? 1 : 0),
      incorrect: state.stats.incorrect + (isCorrect ? 0 : 1),
      streak: isCorrect ? state.stats.streak + 1 : 0,
      answered: state.stats.answered + 1,
    },
  };
}

export function moveToNextDictationRound(
  state: DictationSessionState,
  pool: WordPracticeEntry[],
): DictationSessionState {
  return {
    ...state,
    round: createDictationRound(pool, state.round.roundKey),
    answerState: 'idle',
    inputValue: '',
  };
}
