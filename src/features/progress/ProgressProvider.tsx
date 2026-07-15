import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { File, Paths } from 'expo-file-system';

import {
  ProgressData,
  SessionResult,
  applyDailyActivity,
  applySession,
  createEmptyProgress,
  localDayString,
  normalizeProgress,
} from './progressStore';

type ProgressContextValue = {
  data: ProgressData;
  recordSession: (modeKey: string, session: SessionResult) => void;
  setDailyGoal: (goal: number) => void;
  exportProgress: () => string;
  importProgress: (raw: string) => boolean;
  resetProgress: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<ProgressData>(createEmptyProgress);
  // True una vez que el usuario registró/importó algo: evita que la lectura tardía
  // del archivo pise datos ya generados en memoria.
  const dirtyRef = useRef(false);
  // True una vez cargado el archivo: recién ahí empezamos a persistir cambios.
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const file = getProgressFile();
        if (file.exists) {
          const contents = await file.text();
          const parsed = JSON.parse(contents);
          if (!cancelled && !dirtyRef.current) {
            setData(normalizeProgress(parsed));
          }
        }
      } catch {
        // Mantener los defaults en memoria ante cualquier fallo de lectura/parseo.
      } finally {
        hydratedRef.current = true;
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    void persistProgress(data);
  }, [data]);

  const recordSession = useCallback(
    (modeKey: string, session: SessionResult) => {
      dirtyRef.current = true;
      const now = new Date();
      const timestamp = now.toISOString();
      const today = localDayString(now);
      setData((current) => {
        const withSession = applySession(current, modeKey, session, timestamp);
        return {
          ...withSession,
          daily: applyDailyActivity(withSession.daily, session.answered, today),
        };
      });
    },
    [],
  );

  const setDailyGoal = useCallback((goal: number) => {
    dirtyRef.current = true;
    setData((current) => ({
      ...current,
      daily: { ...current.daily, dailyGoal: goal },
    }));
  }, []);

  const exportProgress = useCallback(() => JSON.stringify(data, null, 2), [data]);

  const importProgress = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeProgress(parsed);
      dirtyRef.current = true;
      hydratedRef.current = true;
      setData(normalized);
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetProgress = useCallback(() => {
    dirtyRef.current = true;
    hydratedRef.current = true;
    setData(createEmptyProgress());
  }, []);

  const value = useMemo(
    () => ({
      data,
      recordSession,
      setDailyGoal,
      exportProgress,
      importProgress,
      resetProgress,
    }),
    [data, recordSession, setDailyGoal, exportProgress, importProgress, resetProgress],
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);

  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }

  return context;
}

function getProgressFile() {
  return new File(Paths.document, 'progress.json');
}

async function persistProgress(data: ProgressData) {
  try {
    const file = getProgressFile();
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(data), { encoding: 'utf8' });
  } catch {
    // Ignorar fallos de persistencia y conservar el estado en memoria.
  }
}
