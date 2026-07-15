import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HiraganaGroupId } from './hiragana';
import { KanaScript, PracticeMode, WordPracticeCategoryId } from './game';
import { KanjiCategoryId, KanjiPracticeMode } from './kanji';

export type RootStackParamList = {
  Home: undefined;
  StudyTopics: undefined;
  StudyTopic: { topicId: string };
  KanaGroups: {
    script: KanaScript;
    initialMode?: PracticeMode;
  };
  KanaGame: {
    script: KanaScript;
    selectedGroupIds: HiraganaGroupId[];
    selectedWordCategoryIds: WordPracticeCategoryId[];
    mode: PracticeMode;
    inverted: boolean;
    // Cantidad de rondas antes del resumen. undefined = sesión infinita (default).
    sessionLength?: number;
  };
  KanjiHub: undefined;
  KanjiLearn: undefined;
  KanjiPractice: undefined;
  KanjiDraw: {
    categoryIds: KanjiCategoryId[];
    kanjiId?: string;
  };
  KanjiGame: {
    mode: KanjiPracticeMode;
    categoryIds: KanjiCategoryId[];
  };
  Vocabulary: undefined;
  EmojiGame: {
    script: KanaScript;
  };
  TimesGame: undefined;
  DictationGame: undefined;
  PronunciationGame: undefined;
  Review: undefined;
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Screen>;
