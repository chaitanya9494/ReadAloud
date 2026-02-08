const fs = require('fs');

const QUERIES = [
  'text to speech read aloud',
  'tts reader voice aloud',
  'read aloud pdf epub',
  'text to speech offline',
  'voice reader text speaker',
];

async function searchApps(query) {
  const res = await fetch(
    `http://localhost:3001/api/apps/?q=${encodeURIComponent(query)}&num=30`
  );
  const data = await res.json();
  return (data.results || []).filter(a =>
    a.summary && (
      /text.to.speech|tts|read.?aloud|voice.?reader|speak|narrator/i.test(a.summary) ||
      /text.to.speech|tts|read.?aloud|voice.?reader/i.test(a.title)
    )
  );
}

async function fetchReviews(appId) {
  try {
    const res = await fetch(`http://localhost:3001/api/apps/${appId}/reviews?num=100`);
    const data = await res.json();
    return data.results?.data || data.results || [];
  } catch { return []; }
}

async function main() {
  // Collect unique TTS apps
  const seen = new Set();
  const apps = [];
  for (const q of QUERIES) {
    console.log(`Searching: ${q}`);
    const results = await searchApps(q);
    for (const app of results) {
      if (!seen.has(app.appId)) {
        seen.add(app.appId);
        apps.push({ appId: app.appId, title: app.title, score: app.score });
      }
    }
  }
  // Sort by score desc, take top 50
  apps.sort((a, b) => b.score - a.score);
  const top50 = apps.slice(0, 50);
  console.log(`Found ${apps.length} TTS apps, taking top ${top50.length}`);

  // Fetch reviews for each
  const allData = {};
  for (let i = 0; i < top50.length; i++) {
    const app = top50[i];
    console.log(`[${i+1}/${top50.length}] ${app.title} (${app.appId})`);
    const reviews = await fetchReviews(app.appId);
    allData[app.appId] = { title: app.title, score: app.score, reviews };
  }
  fs.writeFileSync('top50_tts_reviews.json', JSON.stringify(allData, null, 2));
  console.log('Done! Saved to top50_tts_reviews.json');
}
main();
