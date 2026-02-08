const fs = require('fs');

// Load all data sources
const allNames = new Set();
const nameDetails = [];

// Source 1: top50_tts_reviews.json
try {
  const top50 = JSON.parse(fs.readFileSync('top50_tts_reviews.json', 'utf8'));
  for (const [appId, data] of Object.entries(top50)) {
    const name = data.title || appId;
    allNames.add(name.toLowerCase());
    nameDetails.push({ name, score: data.score, source: 'top50', appId });
  }
} catch (e) { console.log('Skipped top50:', e.message); }

// Source 2: tts_reviews.json
try {
  const tts = JSON.parse(fs.readFileSync('tts_reviews.json', 'utf8'));
  for (const [appId, data] of Object.entries(tts)) {
    const name = data.title || appId;
    if (!allNames.has(name.toLowerCase())) {
      allNames.add(name.toLowerCase());
      nameDetails.push({ name, score: data.score, source: 'tts_reviews', appId });
    }
  }
} catch (e) { console.log('Skipped tts_reviews:', e.message); }

// Source 3: top_apps.json
try {
  const topApps = JSON.parse(fs.readFileSync('top_apps.json', 'utf8'));
  const apps = Array.isArray(topApps) ? topApps : (topApps.results || topApps.apps || []);
  for (const app of apps) {
    const name = app.title || app.name || app.appId || '';
    if (name && !allNames.has(name.toLowerCase())) {
      allNames.add(name.toLowerCase());
      nameDetails.push({ name, score: app.score, source: 'top_apps', appId: app.appId });
    }
  }
} catch (e) { console.log('Skipped top_apps:', e.message); }

console.log(`\n${'='.repeat(70)}`);
console.log(`TOTAL UNIQUE APPS FOUND: ${nameDetails.length}`);
console.log(`${'='.repeat(70)}`);

// Sort alphabetically and print all
nameDetails.sort((a, b) => a.name.localeCompare(b.name));
console.log('\n--- ALL APP NAMES ---');
for (const d of nameDetails) {
  console.log(`  ${d.name} | ${d.score || 'N/A'} | ${d.source}`);
}

// Analyze naming patterns
const lowerNames = nameDetails.map(d => d.name.toLowerCase());

console.log(`\n${'='.repeat(70)}`);
console.log('NAMING PATTERN ANALYSIS');
console.log(`${'='.repeat(70)}`);

const patterns = {
  'Contains "read"': lowerNames.filter(n => /\bread/.test(n)).length,
  'Contains "voice"': lowerNames.filter(n => /voice/.test(n)).length,
  'Contains "speech"': lowerNames.filter(n => /speech/.test(n)).length,
  'Contains "text"': lowerNames.filter(n => /text/.test(n)).length,
  'Contains "tts"': lowerNames.filter(n => /tts/.test(n)).length,
  'Contains "speak"': lowerNames.filter(n => /speak/.test(n)).length,
  'Contains "aloud"': lowerNames.filter(n => /aloud/.test(n)).length,
  'Contains "listen"': lowerNames.filter(n => /listen/.test(n)).length,
  'Contains "audio"': lowerNames.filter(n => /audio|audi/.test(n)).length,
  'Contains "narrat"': lowerNames.filter(n => /narrat/.test(n)).length,
  'Contains "loud"': lowerNames.filter(n => /loud/.test(n)).length,
  'Ends with "-ify"': lowerNames.filter(n => /ify\b/.test(n)).length,
  'Ends with "-er/-or"': lowerNames.filter(n => /[eo]r\b/.test(n)).length,
  'Has AI in name': lowerNames.filter(n => /\bai\b/.test(n)).length,
};

const sortedPatterns = Object.entries(patterns).sort((a, b) => b[1] - a[1]);
for (const [p, c] of sortedPatterns) {
  console.log(`  ${p}: ${c}/${nameDetails.length} (${Math.round(c/nameDetails.length*100)}%)`);
}

// Check our candidate names against ALL existing names
console.log(`\n${'='.repeat(70)}`);
console.log('CANDIDATE NAME COLLISION CHECK');
console.log(`${'='.repeat(70)}`);

const candidates = [
  'Readify', 'Readly', 'Readivo', 'Readora', 'Readion', 'Readably',
  'Loudify', 'Listenify', 'Narratify', 'Narratio',
  'Speako', 'Audora', 'VoiceBox', 'Readlet',
  'Readwave', 'SpeakFlow', 'EchoText', 'InkSpeak',
  'Verba', 'Voca', 'Narro', 'Tella', 'Audie',
  'ReadOut', 'Aloud', 'Outloud', 'Spoken',
  'Text2Voice', 'HearIt', 'PageVoice', 'ReadEar',
  'ClearVoice', 'ListenUp', 'WordFlow',
];

for (const candidate of candidates) {
  const lower = candidate.toLowerCase();
  // Exact match
  const exact = lowerNames.filter(n => n === lower);
  // Partial match (candidate appears as a word in existing name)
  const partial = lowerNames.filter(n => n !== lower && n.includes(lower));
  // Similar sounding (first 4 chars match)
  const prefix = lower.slice(0, 4);
  const similar = nameDetails.filter(d => 
    d.name.toLowerCase().startsWith(prefix) && 
    d.name.toLowerCase() !== lower
  );

  let status = '✅ CLEAR';
  if (exact.length > 0) status = '❌ EXACT MATCH';
  else if (partial.length > 0) status = '⚠️ PARTIAL MATCH';
  else if (similar.length > 2) status = '⚠️ CROWDED PREFIX';

  const details = [];
  if (exact.length) details.push(`Exact: ${exact.join(', ')}`);
  if (partial.length) details.push(`In: ${partial.slice(0,3).join(', ')}`);
  if (similar.length) details.push(`Similar: ${similar.slice(0,3).map(s=>s.name).join(', ')}`);

  console.log(`  ${status} ${candidate}${details.length ? ' — ' + details.join(' | ') : ''}`);
}

// Extract most-used WORDS in app names for keyword insight
console.log(`\n${'='.repeat(70)}`);
console.log('MOST USED WORDS IN APP NAMES (keyword density)');
console.log(`${'='.repeat(70)}`);

const wordCounts = {};
const stopWords = new Set(['to', 'the', 'a', 'an', 'and', 'or', 'for', 'of', 'in', 'by', '-', '–', '—', '|', '&', 'all', 'pro', 'app']);
for (const d of nameDetails) {
  const words = d.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  for (const w of words) {
    if (w.length > 1 && !stopWords.has(w)) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  }
}
const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
for (const [w, c] of sortedWords.slice(0, 25)) {
  console.log(`  "${w}": ${c} apps`);
}
