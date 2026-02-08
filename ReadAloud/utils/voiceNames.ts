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
 * we replace those with the friendly language name.
 */
export function friendlyVoiceName(name: string, language: string): string {
  // If the name looks like a locale code (contains dashes and no spaces), use the language instead
  if (/^[a-z]{2,3}-[A-Za-z]/.test(name) && !name.includes(' ')) {
    const friendly = friendlyLanguage(language);
    // Check if it's a "local" (on-device) or "network" voice
    if (name.includes('-local')) return `${friendly} · Offline`;
    if (name.includes('-network')) return `${friendly} · Online`;
    return friendly;
  }
  return name;
}

/** Get a sort-friendly language group name */
export function languageGroup(langCode: string): string {
  const clean = langCode.replace(/-x-.*$/, '');
  const parts = clean.split('-');
  return LANG_MAP[parts[0]] || parts[0].toUpperCase();
}
