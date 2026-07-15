import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useProgress } from '../../features/progress/ProgressProvider';
import { localDayString } from '../../features/progress/progressStore';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { hexToRgba, theme } from '../../theme/theme';
import { AppText } from '../ui/AppText';

// Muestra la racha diaria y el avance hacia la meta del día. Solo lectura.
export function StreakCard() {
  const { theme: activeTheme } = useAppTheme();
  const { data } = useProgress();
  const daily = data.daily;

  // La racha sigue "viva" si la última actividad fue hoy o ayer.
  const { streak, todayCount } = useMemo(() => {
    const today = localDayString(new Date());
    const yesterday = localDayString(new Date(Date.now() - 86_400_000));
    const active =
      daily.lastActiveDate === today || daily.lastActiveDate === yesterday;
    return {
      streak: active ? daily.currentStreak : 0,
      todayCount: daily.lastActiveDate === today ? daily.todayCount : 0,
    };
  }, [daily]);

  const goal = daily.dailyGoal;
  const ratio = goal > 0 ? Math.min(1, todayCount / goal) : 0;
  const goalReached = todayCount >= goal;

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: activeTheme.colors.line,
          backgroundColor: activeTheme.colors.backgroundSecondary,
        },
      ]}
    >
      <View style={styles.streakSide}>
        <MaterialCommunityIcons
          name="fire"
          size={24}
          color={streak > 0 ? activeTheme.colors.accent : activeTheme.colors.textMuted}
        />
        <AppText variant="title" style={styles.streakNumber}>
          {streak}
        </AppText>
        <AppText variant="bodySmall" color={activeTheme.colors.textMuted}>
          {streak === 1 ? 'día' : 'días'}
        </AppText>
      </View>

      <View style={styles.goalSide}>
        <View style={styles.goalHeader}>
          <AppText variant="label" color={activeTheme.colors.textMuted}>
            Meta de hoy
          </AppText>
          <AppText
            variant="label"
            color={goalReached ? activeTheme.colors.success : activeTheme.colors.textSecondary}
          >
            {Math.min(todayCount, goal)}/{goal}
            {goalReached ? ' ✓' : ''}
          </AppText>
        </View>
        <View
          style={[
            styles.track,
            { backgroundColor: hexToRgba(activeTheme.colors.textPrimary, 0.08) },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${ratio * 100}%`,
                backgroundColor: goalReached
                  ? activeTheme.colors.success
                  : activeTheme.colors.accent,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  streakSide: {
    alignItems: 'center',
    minWidth: 56,
  },
  streakNumber: {
    fontSize: 22,
  },
  goalSide: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
