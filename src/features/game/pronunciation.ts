// Comparación tolerante de pronunciación: el reconocedor de voz japonés puede
// devolver hiragana, katakana o kanji. Normalizamos a hiragana y comparamos de forma
// indulgente (para que sea alentador, no un examen estricto).

export type PronunciationResult = 'correct' | 'close' | 'wrong';

// Convierte katakana a hiragana (mismo bloque, offset 0x60) y descarta todo lo que no
// sea kana o marca de vocal larga, para ignorar kanji/puntuación del reconocedor.
export function toHiraganaOnly(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    // Katakana → hiragana
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCodePoint(code - 0x60);
      continue;
    }
    // Hiragana o marca de vocal larga (ー)
    if ((code >= 0x3041 && code <= 0x3096) || char === 'ー') {
      result += char;
    }
    // Cualquier otra cosa (kanji, espacios, puntuación) se ignora.
  }
  return result;
}

export function comparePronunciation(
  expectedKana: string,
  heard: string,
): PronunciationResult {
  const expected = toHiraganaOnly(expectedKana);
  const said = toHiraganaOnly(heard);

  if (!said) return 'wrong';
  if (said === expected) return 'correct';
  if (said.includes(expected) || expected.includes(said)) return 'close';
  return 'wrong';
}
