// Modelo de progreso persistente (se guarda en el dispositivo, sin base de datos).
// La lógica es pura y testeable; el provider (ProgressProvider) orquesta estado y
// persistencia. Se serializa a JSON para poder exportar/importar entre dispositivos.

export type ProgressModeStats = {
  answered: number;
  correct: number;
  incorrect: number;
  bestStreak: number;
  sessions: number;
  lastPlayed: string | null;
};

export type DailyProgress = {
  lastActiveDate: string | null; // YYYY-MM-DD (local)
  currentStreak: number;
  bestStreak: number;
  todayCount: number; // rondas respondidas hoy
  dailyGoal: number; // meta de rondas por día
};

export type ProgressData = {
  version: 1;
  byMode: Record<string, ProgressModeStats>;
  daily: DailyProgress;
  updatedAt: string | null;
};

export const DEFAULT_DAILY_GOAL = 20;

export function createEmptyDaily(): DailyProgress {
  return {
    lastActiveDate: null,
    currentStreak: 0,
    bestStreak: 0,
    todayCount: 0,
    dailyGoal: DEFAULT_DAILY_GOAL,
  };
}

// Día local en formato YYYY-MM-DD.
export function localDayString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDifference(fromDay: string, toDay: string): number {
  const from = new Date(`${fromDay}T00:00:00`);
  const to = new Date(`${toDay}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// Actualiza la racha/meta con la actividad de hoy. Solo incrementa la racha una vez
// por día (en la primera actividad de un día nuevo).
export function applyDailyActivity(
  daily: DailyProgress,
  answered: number,
  today: string,
): DailyProgress {
  if (daily.lastActiveDate === today) {
    return { ...daily, todayCount: daily.todayCount + answered };
  }

  const gap =
    daily.lastActiveDate != null
      ? dayDifference(daily.lastActiveDate, today)
      : null;
  const nextStreak = gap === 1 ? daily.currentStreak + 1 : 1;

  return {
    ...daily,
    lastActiveDate: today,
    currentStreak: nextStreak,
    bestStreak: Math.max(daily.bestStreak, nextStreak),
    todayCount: answered,
  };
}

// Lo que aporta una sesión terminada (acumulado de esa partida).
export type SessionResult = {
  answered: number;
  correct: number;
  incorrect: number;
  bestStreak: number;
};

export const PROGRESS_VERSION = 1 as const;

// Etiquetas legibles por clave de modo (para la pantalla de progreso).
export const PROGRESS_MODE_LABELS: Record<string, string> = {
  reading: 'Lectura',
  writing: 'Escritura',
  drawing: 'Dibujo',
  syllables: 'Palabra guiada',
  'fill-blank': 'Completar',
  'word-builder': 'Constructor',
  phrases: 'Frases',
  kanji: 'Kanji',
  numbers: 'Números',
  times: 'Horarios',
  emoji: 'Imágenes',
  dictation: 'Dictado',
  pronunciation: 'Pronunciación',
};

export function getModeLabel(modeKey: string): string {
  return PROGRESS_MODE_LABELS[modeKey] ?? modeKey;
}

export function createEmptyProgress(): ProgressData {
  return {
    version: PROGRESS_VERSION,
    byMode: {},
    daily: createEmptyDaily(),
    updatedAt: null,
  };
}

function emptyModeStats(): ProgressModeStats {
  return {
    answered: 0,
    correct: 0,
    incorrect: 0,
    bestStreak: 0,
    sessions: 0,
    lastPlayed: null,
  };
}

// Suma una sesión al progreso existente devolviendo un objeto nuevo (inmutable).
export function applySession(
  current: ProgressData,
  modeKey: string,
  session: SessionResult,
  timestamp: string,
): ProgressData {
  const previous = current.byMode[modeKey] ?? emptyModeStats();

  return {
    version: PROGRESS_VERSION,
    updatedAt: timestamp,
    daily: current.daily,
    byMode: {
      ...current.byMode,
      [modeKey]: {
        answered: previous.answered + session.answered,
        correct: previous.correct + session.correct,
        incorrect: previous.incorrect + session.incorrect,
        bestStreak: Math.max(previous.bestStreak, session.bestStreak),
        sessions: previous.sessions + 1,
        lastPlayed: timestamp,
      },
    },
  };
}

// Totales agregados sobre todos los modos.
export function getTotals(data: ProgressData): ProgressModeStats {
  return Object.values(data.byMode).reduce<ProgressModeStats>((acc, stats) => {
    return {
      answered: acc.answered + stats.answered,
      correct: acc.correct + stats.correct,
      incorrect: acc.incorrect + stats.incorrect,
      bestStreak: Math.max(acc.bestStreak, stats.bestStreak),
      sessions: acc.sessions + stats.sessions,
      lastPlayed: mostRecent(acc.lastPlayed, stats.lastPlayed),
    };
  }, emptyModeStats());
}

function mostRecent(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function toStats(value: unknown): ProgressModeStats {
  const candidate = (value ?? {}) as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;

  return {
    answered: num(candidate.answered),
    correct: num(candidate.correct),
    incorrect: num(candidate.incorrect),
    bestStreak: num(candidate.bestStreak),
    sessions: num(candidate.sessions),
    lastPlayed:
      typeof candidate.lastPlayed === 'string' ? candidate.lastPlayed : null,
  };
}

// Endurece cualquier JSON (de disco o import) contra formas inválidas/legacy.
export function normalizeProgress(value: unknown): ProgressData {
  if (!value || typeof value !== 'object') {
    return createEmptyProgress();
  }

  const candidate = value as Record<string, unknown>;
  const byModeRaw =
    candidate.byMode && typeof candidate.byMode === 'object'
      ? (candidate.byMode as Record<string, unknown>)
      : {};

  const byMode: Record<string, ProgressModeStats> = {};
  Object.keys(byModeRaw).forEach((key) => {
    byMode[key] = toStats(byModeRaw[key]);
  });

  return {
    version: PROGRESS_VERSION,
    byMode,
    daily: toDaily(candidate.daily),
    updatedAt:
      typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
  };
}

function toDaily(value: unknown): DailyProgress {
  const candidate = (value ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

  return {
    lastActiveDate:
      typeof candidate.lastActiveDate === 'string'
        ? candidate.lastActiveDate
        : null,
    currentStreak: num(candidate.currentStreak),
    bestStreak: num(candidate.bestStreak),
    todayCount: num(candidate.todayCount),
    dailyGoal: num(candidate.dailyGoal, DEFAULT_DAILY_GOAL) || DEFAULT_DAILY_GOAL,
  };
}
