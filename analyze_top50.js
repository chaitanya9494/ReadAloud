const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('top50_tts_reviews.json', 'utf8'));

const CATS = {
  ads: /\bads?\b|advertis|banner|popup|commercial/i,
  subscription: /subscri|premium|paid|expensive|price|cost|pay\b|free trial/i,
  crash_bug: /crash|bug|freeze|stuck|error|broken|not work|doesn.t work|won.t|stopped|glitch/i,
  background: /background|screen off|lock screen|minimize|switch app|multitask/i,
  voice_quality: /robot|natural|voice quality|sound quality|human|realistic|monotone|robotic/i,
  speed_control: /speed|rate|fast|slow|pace|wpm|adjust/i,
  file_format: /\bpdf\b|epub|doc\b|docx|word|file format|import|open file/i,
  share_intent: /share from|clipboard|copy paste|other app|chrome|browser|whatsapp/i,
  export_mp3: /export|save audio|mp3|download audio|wav|record|audio file|save.*voice/i,
  sleep_timer: /sleep|timer|bed|night|auto stop/i,
  bookmark: /bookmark|save position|resume|where i left|mark|place|remember/i,
  highlight: /highlight|follow along|word.by.word|karaoke|underline|cursor/i,
  language: /language|multilingual|translate|hindi|spanish|french|arabic|chinese|detect/i,
  offline: /offline|no internet|without internet|data|wifi/i,
  web_url: /\burl\b|web\b|website|article|link|page|browser/i,
  ocr_camera: /camera|ocr|scan|photo|picture|image/i,
  widget_notif: /widget|notification|control|lock screen control|quick setting/i,
  cloud_sync: /sync|cloud|backup|device|transfer/i,
  pronunciation: /pronunciat|dictionary|custom word|say wrong|mispronoun/i,
  ui_ux: /interface|ui\b|ux\b|design|ugly|confusing|complicated|simple|clean|easy to use/i,
  char_limit: /limit|character|word limit|too short|max|6000|5000|truncat/i,
};

let totalReviews = 0, totalApps = 0;
const globalNeg = {}, globalPos = {}, globalNegExamples = {};
for (const c of Object.keys(CATS)) { globalNeg[c] = 0; globalPos[c] = 0; globalNegExamples[c] = []; }

// Features each app advertises (from descriptions/reviews)
const featureMatrix = {};

for (const [appId, data] of Object.entries(raw)) {
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  if (!reviews.length) continue;
  totalApps++;
  totalReviews += reviews.length;
  const neg = reviews.filter(r => r.score <= 3 && r.text && r.text.trim().length > 15);
  const pos = reviews.filter(r => r.score >= 4 && r.text && r.text.trim().length > 15);

  for (const r of neg) {
    for (const [cat, regex] of Object.entries(CATS)) {
      if (regex.test(r.text)) {
        globalNeg[cat]++;
        if (globalNegExamples[cat].length < 3) {
          globalNegExamples[cat].push(`[${data.title}] [${r.score}★] ${r.text.trim().slice(0, 120)}`);
        }
      }
    }
  }
  for (const r of pos) {
    for (const [cat, regex] of Object.entries(CATS)) {
      if (regex.test(r.text)) globalPos[cat]++;
    }
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log(`ANALYSIS: ${totalApps} TTS apps, ${totalReviews} total reviews`);
console.log(`${'='.repeat(70)}`);

console.log(`\n--- TOP PAIN POINTS (negative reviews, score 1-3) ---`);
const sortedNeg = Object.entries(globalNeg).sort((a,b) => b[1] - a[1]);
for (const [cat, count] of sortedNeg) {
  console.log(`\n  ${cat}: ${count} complaints`);
  for (const ex of globalNegExamples[cat]) console.log(`    → ${ex}`);
}

console.log(`\n--- MOST PRAISED FEATURES (positive reviews, score 4-5) ---`);
const sortedPos = Object.entries(globalPos).sort((a,b) => b[1] - a[1]);
for (const [cat, count] of sortedPos) {
  console.log(`  ${cat}: ${count} positive mentions`);
}

// Our app feature checklist
console.log(`\n${'='.repeat(70)}`);
console.log(`READALOUD GAP ANALYSIS vs TOP 50 TTS APPS`);
console.log(`${'='.repeat(70)}`);
const OUR = {
  ads: { have: true, note: 'No ads at all — free forever' },
  subscription: { have: true, note: 'No subscription, no paywall' },
  crash_bug: { have: true, note: 'Simple arch, minimal crash surface' },
  background: { have: true, note: 'expo-av background audio hook' },
  voice_quality: { have: false, note: 'Uses system TTS only, no AI voices' },
  speed_control: { have: true, note: '0.5x to 2.0x with cycle button' },
  file_format: { have: true, note: 'TXT, PDF, EPUB, DOCX, HTML, RTF' },
  share_intent: { have: true, note: 'Android SEND + PROCESS_TEXT intents' },
  export_mp3: { have: true, note: 'Export via TTS playback + share' },
  sleep_timer: { have: true, note: '5/15/30/45/60/90 min options' },
  bookmark: { have: true, note: 'Named bookmarks within documents' },
  highlight: { have: true, note: 'Word-level + sentence-level highlight' },
  language: { have: true, note: 'Auto-detect + voice matching' },
  offline: { have: true, note: 'Fully offline, system TTS' },
  web_url: { have: true, note: 'URL input with article extraction' },
  ocr_camera: { have: true, note: 'Camera + gallery with OCR/manual' },
  widget_notif: { have: false, note: 'No notification/widget controls yet' },
  cloud_sync: { have: false, note: 'No cross-device sync' },
  pronunciation: { have: false, note: 'No custom pronunciation editor' },
  ui_ux: { have: true, note: 'Clean minimal UI, dark/light themes' },
  char_limit: { have: true, note: 'No character limits' },
};

for (const [cat, info] of Object.entries(OUR)) {
  const neg = globalNeg[cat] || 0;
  const icon = info.have ? '✅' : '❌';
  console.log(`  ${icon} ${cat} (${neg} complaints in competitors): ${info.note}`);
}
