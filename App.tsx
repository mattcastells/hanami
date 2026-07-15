import { useEffect } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ZenOldMincho_400Regular } from '@expo-google-fonts/zen-old-mincho/400Regular';
import { ZenOldMincho_700Bold } from '@expo-google-fonts/zen-old-mincho/700Bold';
import { ZenKakuGothicNew_400Regular } from '@expo-google-fonts/zen-kaku-gothic-new/400Regular';
import { ZenKakuGothicNew_500Medium } from '@expo-google-fonts/zen-kaku-gothic-new/500Medium';
import { ZenKakuGothicNew_700Bold } from '@expo-google-fonts/zen-kaku-gothic-new/700Bold';

import { RootNavigator } from './src/navigation/RootNavigator';
import { ProgressProvider } from './src/features/progress/ProgressProvider';
import { SrsProvider } from './src/features/srs/SrsProvider';
import { AppSettingsProvider } from './src/settings/AppSettingsProvider';
import { AppThemeProvider, useAppTheme } from './src/theme/AppThemeProvider';

export default function App() {
  const [fontsLoaded] = useFonts({
    ZenOldMincho_400Regular,
    ZenOldMincho_700Bold,
    ZenKakuGothicNew_400Regular,
    ZenKakuGothicNew_500Medium,
    ZenKakuGothicNew_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <AppThemeProvider>
            <ProgressProvider>
              <SrsProvider>
                <AppShell />
              </SrsProvider>
            </ProgressProvider>
          </AppThemeProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { theme, mode } = useAppTheme();
  const isDark = mode === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflowX = html.style.overflowX;
    const previousBodyOverflowX = body.style.overflowX;
    const previousBodyMargin = body.style.margin;

    html.style.overflowX = 'hidden';
    body.style.overflowX = 'hidden';
    body.style.margin = '0';

    return () => {
      html.style.overflowX = previousHtmlOverflowX;
      body.style.overflowX = previousBodyOverflowX;
      body.style.margin = previousBodyMargin;
    };
  }, []);

  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      card: theme.colors.cardStrong,
      border: 'transparent',
      notification: theme.colors.accent,
      primary: theme.colors.accent,
      text: theme.colors.textPrimary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}
