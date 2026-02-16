/** Map language codes to human-readable names */
const LANG_MAP: Record<string, string> = {
  af: 'Afrikaans', am: 'Amharic', ar: 'Arabic', az: 'Azerbaijani',
  bg: 'Bulgarian', bn: 'Bengali', bs: 'Bosnian', ca: 'Catalan',
  cs: 'Czech', cy: 'Welsh', da: 'Danish', de: 'German',
  el: 'Greek', en: 'English', es: 'Spanish', et: 'Estonian',
  eu: 'Basque', fa: 'Persian', fi: 'Finnish', fil: 'Filipino',
  fr: 'French', gl: 'Galician', gu: 'Gujarati', hi: 'Hindi',
  hr: 'Croatian', hu: 'Hungarian', hy: 'Armenian', id: 'Indonesian',
  is: 'Icelandic', it: 'Italian', iw: 'Hebrew', ja: 'Japanese',
  jv: 'Javanese', ka: 'Georgian', kk: 'Kazakh', km: 'Khmer',
  kn: 'Kannada', ko: 'Korean', lo: 'Lao', lt: 'Lithuanian',
  lv: 'Latvian', mk: 'Macedonian', ml: 'Malayalam', mn: 'Mongolian',
  mr: 'Marathi', ms: 'Malay', my: 'Burmese', nb: 'Norwegian',
  ne: 'Nepali', nl: 'Dutch', pl: 'Polish', pt: 'Portuguese',
  ro: 'Romanian', ru: 'Russian', si: 'Sinhala', sk: 'Slovak',
  sl: 'Slovenian', sq: 'Albanian', sr: 'Serbian', su: 'Sundanese',
  sv: 'Swedish', sw: 'Swahili', ta: 'Tamil', te: 'Telugu',
  th: 'Thai', tr: 'Turkish', uk: 'Ukrainian', ur: 'Urdu',
  uz: 'Uzbek', vi: 'Vietnamese', yue: 'Cantonese', zh: 'Chinese',
  zu: 'Zulu',
};

const REGION_MAP: Record<string, string> = {
  AU: 'Australia', BR: 'Brazil', CA: 'Canada', GB: 'UK',
  US: 'US', IN: 'India', ZA: 'South Africa', IE: 'Ireland',
  NZ: 'New Zealand', SG: 'Singapore', PH: 'Philippines',
  HK: 'Hong Kong', TW: 'Taiwan', CN: 'China', MX: 'Mexico',
  AR: 'Argentina', CL: 'Chile', CO: 'Colombia', ES: 'Spain',
  FR: 'France', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria',
  DE: 'Germany', IT: 'Italy', PT: 'Portugal', NL: 'Netherlands',
  RU: 'Russia', JP: 'Japan', KR: 'Korea', SA: 'Saudi Arabia',
  EG: 'Egypt', PK: 'Pakistan', BD: 'Bangladesh', ID: 'Indonesia',
  MY: 'Malaysia', NG: 'Nigeria', KE: 'Kenya', TZ: 'Tanzania',
  BA: 'Bosnia', RS: 'Serbia', HR: 'Croatia', NO: 'Norway',
  SE: 'Sweden', DK: 'Denmark', FI: 'Finland', PL: 'Poland',
  CZ: 'Czechia', SK: 'Slovakia', RO: 'Romania', UA: 'Ukraine',
  TR: 'Turkey', TH: 'Thailand', VN: 'Vietnam',
};

/**
 * Turn a raw voice language code like "en-US" or "bs-BA-x-bsm-local"
 * into a friendly label like "English (US)" or "Bosnian (Bosnia)"
 */
export function friendlyLanguage(langCode: string): string {
  // Strip the "-x-variant-local" suffix
  const clean = langCode.replace(/-x-.*$/, '');
  const parts = clean.split('-');
  const lang = LANG_MAP[parts[0]] || parts[0].toUpperCase();
  const region = parts[1] ? REGION_MAP[parts[1]] || parts[1] : '';
  return region ? `${lang} (${region})` : lang;
}

/**
 * Turn a raw voice name/identifier into something readable.
 * Android voices often have names like "bs-ba-x-bsm-local" —
 * we replace those with the friendly language name + gender.
 */
export function friendlyVoiceName(name: string, language: string, gender?: 'female' | 'male'): string {
  const genderLabel = gender === 'female' ? ' ♀' : gender === 'male' ? ' ♂' : '';

  // If the name looks like a locale code (contains dashes and no spaces), use the language instead
  if (/^[a-z]{2,3}-[A-Za-z]/.test(name) && !name.includes(' ')) {
    const friendly = friendlyLanguage(language);
    if (name.includes('-local')) return `${friendly}${genderLabel} · Offline`;
    if (name.includes('-network')) return `${friendly}${genderLabel} · Online`;
    return `${friendly}${genderLabel}`;
  }
  return `${name}${genderLabel}`;
}

/** Get a sort-friendly language group name */
export function languageGroup(langCode: string): string {
  const clean = langCode.replace(/-x-.*$/, '');
  const parts = clean.split('-');
  return LANG_MAP[parts[0]] || parts[0].toUpperCase();
}

/**
 * Android voice variant suffixes that typically correspond to
 * different genders / voice personas. These are Google TTS engine
 * internal codes — not documented, but consistent across devices.
 *
 * Female-leaning variants: sfg, tpd, tpc, iog
 * Male-leaning variants:   tpf, sfb, iob, tpb
 *
 * We use these to pick one male + one female per locale.
 */
const FEMALE_VARIANTS = new Set(['sfg', 'tpd', 'tpc', 'iog', 'iol', 'tpl']);
const MALE_VARIANTS = new Set(['tpf', 'sfb', 'iob', 'tpb', 'iom', 'tpm']);

/** Extract the 3-letter variant code from an Android voice name/identifier */
function getVariantCode(id: string): string | null {
  // Pattern: lang-region-x-VARIANT-local/network  e.g. "en-us-x-sfg-local"
  const match = id.match(/-x-([a-z]{3})-/i);
  return match ? match[1].toLowerCase() : null;
}

/** Guess gender from the variant code */
function guessGender(id: string): 'female' | 'male' | 'unknown' {
  const variant = getVariantCode(id);
  if (!variant) return 'unknown';
  if (FEMALE_VARIANTS.has(variant)) return 'female';
  if (MALE_VARIANTS.has(variant)) return 'male';
  return 'unknown';
}

function isLocal(voice: { identifier: string; name: string }): boolean {
  return voice.identifier.includes('-local') || voice.name.includes('-local');
}

function isEnhanced(voice: { quality?: string }): boolean {
  return voice.quality === 'Enhanced';
}

/** Compare two voices — returns true if `a` is better than `b` */
function isBetter<T extends { identifier: string; name: string; quality?: string }>(a: T, b: T): boolean {
  if (isEnhanced(a) && !isEnhanced(b)) return true;
  if (!isEnhanced(a) && isEnhanced(b)) return false;
  if (isLocal(a) && !isLocal(b)) return true;
  return false;
}

/**
 * Deduplicate voices from Speech.getAvailableVoicesAsync().
 *
 * Android returns many variants per language+region:
 *   - local vs network (same voice, different delivery)
 *   - multiple engine variants (-x-sfg, -x-tpc, etc.)
 *
 * Strategy:
 *   1. iOS voices (human-readable names with spaces) are kept as-is
 *   2. Android voices are grouped by base locale (e.g. "en-us")
 *   3. Per locale, keep up to 2 voices: 1 female + 1 male
 *   4. Prefer Enhanced quality, then local/offline over network
 *   5. Label them with gender so the UI can show ♀ / ♂
 */
export function deduplicateVoices<T extends { identifier: string; language: string; name: string; quality?: string }>(
  voices: T[]
): (T & { gender?: 'female' | 'male' })[] {
  const results: (T & { gender?: 'female' | 'male' })[] = [];

  // iOS voices have human-readable names — keep all, they're already distinct
  const iosVoices = voices.filter(v => v.name.includes(' '));
  results.push(...iosVoices);

  // Android voices — deduplicate to 1 male + 1 female per locale
  const androidVoices = voices.filter(v => !v.name.includes(' '));

  // Group by base locale
  const localeMap = new Map<string, { female: T | null; male: T | null; fallback: T | null }>();

  for (const voice of androidVoices) {
    const baseLocale = voice.language.replace(/-x-.*$/, '').toLowerCase();
    if (!localeMap.has(baseLocale)) {
      localeMap.set(baseLocale, { female: null, male: null, fallback: null });
    }
    const group = localeMap.get(baseLocale)!;
    const gender = guessGender(voice.identifier || voice.name);

    if (gender === 'female') {
      if (!group.female || isBetter(voice, group.female)) group.female = voice;
    } else if (gender === 'male') {
      if (!group.male || isBetter(voice, group.male)) group.male = voice;
    } else {
      if (!group.fallback || isBetter(voice, group.fallback)) group.fallback = voice;
    }
  }

  for (const group of localeMap.values()) {
    if (group.female) results.push({ ...group.female, gender: 'female' });
    if (group.male) results.push({ ...group.male, gender: 'male' });
    // If we couldn't determine gender for any voice in this locale, keep the best fallback
    if (!group.female && !group.male && group.fallback) {
      results.push({ ...group.fallback });
    }
  }

  return results;
}
