const fs = require('fs');

const APPS = [
  'com.naturalsoft.personalweb',       // NaturalReader
  'com.cliffweitzman.speechify2',      // Speechify
  'io.elevenlabs.readerapp',           // ElevenReader
  'com.hyperionics.avar',              // @Voice Aloud Reader
  'com.ReadTheTextForMe',              // Text reader
  'com.tangerinesoftwarehouse.audify', // Audify
  'com.labsiisoftware.speechcentral',  // Speech Central
  'com.alpaca.android.readout',        // Text to Speech (Alpaca)
];

async function fetchReviews(appId) {
  try {
    const res = await fetch(`http://localhost:3001/api/apps/${appId}/reviews?num=150`);
    const data = await res.json();
    // reviews are under results.data
    const reviews = data.results?.data || data.results || [];
    return { appId, results: Array.isArray(reviews) ? reviews : [] };
  } catch (e) {
    return { appId, results: [], error: e.message };
  }
}

async function main() {
  const all = {};
  for (const appId of APPS) {
    console.log(`Fetching ${appId}...`);
    all[appId] = await fetchReviews(appId);
  }
  fs.writeFileSync('tts_reviews.json', JSON.stringify(all, null, 2));
  console.log('Done! Saved to tts_reviews.json');
}

main();
