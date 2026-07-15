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

import { ThemeMode } from '../theme/theme';

type AppSettings = {
  hapticsEnabled: boolean;
  themeMode: ThemeMode;
  // API key propia de Gemini (BYOK). Si está vacía, Kyary usa la embebida en el bundle.
  geminiApiKey: string;
  // Recordatorio diario (notificación local).
  reminderEnabled: boolean;
  reminderHour: number; // 0-23
};

type AppSettingsContextValue = {
  settings: AppSettings;
  setHapticsEnabled: (enabled: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setGeminiApiKey: (key: string) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderHour: (hour: number) => void;
};

const DEFAULT_SETTINGS: AppSettings = {
  hapticsEnabled: false,
  themeMode: 'light',
  geminiApiKey: '',
  reminderEnabled: false,
  reminderHour: 20,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  // True once the user changes a setting. Guards against the load-vs-write race
  // and marks which state changes are worth persisting.
  const userTouchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const settingsFile = getSettingsFile();

        if (!settingsFile.exists) {
          return;
        }

        const fileContents = await settingsFile.text();
        const parsed = JSON.parse(fileContents);

        // If the user already toggled something while we were reading the file,
        // don't clobber their choice with the stale on-disk value.
        if (!cancelled && !userTouchedRef.current) {
          setSettings(normalizeSettings(parsed));
        }
      } catch {
        // Keep the in-memory defaults on any read/parse failure.
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist only user-initiated changes; never the default or the value we just
  // loaded from disk. Runs outside the setState updater so updaters stay pure.
  useEffect(() => {
    if (!userTouchedRef.current) {
      return;
    }

    void persistSettings(settings);
  }, [settings]);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    userTouchedRef.current = true;
    setSettings((currentSettings) => ({
      ...currentSettings,
      hapticsEnabled: enabled,
    }));
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    userTouchedRef.current = true;
    setSettings((currentSettings) => ({
      ...currentSettings,
      themeMode: mode,
    }));
  }, []);

  const setGeminiApiKey = useCallback((key: string) => {
    userTouchedRef.current = true;
    setSettings((currentSettings) => ({
      ...currentSettings,
      geminiApiKey: key,
    }));
  }, []);

  const setReminderEnabled = useCallback((enabled: boolean) => {
    userTouchedRef.current = true;
    setSettings((currentSettings) => ({
      ...currentSettings,
      reminderEnabled: enabled,
    }));
  }, []);

  const setReminderHour = useCallback((hour: number) => {
    userTouchedRef.current = true;
    setSettings((currentSettings) => ({
      ...currentSettings,
      reminderHour: hour,
    }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setHapticsEnabled,
      setThemeMode,
      setGeminiApiKey,
      setReminderEnabled,
      setReminderHour,
    }),
    [
      setGeminiApiKey,
      setHapticsEnabled,
      setReminderEnabled,
      setReminderHour,
      setThemeMode,
      settings,
    ],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }

  return context;
}

function getSettingsFile() {
  return new File(Paths.document, 'app-settings.json');
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const candidate = value as Partial<AppSettings>;

  const record = candidate as Record<string, unknown>;

  const reminderHour =
    typeof record.reminderHour === 'number' &&
    record.reminderHour >= 0 &&
    record.reminderHour <= 23
      ? Math.floor(record.reminderHour)
      : 20;

  return {
    hapticsEnabled: candidate.hapticsEnabled === true,
    themeMode: record.themeMode === 'dark' ? 'dark' : 'light',
    geminiApiKey:
      typeof record.geminiApiKey === 'string' ? record.geminiApiKey : '',
    reminderEnabled: record.reminderEnabled === true,
    reminderHour,
  };
}

async function persistSettings(settings: AppSettings) {
  try {
    const settingsFile = getSettingsFile();
    settingsFile.create({ intermediates: true, overwrite: true });
    settingsFile.write(JSON.stringify(settings), { encoding: 'utf8' });
  } catch {
    // Ignore persistence failures and keep the in-memory setting.
  }
}
