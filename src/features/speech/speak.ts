import * as Speech from 'expo-speech';

// Lectura en voz alta con expo-speech (gratis, sin API key; en web usa la Web Speech
// API del navegador, en Android el motor TTS del sistema). La voz de un idioma puede
// requerir el pack instalado en el dispositivo/navegador.

export type SpeakOptions = {
  language?: string;
  rate?: number;
  onDone?: () => void;
};

export function speak(text: string, options: SpeakOptions = {}) {
  const clean = text?.trim();
  if (!clean) {
    options.onDone?.();
    return;
  }
  // Cortamos cualquier lectura en curso para no encimar audios.
  Speech.stop();
  Speech.speak(clean, {
    language: options.language ?? 'ja-JP',
    rate: options.rate ?? 0.9,
    pitch: 1.0,
    onDone: options.onDone,
    // Si el motor falla, resolvemos igual para no dejar el loop colgado. No usamos
    // onStopped: cuando cortamos a propósito (salir del modo voz) NO queremos resumir.
    onError: options.onDone,
  });
}

export function speakJapanese(text: string) {
  // Un poco más lento ayuda a la pronunciación al aprender.
  speak(text, { language: 'ja-JP', rate: 0.85 });
}

export function stopSpeaking() {
  Speech.stop();
}
