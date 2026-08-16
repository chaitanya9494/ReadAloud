/** Map language codes to human-readable names */
const LANG_MAP: Record<string, string> = {
  af: 'Afrikaans', am: 'Amharic', ar: 'Arabic', as: 'Assamese',
  az: 'Azerbaijani', be: 'Belarusian', bg: 'Bulgarian', bn: 'Bengali',
  bs: 'Bosnian', ca: 'Catalan', cs: 'Czech', cy: 'Welsh', da: 'Danish',
  de: 'German', el: 'Greek', en: 'English', es: 'Spanish', et: 'Estonian',
  eu: 'Basque', fa: 'Persian', fi: 'Finnish', fil: 'Filipino',
  fr: 'French', gl: 'Galician', gu: 'Gujarati', he: 'Hebrew', hi: 'Hindi',
  hr: 'Croatian', hu: 'Hungarian', hy: 'Armenian', id: 'Indonesian',
  is: 'Icelandic', it: 'Italian', ja: 'Japanese', jv: 'Javanese',
  ka: 'Georgian', kk: 'Kazakh', km: 'Khmer', kn: 'Kannada', ko: 'Korean',
  ky: 'Kyrgyz', lo: 'Lao', lt: 'Lithuanian', lv: 'Latvian',
  mk: 'Macedonian', ml: 'Malayalam', mn: 'Mongolian', mr: 'Marathi',
  ms: 'Malay', my: 'Burmese', nb: 'Norwegian', ne: 'Nepali',
  nl: 'Dutch', or: 'Odia', pa: 'Punjabi', pl: 'Polish', ps: 'Pashto',
  pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', sd: 'Sindhi',
  si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian', sq: 'Albanian',
  sr: 'Serbian', su: 'Sundanese', sv: 'Swedish', sw: 'Swahili',
  ta: 'Tamil', te: 'Telugu', th: 'Thai', tr: 'Turkish',
  uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese',
  yue: 'Cantonese', zh: 'Chinese', zu: 'Zulu',
  mni: 'Manipuri', doi: 'Dogri', kok: 'Konkani', bho: 'Bhojpuri',
  mai: 'Maithili', brx: 'Bodo',
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
  GR: 'Greece', BG: 'Bulgaria', KH: 'Cambodia', IL: 'Israel',
  GE: 'Georgia', IR: 'Iran', LK: 'Sri Lanka', NP: 'Nepal',
  MM: 'Myanmar', LA: 'Laos', KZ: 'Kazakhstan', AM: 'Armenia',
  AZ: 'Azerbaijan', BY: 'Belarus', MD: 'Moldova', EE: 'Estonia',
  LT: 'Lithuania', LV: 'Latvia', SI: 'Slovenia', MK: 'North Macedonia',
  AL: 'Albania', MT: 'Malta', CY: 'Cyprus', HU: 'Hungary',
  IS: 'Iceland', LU: 'Luxembourg', MC: 'Monaco', AE: 'UAE',
  QA: 'Qatar', KW: 'Kuwait', JO: 'Jordan', LB: 'Lebanon',
  BH: 'Bahrain', OM: 'Oman', YE: 'Yemen', DZ: 'Algeria',
  MA: 'Morocco', TN: 'Tunisia', LY: 'Libya', SD: 'Sudan',
  ET: 'Ethiopia', GH: 'Ghana', CM: 'Cameroon', CI: "Côte d'Ivoire",
  SN: 'Senegal', UG: 'Uganda', ZW: 'Zimbabwe', MW: 'Malawi',
  ZM: 'Zambia', BW: 'Botswana', NA: 'Namibia', MU: 'Mauritius',
  CR: 'Costa Rica', PA: 'Panama', DO: 'Dominican Republic',
  PR: 'Puerto Rico', GT: 'Guatemala', SV: 'El Salvador', HN: 'Honduras',
  NI: 'Nicaragua', BO: 'Bolivia', PE: 'Peru', EC: 'Ecuador',
  UY: 'Uruguay', PY: 'Paraguay', VE: 'Venezuela', CU: 'Cuba',
  HT: 'Haiti', JM: 'Jamaica', TT: 'Trinidad and Tobago',
  FJ: 'Fiji', PG: 'Papua New Guinea',
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
 * Evidence-based variant→gender guesses for Google TTS and the Samsung
 * "Default"/"Premium" engines. These codes are engine internals and are not
 * documented by Google, but the following are well-established across the
 * community (Saiy reverse-engineering + Stack Overflow reports):
 *   - en-US: x-sfg = female, x-tpf = male, x-tpd/x-tpc = female
 *   - en-GB: x-rjs = male, x-fis = female
 *   - en-IN: x-ene / x-end = male
 *   - hi-IN: x-hie = male
 * Only ever used as a last resort when the engine exposes no explicit gender
 * feature and no "#male"/"#female" marker is present.
 */
const VARIANT_GENDER: Record<string, 'female' | 'male'> = {
  sfg: 'female',
  tpd: 'female',
  tpc: 'female',
  tpf: 'male',
  rjs: 'male',
  fis: 'female',
  ene: 'male',
  end: 'male',
  hie: 'male',
};

/**
 * Determine a voice's gender, preferring authoritative signals in order:
 *   1. Android `Voice.getFeatures()` (from native module) — the engine's own word
 *   2. "#female_N" / "#male_N" markers embedded in Google TTS voice names
 *   3. Evidence-based variant codes (see VARIANT_GENDER) — last resort only
 * Unknown → 'unknown' (renders without a gender symbol).
 */
function guessGender(id: string, featureGender?: 'female' | 'male' | undefined): 'female' | 'male' | 'unknown' {
  if (featureGender === 'male' || featureGender === 'female') return featureGender;
  const marker = id.match(/#(male|female)/i);
  if (marker) return marker[1].toLowerCase() as 'female' | 'male';
  const variant = id.match(/-x-([a-z]{3})(?:-|$)/i);
  if (variant) {
    const v = variant[1].toLowerCase();
    if (VARIANT_GENDER[v]) return VARIANT_GENDER[v];
  }
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
  voices: T[],
  genders?: Map<string, 'female' | 'male'>
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
    const gender = guessGender(
      voice.identifier || voice.name,
      genders?.get(voice.identifier || voice.name)
    );

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
