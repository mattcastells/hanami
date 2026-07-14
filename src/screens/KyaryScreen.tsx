import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { AppText } from '../components/ui/AppText';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { speak, stopSpeaking } from '../features/speech/speak';
import { sendKyaryMessage, KyaryHistoryMessage } from '../services/kyary';
import { useAppTheme } from '../theme/AppThemeProvider';
import { hexToRgba, theme } from '../theme/theme';

type PendingImage = {
  uri: string;
  dataUrl: string;
};

type PendingAudio = {
  uri: string;
  dataUrl: string;
  durationMs: number;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  imageUri?: string;
  audioLabel?: string;
};

// Fases del modo de conversación por voz (manos libres).
type VoicePhase = 'off' | 'listening' | 'thinking' | 'speaking';

const VOICE_STATUS_LABEL: Record<Exclude<VoicePhase, 'off'>, string> = {
  listening: 'Escuchando...',
  thinking: 'Pensando...',
  speaking: 'Hablando...',
};

const createLocalId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const kyaryAvatarDark = require('../../assets/kyary-avatar-dark.png');
const kyaryAvatarLight = require('../../assets/kyary-avatar-light.png');

export function KyaryScreen() {
  const { theme: activeTheme, mode } = useAppTheme();
  const kyaryAvatar = mode === 'dark' ? kyaryAvatarDark : kyaryAvatarLight;
  const scrollRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // --- Modo voz (conversación hablada, manos libres) ---
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('off');
  const [interimText, setInterimText] = useState('');
  const [voiceLang, setVoiceLang] = useState<'es-ES' | 'ja-JP'>('es-ES');
  const voiceActiveRef = useRef(false);
  const voicePhaseRef = useRef<VoicePhase>('off');
  const voiceLangRef = useRef(voiceLang);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref siempre-fresca de los mensajes: los callbacks de STT necesitan el historial
  // actualizado turno a turno sin depender del closure del render.
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    voiceLangRef.current = voiceLang;
  }, [voiceLang]);

  const setPhase = (phase: VoicePhase) => {
    voicePhaseRef.current = phase;
    setVoicePhase(phase);
  };

  const canSend = (input.trim().length > 0 || pendingImage || pendingAudio) && !isSending;
  const voiceActive = voicePhase !== 'off';

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, isSending]);

  const clearConversation = () => {
    if (messages.length === 0 && !input && !pendingImage && !pendingAudio) return;
    setMessages([]);
    setInput('');
    setErrorText(null);
    setPendingImage(null);
    setPendingAudio(null);
  };

  const pickImage = async () => {
    if (isSending || isRecording) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorText('Se necesita permiso para acceder a la galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setErrorText('No se pudo leer la imagen.');
      return;
    }

    const mimeType = asset.mimeType ?? 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${asset.base64}`;

    const sizeBytes = asset.base64.length * 0.75;
    if (sizeBytes > 7 * 1024 * 1024) {
      setErrorText('La imagen es demasiado grande (máx 7 MB).');
      return;
    }

    setPendingImage({ uri: asset.uri, dataUrl });
    setPendingAudio(null);
    setErrorText(null);
  };

  const startRecording = async () => {
    if (isSending || isRecording) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorText('Se necesita permiso para usar el micrófono.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.aac',
            outputFormat: 4,
            audioEncoder: 3,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.aac',
            outputFormat: 'aac',
            audioQuality: 96,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
        },
        (status) => {
          if (status.isRecording && status.durationMillis != null) {
            setRecordingDuration(status.durationMillis);
          }
        },
        250,
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setErrorText(null);
    } catch {
      setErrorText('No se pudo iniciar la grabación.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        setErrorText('No se pudo guardar la grabación.');
        return;
      }

      if (recordingDuration < 600) {
        setErrorText('La grabación es muy corta. Intentá de nuevo.');
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const sizeBytes = base64.length * 0.75;
      if (sizeBytes > 4 * 1024 * 1024) {
        setErrorText('El audio es demasiado grande (máx 4 MB).');
        return;
      }

      const dataUrl = `data:audio/aac;base64,${base64}`;
      setPendingAudio({ uri, dataUrl, durationMs: recordingDuration });
      setPendingImage(null);
      setErrorText(null);
    } catch {
      recordingRef.current = null;
      setIsRecording(false);
      setErrorText('Error al finalizar la grabación.');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  };

  const formatDuration = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Núcleo reusable: manda un turno del usuario a Kyary y devuelve el texto de la
  // respuesta (o null si falló). Lo usan el botón ENVIAR y el modo voz.
  const sendUserTurn = async (payload: {
    text: string;
    imageUri?: string;
    imageDataUrl?: string;
    audioLabel?: string;
    audioDataUrl?: string;
  }): Promise<string | null> => {
    const pendingAssistantId = createLocalId('assistant-pending');
    const userMessage: ChatMessage = {
      id: createLocalId('user'),
      role: 'user',
      text:
        payload.text ||
        (payload.imageDataUrl ? '(imagen adjunta)' : '(audio adjunto)'),
      imageUri: payload.imageUri,
      audioLabel: payload.audioLabel,
    };
    const history: KyaryHistoryMessage[] = [
      ...messagesRef.current
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role, text: m.text })),
      {
        role: 'user' as const,
        text: payload.text || '',
        imageDataUrl: payload.imageDataUrl,
        audioDataUrl: payload.audioDataUrl,
      },
    ];

    setMessages((current) => [
      ...current,
      userMessage,
      { id: pendingAssistantId, role: 'assistant', text: '', pending: true },
    ]);
    setErrorText(null);
    setIsSending(true);

    try {
      const reply = await sendKyaryMessage(history);
      setMessages((current) => [
        ...current.filter((m) => m.id !== pendingAssistantId),
        { id: createLocalId('assistant'), role: 'assistant', text: reply.text },
      ]);
      return reply.text;
    } catch (error) {
      setMessages((current) => current.filter((m) => m.id !== pendingAssistantId));
      setErrorText(
        error instanceof Error ? error.message : 'No se pudo consultar a Kyary.',
      );
      return null;
    } finally {
      setIsSending(false);
    }
  };

  const submit = async () => {
    const text = input.trim();
    if ((!text && !pendingImage && !pendingAudio) || isSending) return;

    const image = pendingImage;
    const audio = pendingAudio;
    setInput('');
    setPendingImage(null);
    setPendingAudio(null);

    await sendUserTurn({
      text,
      imageUri: image?.uri,
      imageDataUrl: image?.dataUrl,
      audioLabel: audio ? `Audio ${formatDuration(audio.durationMs)}` : undefined,
      audioDataUrl: audio?.dataUrl,
    });

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // --- Loop de conversación por voz ---
  const clearRestartTimeout = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const scheduleRestart = () => {
    clearRestartTimeout();
    restartTimeoutRef.current = setTimeout(() => {
      restartTimeoutRef.current = null;
      if (voiceActiveRef.current && voicePhaseRef.current === 'listening') {
        startListening();
      }
    }, 500);
  };

  const startListening = () => {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: voiceLangRef.current,
        interimResults: true,
        continuous: false,
      });
    } catch {
      scheduleRestart();
    }
  };

  const processVoiceTurn = async (text: string) => {
    const reply = await sendUserTurn({ text });
    if (!voiceActiveRef.current) return;
    if (reply) {
      setPhase('speaking');
      // Kyary responde en español; leemos la respuesta con voz española.
      speak(reply, {
        language: 'es-ES',
        rate: 1.0,
        onDone: () => {
          if (!voiceActiveRef.current) return;
          setPhase('listening');
          startListening();
        },
      });
    } else {
      setPhase('listening');
      startListening();
    }
  };

  const startVoiceMode = async () => {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setErrorText('Se necesita permiso de micrófono para hablar con Kyary.');
      return;
    }
    if (isRecording) void stopRecording();
    setErrorText(null);
    setInterimText('');
    voiceActiveRef.current = true;
    setPhase('listening');
    startListening();
  };

  const stopVoiceMode = () => {
    voiceActiveRef.current = false;
    clearRestartTimeout();
    stopSpeaking();
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // no-op
    }
    setInterimText('');
    setPhase('off');
  };

  const toggleVoiceMode = () => {
    if (voiceActiveRef.current) {
      stopVoiceMode();
    } else {
      void startVoiceMode();
    }
  };

  useSpeechRecognitionEvent('result', (event) => {
    if (!voiceActiveRef.current) return;
    const transcript = event.results[0]?.transcript ?? '';
    if (!event.isFinal) {
      setInterimText(transcript);
      return;
    }
    setInterimText('');
    const finalText = transcript.trim();
    if (!finalText) return; // no se entendió nada; 'end' reabre la escucha
    setPhase('thinking');
    void processVoiceTurn(finalText);
  });

  useSpeechRecognitionEvent('end', () => {
    if (voiceActiveRef.current && voicePhaseRef.current === 'listening') {
      scheduleRestart();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!voiceActiveRef.current) return;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setErrorText('No hay permiso o servicio de reconocimiento de voz disponible.');
      stopVoiceMode();
      return;
    }
    // Errores transitorios (no-speech, no-match, network): seguimos escuchando.
    if (voicePhaseRef.current === 'listening') {
      scheduleRestart();
    }
  });

  // Cortar el modo voz al salir de la pantalla (cambio de tab) o desmontar.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (voiceActiveRef.current) {
          stopVoiceMode();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const isDark = mode === 'dark';

  return (
    <ScreenBackground scrollable={false} showBack={false}>
      <View style={styles.screen}>
        {messages.length > 0 ? (
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Image
                source={kyaryAvatar}
                style={styles.kyaryAvatar}
              />
              <AppText variant="title" style={styles.titleText}>
                Kyary
              </AppText>
            </View>
            <Pressable
              onPress={clearConversation}
              disabled={messages.length === 0 && !input}
              style={({ pressed }) => [
                styles.resetButton,
                {
                  backgroundColor: hexToRgba(
                    activeTheme.colors.backgroundSecondary,
                    Platform.OS === 'android' ? 0.9 : 0.28,
                  ),
                  borderColor: isDark
                    ? hexToRgba(activeTheme.colors.white, 0.12)
                    : hexToRgba(activeTheme.colors.black, 0.12),
                  opacity:
                    messages.length === 0 && !input ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={16}
                color={activeTheme.colors.accent}
              />
            </Pressable>
          </View>
        ) : null}

        {messages.length === 0 ? (
          <View style={styles.emptyWelcome}>
            <Image
              source={kyaryAvatar}
              style={styles.kyaryAvatarLarge}
            />
            <AppText variant="headline">Kyary</AppText>
            <AppText
              variant="bodySmall"
              color={activeTheme.colors.textMuted}
              style={styles.emptyHint}
            >
              Preguntame sobre hiragana, katakana, vocabulario, gramática o
              cualquier duda sobre el japonés. Estoy para ayudarte! 🌸
            </AppText>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={[styles.messagesScroll, messages.length === 0 && { flex: 0 }]}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.role === 'user'
                  ? styles.userRow
                  : styles.assistantRow,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user'
                    ? {
                        backgroundColor: hexToRgba(
                          activeTheme.colors.accent,
                          0.14,
                        ),
                        borderColor: hexToRgba(
                          activeTheme.colors.accent,
                          0.32,
                        ),
                      }
                    : {
                        backgroundColor: hexToRgba(
                          activeTheme.colors.backgroundSecondary,
                          Platform.OS === 'android' ? 0.92 : 0.42,
                        ),
                        borderColor: hexToRgba(
                          activeTheme.colors.textPrimary,
                          0.08,
                        ),
                      },
                ]}
              >
                {message.pending ? (
                  <PendingDots color={activeTheme.colors.textMuted} />
                ) : (
                  <>
                    {message.imageUri ? (
                      <Image
                        source={{ uri: message.imageUri }}
                        style={styles.messageImage}
                        resizeMode="cover"
                      />
                    ) : null}
                    {message.audioLabel ? (
                      <View style={styles.audioAttachmentRow}>
                        <MaterialCommunityIcons
                          name="microphone"
                          size={14}
                          color={activeTheme.colors.accent}
                        />
                        <AppText
                          variant="bodySmall"
                          color={activeTheme.colors.accent}
                        >
                          {message.audioLabel}
                        </AppText>
                      </View>
                    ) : null}
                    <AppText
                      variant="body"
                      color={activeTheme.colors.textPrimary}
                      style={styles.messageText}
                    >
                      {message.text}
                    </AppText>
                  </>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {errorText ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: hexToRgba(activeTheme.colors.error, 0.12),
                borderColor: hexToRgba(activeTheme.colors.error, 0.28),
              },
            ]}
          >
            <AppText variant="bodySmall" color={activeTheme.colors.error}>
              {errorText}
            </AppText>
          </View>
        ) : null}

        <GlassCard style={styles.composerCard} contentStyle={styles.composerContent}>
          {isRecording ? (
            <View style={styles.recordingBanner}>
              <MaterialCommunityIcons name="record-circle" size={16} color="#FF6B5B" />
              <AppText variant="bodySmall" color="#FF8E8E">
                Grabando... {formatDuration(recordingDuration)} / 1:00
              </AppText>
            </View>
          ) : null}

          {voiceActive ? (
            <View
              style={[
                styles.voiceBanner,
                {
                  borderColor: hexToRgba(activeTheme.colors.accent, 0.3),
                  backgroundColor: hexToRgba(activeTheme.colors.accent, 0.08),
                },
              ]}
            >
              <MaterialCommunityIcons
                name="account-voice"
                size={16}
                color={activeTheme.colors.accent}
              />
              <AppText
                variant="bodySmall"
                color={activeTheme.colors.textSecondary}
                style={styles.voiceStatus}
                numberOfLines={1}
              >
                {VOICE_STATUS_LABEL[voicePhase]}
                {interimText ? `  “${interimText}”` : ''}
              </AppText>
              <Pressable
                onPress={() =>
                  setVoiceLang((current) =>
                    current === 'es-ES' ? 'ja-JP' : 'es-ES',
                  )
                }
                hitSlop={6}
                style={[
                  styles.voiceLangChip,
                  { borderColor: hexToRgba(activeTheme.colors.accent, 0.4) },
                ]}
              >
                <AppText variant="label" color={activeTheme.colors.accent}>
                  {voiceLang === 'es-ES' ? 'ES' : '日本'}
                </AppText>
              </Pressable>
              <Pressable onPress={stopVoiceMode} hitSlop={8}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={activeTheme.colors.textMuted}
                />
              </Pressable>
            </View>
          ) : null}

          {pendingImage ? (
            <View style={styles.pendingAttachmentRow}>
              <Image
                source={{ uri: pendingImage.uri }}
                style={styles.pendingImageThumb}
                resizeMode="cover"
              />
              <AppText
                variant="bodySmall"
                color={activeTheme.colors.textSecondary}
                style={styles.pendingAttachmentLabel}
              >
                Imagen adjunta
              </AppText>
              <Pressable
                onPress={() => setPendingImage(null)}
                hitSlop={8}
                style={styles.pendingRemoveButton}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={activeTheme.colors.textMuted}
                />
              </Pressable>
            </View>
          ) : null}

          {pendingAudio ? (
            <View style={styles.pendingAttachmentRow}>
              <MaterialCommunityIcons
                name="microphone"
                size={16}
                color={activeTheme.colors.accent}
              />
              <AppText
                variant="bodySmall"
                color={activeTheme.colors.textSecondary}
                style={styles.pendingAttachmentLabel}
              >
                Audio {formatDuration(pendingAudio.durationMs)}
              </AppText>
              <Pressable
                onPress={() => setPendingAudio(null)}
                hitSlop={8}
                style={styles.pendingRemoveButton}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={activeTheme.colors.textMuted}
                />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => void submit()}
              editable={!isSending && !voiceActive}
              multiline
              numberOfLines={3}
              maxLength={800}
              placeholder="Preguntale a Kyary..."
              placeholderTextColor={activeTheme.colors.textMuted}
              selectionColor={activeTheme.colors.accent}
              blurOnSubmit={false}
              returnKeyType="default"
              style={[
                styles.input,
                { color: activeTheme.colors.textPrimary },
              ]}
            />
          </View>
          <View style={styles.composerActions}>
            <View style={styles.attachButtons}>
              <Pressable
                onPress={pickImage}
                disabled={isSending || isRecording || voiceActive}
                style={({ pressed }) => [
                  styles.attachButton,
                  {
                    backgroundColor: hexToRgba(
                      activeTheme.colors.backgroundSecondary,
                      Platform.OS === 'android' ? 0.9 : 0.28,
                    ),
                    borderColor: isDark
                      ? hexToRgba(activeTheme.colors.white, 0.12)
                      : hexToRgba(activeTheme.colors.black, 0.12),
                    opacity:
                      isSending || isRecording || voiceActive
                        ? 0.4
                        : pressed
                          ? 0.7
                          : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="image-outline"
                  size={18}
                  color={activeTheme.colors.accent}
                />
              </Pressable>

              {Platform.OS !== 'web' ? (
                <Pressable
                  onPress={toggleRecording}
                  disabled={isSending || voiceActive}
                  style={({ pressed }) => [
                    styles.attachButton,
                    {
                      backgroundColor: isRecording
                        ? hexToRgba('#FF6B5B', 0.18)
                        : hexToRgba(
                            activeTheme.colors.backgroundSecondary,
                            Platform.OS === 'android' ? 0.9 : 0.28,
                          ),
                      borderColor: isRecording
                        ? hexToRgba('#FF6B5B', 0.4)
                        : isDark
                          ? hexToRgba(activeTheme.colors.white, 0.12)
                          : hexToRgba(activeTheme.colors.black, 0.12),
                      opacity: isSending ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isRecording ? 'stop' : 'microphone-outline'}
                    size={18}
                    color={isRecording ? '#FF6B5B' : activeTheme.colors.accent}
                  />
                </Pressable>
              ) : null}

              <Pressable
                onPress={toggleVoiceMode}
                disabled={isSending && !voiceActive}
                style={({ pressed }) => [
                  styles.attachButton,
                  {
                    backgroundColor: voiceActive
                      ? hexToRgba(activeTheme.colors.accent, 0.18)
                      : hexToRgba(
                          activeTheme.colors.backgroundSecondary,
                          Platform.OS === 'android' ? 0.9 : 0.28,
                        ),
                    borderColor: voiceActive
                      ? hexToRgba(activeTheme.colors.accent, 0.5)
                      : isDark
                        ? hexToRgba(activeTheme.colors.white, 0.12)
                        : hexToRgba(activeTheme.colors.black, 0.12),
                    opacity: isSending && !voiceActive ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-voice"
                  size={18}
                  color={activeTheme.colors.accent}
                />
              </Pressable>
            </View>

            <PrimaryButton
              title={isSending ? 'PENSANDO...' : 'ENVIAR'}
              variant="primary"
              size="compact"
              disabled={!canSend || voiceActive}
              onPress={() => void submit()}
              style={styles.sendButton}
            />
          </View>
        </GlassCard>
      </View>
    </ScreenBackground>
  );
}

function PendingDots({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={styles.pendingRow}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.pendingDot,
            { backgroundColor: color },
            {
              opacity: anim.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange:
                  i === 0
                    ? [0.3, 1, 0.3, 0.3]
                    : i === 1
                      ? [0.3, 0.3, 1, 0.3]
                      : [0.3, 0.3, 0.3, 1],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    gap: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  kyaryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  titleText: {
    fontSize: 20,
  },
  resetButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWelcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  kyaryAvatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: theme.spacing.xs,
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  messagesScroll: {
    flex: 1,
    minHeight: 0,
  },
  messagesContent: {
    gap: 10,
    paddingBottom: theme.spacing.xs,
  },
  messageRow: {
    width: '100%',
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
  },
  messageText: {
    lineHeight: 21,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pendingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  composerCard: {},
  composerContent: {
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  inputRow: {
    width: '100%',
  },
  input: {
    fontFamily: 'ZenKakuGothicNew_400Regular',
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 80,
    paddingVertical: 0,
    minHeight: 36,
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attachButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    minWidth: 130,
  },
  messageImage: {
    width: 180,
    height: 140,
    borderRadius: 10,
    marginBottom: theme.spacing.xs,
  },
  audioAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: theme.spacing.xs,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: 4,
  },
  voiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  voiceStatus: {
    flex: 1,
  },
  voiceLangChip: {
    borderWidth: 1,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  pendingAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: 4,
  },
  pendingImageThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  pendingAttachmentLabel: {
    flex: 1,
  },
  pendingRemoveButton: {
    padding: 2,
  },
});
