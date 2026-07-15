import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/ui/AppText';
import { useAppTheme } from '../theme/AppThemeProvider';
import { RootStackParamList } from '../types/navigation';
import { DictationGameScreen } from '../screens/DictationGameScreen';
import { EmojiGameScreen } from '../screens/EmojiGameScreen';
import { GameScreen } from '../screens/GameScreen';
import { PronunciationGameScreen } from '../screens/PronunciationGameScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { HiraganaSelectionScreen } from '../screens/HiraganaSelectionScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { KanjiGameScreen } from '../screens/KanjiGameScreen';
import { KanjiHubScreen } from '../screens/KanjiHubScreen';
import { KanjiLearnScreen } from '../screens/KanjiLearnScreen';
import { KanjiPracticeScreen } from '../screens/KanjiPracticeScreen';
import { KanjiDrawScreen } from '../screens/KanjiDrawScreen';
import { KyaryScreen } from '../screens/KyaryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StudyTopicScreen } from '../screens/StudyTopicScreen';
import { StudyTopicsScreen } from '../screens/StudyTopicsScreen';
import { TimesGameScreen } from '../screens/TimesGameScreen';
import { VocabularyScreen } from '../screens/VocabularyScreen';

// Tabs: 練 Practicar · 学 Estudiar · 話 Kyary · 私 Perfil
// Los stacks de práctica y estudio viven adentro de sus tabs.

const Tab = createBottomTabNavigator();
const PracticeStack = createNativeStackNavigator<RootStackParamList>();
const StudyStack = createNativeStackNavigator<RootStackParamList>();

const stackScreenOptions = {
  headerShown: false,
  animation: 'fade' as const,
  contentStyle: { backgroundColor: 'transparent' },
};

function PracticeNavigator() {
  return (
    <PracticeStack.Navigator initialRouteName="Home" screenOptions={stackScreenOptions}>
      <PracticeStack.Screen name="Home" component={HomeScreen} />
      <PracticeStack.Screen name="KanaGroups" component={HiraganaSelectionScreen} />
      <PracticeStack.Screen name="KanaGame" component={GameScreen} />
      <PracticeStack.Screen name="KanjiHub" component={KanjiHubScreen} />
      <PracticeStack.Screen name="KanjiLearn" component={KanjiLearnScreen} />
      <PracticeStack.Screen name="KanjiPractice" component={KanjiPracticeScreen} />
      <PracticeStack.Screen name="KanjiDraw" component={KanjiDrawScreen} />
      <PracticeStack.Screen name="KanjiGame" component={KanjiGameScreen} />
      <PracticeStack.Screen name="Vocabulary" component={VocabularyScreen} />
      <PracticeStack.Screen name="EmojiGame" component={EmojiGameScreen} />
      <PracticeStack.Screen name="TimesGame" component={TimesGameScreen} />
      <PracticeStack.Screen name="DictationGame" component={DictationGameScreen} />
      <PracticeStack.Screen name="PronunciationGame" component={PronunciationGameScreen} />
      <PracticeStack.Screen name="Review" component={ReviewScreen} />
    </PracticeStack.Navigator>
  );
}

function StudyNavigator() {
  return (
    <StudyStack.Navigator initialRouteName="StudyTopics" screenOptions={stackScreenOptions}>
      <StudyStack.Screen name="StudyTopics" component={StudyTopicsScreen} />
      <StudyStack.Screen name="StudyTopic" component={StudyTopicScreen} />
    </StudyStack.Navigator>
  );
}

function TabGlyph({ glyph, label, focused }: { glyph: string; label: string; focused: boolean }) {
  const { theme: activeTheme } = useAppTheme();
  const color = focused ? activeTheme.colors.accent : activeTheme.colors.textMuted;

  return (
    <>
      <AppText
        variant="headline"
        style={{ color, fontSize: 20, lineHeight: 24, textAlign: 'center' }}
      >
        {glyph}
      </AppText>
      <AppText
        variant="label"
        numberOfLines={1}
        style={{
          color,
          fontSize: 10,
          lineHeight: 12,
          letterSpacing: 0,
          textAlign: 'center',
          width: 72,
        }}
      >
        {label}
      </AppText>
    </>
  );
}

export function RootNavigator() {
  const { theme: activeTheme } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: activeTheme.colors.background,
          borderTopColor: activeTheme.colors.line,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarIconStyle: { flex: 1 },
        sceneStyle: { backgroundColor: activeTheme.colors.background },
      }}
    >
      <Tab.Screen
        name="PracticeTab"
        component={PracticeNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabGlyph glyph="練" label="Practicar" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="StudyTab"
        component={StudyNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabGlyph glyph="学" label="Estudiar" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="KyaryTab"
        component={KyaryScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph glyph="話" label="Kyary" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph glyph="私" label="Perfil" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
