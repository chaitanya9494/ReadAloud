/** Sample phrases per language code for voice preview. */
const S: Record<string, string> = {
  af: 'Hallo, dit is my voorbeeldstem.',
  am: 'ሰላም፣ ይህ የእኔ ናሙና ድምፅ ነው።',
  ar: 'مرحبًا، هذا هو صوتي التجريبي.',
  bg: 'Здравейте, това е моят примерен глас.',
  bn: 'হ্যালো, এটি আমার নমুনা কণ্ঠস্বর।',
  bs: 'Zdravo, ovo je moj primjer glasa.',
  ca: 'Hola, aquesta és la meva veu de mostra.',
  cs: 'Ahoj, toto je můj ukázkový hlas.',
  da: 'Hej, dette er min stemmeprøve.',
  de: 'Hallo, das ist meine Beispielstimme.',
  el: 'Γεια σας, αυτή είναι η δοκιμαστική φωνή μου.',
  en: 'Hello, this is my sample voice.',
  es: 'Hola, esta es mi voz de muestra.',
  fa: 'سلام، این صدای نمونه من است.',
  fi: 'Hei, tämä on esimerkkiääneni.',
  fil: 'Kumusta, ito ang aking sample na boses.',
  fr: "Bonjour, ceci est ma voix d'exemple.",
  gu: 'નમસ્તે, આ મારો નમૂના અવાજ છે.',
  hi: 'नमस्ते, यह मेरी नमूना आवाज़ है।',
  hr: 'Zdravo, ovo je moj primjer glasa.',
  hu: 'Helló, ez az én mintahangom.',
  id: 'Halo, ini adalah suara contoh saya.',
  is: 'Halló, þetta er sýnishornið mitt.',
  it: 'Ciao, questa è la mia voce di esempio.',
  iw: 'שלום, זהו קול הדוגמה שלי.',
  ja: 'こんにちは、これは私のサンプル音声です。',
  ka: 'გამარჯობა, ეს ჩემი სანიმუშო ხმაა.',
  kn: 'ನಮಸ್ಕಾರ, ಇದು ನನ್ನ ಮಾದರಿ ಧ್ವನಿ.',
  ko: '안녕하세요, 이것은 제 샘플 음성입니다.',
  ml: 'ഹലോ, ഇത് എന്റെ സാമ്പിൾ ശബ്ദമാണ്.',
  mr: 'नमस्कार, हा माझा नमुना आवाज आहे.',
  ms: 'Halo, ini adalah suara contoh saya.',
  my: 'မင်္ဂလာပါ၊ ဒါက ကျွန်တော့်နမူနာအသံပါ။',
  nb: 'Hei, dette er min stemmeprøve.',
  ne: 'नमस्ते, यो मेरो नमूना आवाज हो।',
  nl: 'Hallo, dit is mijn voorbeeldstem.',
  pl: 'Cześć, to jest mój przykładowy głos.',
  pt: 'Olá, esta é a minha voz de exemplo.',
  ro: 'Bună, aceasta este vocea mea de exemplu.',
  ru: 'Привет, это мой пример голоса.',
  si: 'හෙලෝ, මෙය මගේ නියැදි හඬයි.',
  sk: 'Ahoj, toto je môj ukážkový hlas.',
  sl: 'Živjo, to je moj vzorčni glas.',
  sr: 'Здраво, ово је мој пример гласа.',
  sv: 'Hej, det här är min exempelröst.',
  sw: 'Habari, hii ni sauti yangu ya mfano.',
  ta: 'வணக்கம், இது என் மாதிரி குரல்.',
  te: 'హలో, ఇది నా నమూనా స్వరం.',
  th: 'สวัสดี นี่คือเสียงตัวอย่างของฉัน',
  tr: 'Merhaba, bu benim örnek sesim.',
  uk: 'Привіт, це мій зразок голосу.',
  ur: 'ہیلو، یہ میری نمونہ آواز ہے۔',
  vi: 'Xin chào, đây là giọng mẫu của tôi.',
};

// Additional entries
S['yue'] = '你好，這是我的示範聲音。';
S['zh'] = '你好，这是我的示例语音。';
S['zu'] = 'Sawubona, leli yizwi lami lesibonelo.';

/**
 * Get a sample phrase for a given voice language code.
 * Falls back to English if the language isn't mapped.
 */
export function getSamplePhrase(langCode: string): string {
  // Try exact match first (e.g. "en")
  const base = langCode.split('-')[0].toLowerCase();
  return S[base] || S['en'];
}
