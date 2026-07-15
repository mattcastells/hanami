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

import { localDayString } from '../progress/progressStore';
import {
  SrsData,
  createEmptySrs,
  normalizeSrs,
  reviewItem,
} from './srsStore';

type SrsContextValue = {
  data: SrsData;
  recordReview: (key: string, known: boolean) => void;
};

const SrsContext = createContext<SrsContextValue | null>(null);

export function SrsProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<SrsData>(createEmptySrs);
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const file = getSrsFile();
        if (file.exists) {
          const parsed = JSON.parse(await file.text());
          if (!cancelled && !dirtyRef.current) {
            setData(normalizeSrs(parsed));
          }
        }
      } catch {
        // defaults en memoria
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
    if (!hydratedRef.current) return;
    void persistSrs(data);
  }, [data]);

  const recordReview = useCallback((key: string, known: boolean) => {
    dirtyRef.current = true;
    const today = localDayString(new Date());
    setData((current) => ({
      version: current.version,
      states: {
        ...current.states,
        [key]: reviewItem(current.states[key], known, today),
      },
    }));
  }, []);

  const value = useMemo(() => ({ data, recordReview }), [data, recordReview]);

  return <SrsContext.Provider value={value}>{children}</SrsContext.Provider>;
}

export function useSrs() {
  const context = useContext(SrsContext);
  if (!context) {
    throw new Error('useSrs must be used within SrsProvider');
  }
  return context;
}

function getSrsFile() {
  return new File(Paths.document, 'srs.json');
}

async function persistSrs(data: SrsData) {
  try {
    const file = getSrsFile();
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(data), { encoding: 'utf8' });
  } catch {
    // Ignorar fallos de persistencia.
  }
}
