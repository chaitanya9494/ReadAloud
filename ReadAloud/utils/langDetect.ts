/**
 * Simple on-device language detection using Unicode script ranges
 * and common word frequency. No network calls needed.
 */

const SCRIPT_PATTERNS: Array<{ pattern: RegExp; lang: string }> = [
  { pattern: /[\u0600-\u06FF]/, lang: 'ar' },    // Arabic
  { pattern: /[\u0980-\u09FF]/, lang: 'bn' },    // Bengali
  { pattern: /[\u4E00-\u9FFF]/, lang: 'zh' },    // Chinese
  { pattern: /[\u0900-\u097F]/, lang: 'hi' },    // Devanagari (Hindi)
  { pattern: /[\u10A0-\u10FF]/, lang: 'ka' },    // Georgian
  { pattern: /[\u0370-\u03FF]/, lang: 'el' },    // Greek
  { pattern: /[\u0A80-\u0AFF]/, lang: 'gu' },    // Gujarati
  { pattern: /[\u3040-\u309F\u30A0-\u30FF]/, lang: 'ja' }, // Japanese
  { pattern: /[\uAC00-\uD7AF]/, lang: 'ko' },    // Korean
  { pattern: /[\u0400-\u04FF]/, lang: 'ru' },    // Cyrillic (Russian)
  { pattern: /[\u0B80-\u0BFF]/, lang: 'ta' },    // Tamil
  { pattern: /[\u0C00-\u0C7F]/, lang: 'te' },    // Telugu
  { pattern: /[\u0E00-\u0E7F]/, lang: 'th' },    // Thai
  { pattern: /[\u0A00-\u0A7F]/, lang: 'pa' },    // Punjabi
  { pattern: /[\u0B00-\u0B7F]/, lang: 'or' },    // Odia
  { pattern: /[\u0C80-\u0CFF]/, lang: 'kn' },    // Kannada
  { pattern: /[\u0D00-\u0D7F]/, lang: 'ml' },    // Malayalam
  { pattern: /[\u0D80-\u0DFF]/, lang: 'si' },    // Sinhala
  { pattern: /[\u1000-\u109F]/, lang: 'my' },    // Myanmar
];

// Common words for Latin-script languages
const LATIN_MARKERS: Array<{ words: string[]; lang: string }> = [
  { words: ['the', 'and', 'is', 'are', 'was', 'have', 'been', 'with'], lang: 'en' },
  { words: ['el', 'la', 'los', 'las', 'es', 'por', 'que', 'con'], lang: 'es' },
  { words: ['le', 'la', 'les', 'des', 'est', 'une', 'que', 'dans'], lang: 'fr' },
  { words: ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht'], lang: 'de' },
  { words: ['il', 'la', 'di', 'che', 'è', 'per', 'una', 'sono'], lang: 'it' },
  { words: ['o', 'a', 'os', 'as', 'de', 'que', 'não', 'uma'], lang: 'pt' },
  { words: ['de', 'het', 'een', 'van', 'en', 'is', 'dat', 'niet'], lang: 'nl' },
  { words: ['och', 'att', 'det', 'som', 'för', 'är', 'med', 'den'], lang: 'sv' },
  { words: ['og', 'at', 'det', 'som', 'for', 'er', 'med', 'den'], lang: 'no' },
  { words: ['ve', 'bir', 'bu', 'için', 'ile', 'olan', 'gibi'], lang: 'tr' },
  { words: ['i', 'w', 'na', 'nie', 'się', 'jest', 'że', 'do'], lang: 'pl' },
  { words: ['dan', 'yang', 'di', 'ini', 'untuk', 'dengan', 'dari'], lang: 'id' },
  { words: ['và', 'của', 'là', 'được', 'cho', 'một', 'trong'], lang: 'vi' },
];

/**
 * Detect the most likely language of a text sample.
 * Returns a BCP 47 language code (e.g. 'en', 'es', 'hi').
 * Falls back to 'en' if uncertain.
 */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000);

  // Check non-Latin scripts first
  for (const { pattern, lang } of SCRIPT_PATTERNS) {
    const matches = sample.match(new RegExp(pattern.source, 'g'));
    if (matches && matches.length > 5) return lang;
  }

  // For Latin scripts, count common word matches
  const words = sample.toLowerCase().split(/\s+/);
  let bestLang = 'en';
  let bestScore = 0;

  for (const { words: markers, lang } of LATIN_MARKERS) {
    const score = words.filter((w) => markers.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  return bestLang;
}

/**
 * Find the best matching voice for a detected language.
 */
export function findBestVoice(
  voices: Array<{ identifier: string; language: string; quality?: string }>,
  targetLang: string
): string | undefined {
  // Exact match first, prefer enhanced/HD voices
  const exact = voices
    .filter((v) => v.language.startsWith(targetLang))
    .sort((a, b) => {
      if (a.quality === 'Enhanced' && b.quality !== 'Enhanced') return -1;
      if (b.quality === 'Enhanced' && a.quality !== 'Enhanced') return 1;
      // Prefer local/offline voices
      if (a.identifier.includes('local') && !b.identifier.includes('local')) return -1;
      return 0;
    });

  return exact[0]?.identifier;
}
