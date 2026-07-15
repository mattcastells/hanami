import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Recordatorio diario local (gratis, sin backend). Solo nativo: en web no se agenda.

// El tipo PermissionResponse no resuelve bien vía tsc en este setup, pero en runtime
// `granted`/`status` existen. Se lee con un cast seguro.
function isPermissionGranted(response: unknown): boolean {
  const record = response as { granted?: boolean; status?: string };
  return record.granted === true || record.status === 'granted';
}

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (isPermissionGranted(current)) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return isPermissionGranted(requested);
  } catch {
    return false;
  }
}

// Reprograma el recordatorio: cancela el anterior y agenda uno nuevo si está activo.
export async function syncDailyReminder(enabled: boolean, hour: number) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Kanami 🌸',
        body: '¡Hora de practicar japonés! Mantené tu racha.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  } catch {
    // Ignorar fallos de agenda; la app sigue funcionando.
  }
}
