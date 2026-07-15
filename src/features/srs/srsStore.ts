import { getKanaGroups } from '../../data/kana';
import { hiraganaWordEntries, katakanaWordEntries } from '../../data/wordVocabulary';
import { localDayString } from '../progress/progressStore';

// Repaso espaciado (SRS) tipo Leitner, autocontenido: el mazo son todos los kana y el
// vocabulario. Cada ítem tiene una "caja" (box) que define cuándo vuelve a aparecer.
// La revisión es flashcard: se muestra el frente, se revela el dorso y el usuario se
// autoevalúa (lo sabía / no lo sabía).

export type SrsKind = 'kana' | 'word';

export type SrsItem = {
  key: string;
  kind: SrsKind;
  front: string; // japonés (kana) — también lo que se lee en voz alta
  back: string; // lectura / significado
};

export type SrsItemState = {
  box: number;
  dueDay: string; // YYYY-MM-DD
  reviews: number;
};

export type SrsData = {
  version: 1;
  states: Record<string, SrsItemState>;
};

export const SRS_VERSION = 1 as const;

// Intervalos por caja (días). Caja 0 = vuelve al toque (próxima sesión).
const INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
const MAX_BOX = INTERVALS_DAYS.length - 1;

export const SRS_NEW_PER_SESSION = 10;
export const SRS_DUE_CAP = 40;

export function createEmptySrs(): SrsData {
  return { version: SRS_VERSION, states: {} };
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return localDayString(date);
}

// Construye el mazo completo (kana de ambos silabarios + vocabulario).
export function buildSrsDeck(): SrsItem[] {
  const deck: SrsItem[] = [];

  (['hiragana', 'katakana'] as const).forEach((script) => {
    getKanaGroups(script).forEach((group) => {
      group.characters.forEach((character) => {
        deck.push({
          key: `kana:${character.kana}`,
          kind: 'kana',
          front: character.kana,
          back: character.romaji,
        });
      });
    });
  });

  [...hiraganaWordEntries, ...katakanaWordEntries].forEach((entry) => {
    deck.push({
      key: `word:${entry.id}`,
      kind: 'word',
      front: entry.kana,
      back: `${entry.syllables.join('')} · ${entry.translations[0] ?? ''}`,
    });
  });

  return deck;
}

export type SrsCounts = { due: number; fresh: number };

export function countQueue(
  deck: SrsItem[],
  states: Record<string, SrsItemState>,
  today: string,
): SrsCounts {
  let due = 0;
  let fresh = 0;
  deck.forEach((item) => {
    const state = states[item.key];
    if (!state) fresh += 1;
    else if (state.dueDay <= today) due += 1;
  });
  return { due, fresh };
}

// Cola de la sesión: primero los vencidos (cap), después ítems nuevos (cap).
export function selectQueue(
  deck: SrsItem[],
  states: Record<string, SrsItemState>,
  today: string,
  newLimit = SRS_NEW_PER_SESSION,
  dueLimit = SRS_DUE_CAP,
): SrsItem[] {
  const due: SrsItem[] = [];
  const fresh: SrsItem[] = [];
  deck.forEach((item) => {
    const state = states[item.key];
    if (!state) fresh.push(item);
    else if (state.dueDay <= today) due.push(item);
  });
  return [
    ...shuffle(due).slice(0, dueLimit),
    ...shuffle(fresh).slice(0, newLimit),
  ];
}

// Calcula el próximo estado de un ítem tras autoevaluarse.
export function reviewItem(
  previous: SrsItemState | undefined,
  known: boolean,
  today: string,
): SrsItemState {
  const previousBox = previous?.box ?? -1; // -1 = nuevo
  const nextBox = known ? Math.min(Math.max(previousBox, 0) + 1, MAX_BOX) : 0;
  return {
    box: nextBox,
    dueDay: addDays(today, INTERVALS_DAYS[nextBox]),
    reviews: (previous?.reviews ?? 0) + 1,
  };
}

export function normalizeSrs(value: unknown): SrsData {
  if (!value || typeof value !== 'object') return createEmptySrs();
  const candidate = value as Record<string, unknown>;
  const statesRaw =
    candidate.states && typeof candidate.states === 'object'
      ? (candidate.states as Record<string, unknown>)
      : {};

  const states: Record<string, SrsItemState> = {};
  Object.keys(statesRaw).forEach((key) => {
    const entry = statesRaw[key] as Record<string, unknown>;
    if (!entry || typeof entry !== 'object') return;
    const box = typeof entry.box === 'number' ? entry.box : 0;
    const dueDay = typeof entry.dueDay === 'string' ? entry.dueDay : '';
    const reviews = typeof entry.reviews === 'number' ? entry.reviews : 0;
    if (!dueDay) return;
    states[key] = { box, dueDay, reviews };
  });

  return { version: SRS_VERSION, states };
}
