const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('tts_reviews.json', 'utf8'));

// Keywords to categorize complaints/requests
const CATEGORIES = {
  'background_playback': /background|screen off|lock screen|minimize|switch app|multitask/i,
  'ads': /ads?|advertis|banner|popup|commercial/i,
  'subscription_pricing': /subscri|premium|paid|expensive|price|cost|money|pay|free/i,
  'voice_quality': /robot|natural|voice quality|sound quality|human|realistic|monotone/i,
  'speed_control': /speed|rate|fast|slow|pace|wpm/i,
  'file_format': /pdf|epub|doc|word|file format|import|open file/i,
  'share_intent': /share|clipboard|copy paste|other app|chrome|browser|whatsapp/i,
  'export_mp3': /export|save audio|mp3|download audio|wav|record|audio file/i,
  'sleep_timer': /sleep|timer|bed|night|auto stop/i,
  'bookmark': /bookmark|save position|resume|where i left|mark|place/i,
  'highlight': /highlight|follow along|word by word|karaoke|underline|cursor/i,
  'language': /language|multilingual|translate|hindi|spanish|french|arabic|chinese|detect/i,
  'offline': /offline|no internet|without internet|data|wifi/i,
  'crash_bug': /crash|bug|freeze|stuck|error|broken|not work|doesn.t work|won.t|stopped/i,
  'ui_ux': /interface|ui|ux|design|ugly|confusing|complicated|simple|clean|easy/i,
  'web_url': /url|web|website|article|link|page|browser/i,
  'ocr_camera': /camera|ocr|scan|photo|picture|image/i,
  'widget_notification': /widget|notification|control|lock screen control|quick/i,
  'cloud_sync': /sync|cloud|backup|device|transfer/i,
  'pronunciation': /pronunciat|dictionary|custom word|say wrong/i,
};

for (const [appId, data] of Object.entries(raw)) {
  const reviews = data.results || [];
  if (!reviews.length) continue;

  const total = reviews.length;
  const avgScore = (reviews.reduce((s, r) => s + (r.score || 0), 0) / total).toFixed(1);
  const low = reviews.filter(r => r.score <= 3);
  const high = reviews.filter(r => r.score >= 4);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`APP: ${appId}`);
  console.log(`Reviews: ${total} | Avg: ${avgScore} | Critical(1-3): ${low.length} | Positive(4-5): ${high.length}`);
  console.log(`${'='.repeat(70)}`);

  // Categorize negative reviews
  const catCounts = {};
  const catExamples = {};
  for (const r of low) {
    if (!r.text || r.text.trim().length < 15) continue;
    for (const [cat, regex] of Object.entries(CATEGORIES)) {
      if (regex.test(r.text)) {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        if (!catExamples[cat]) catExamples[cat] = [];
        if (catExamples[cat].length < 2) {
          catExamples[cat].push(`[${r.score}/5] ${r.text.trim().slice(0, 150)}`);
        }
      }
    }
  }

  // Sort by frequency
  const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    console.log(`\nTop complaints in negative reviews:`);
    for (const [cat, count] of sorted.slice(0, 10)) {
      console.log(`  ${cat}: ${count} mentions`);
      for (const ex of (catExamples[cat] || [])) {
        console.log(`    → ${ex}`);
      }
    }
  }

  // Also check positive reviews for feature praise
  console.log(`\nMost praised features in positive reviews:`);
  const praiseCounts = {};
  for (const r of high) {
    if (!r.text || r.text.trim().length < 15) continue;
    for (const [cat, regex] of Object.entries(CATEGORIES)) {
      if (regex.test(r.text)) {
        praiseCounts[cat] = (praiseCounts[cat] || 0) + 1;
      }
    }
  }
  const sortedPraise = Object.entries(praiseCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedPraise.slice(0, 5)) {
    console.log(`  ${cat}: ${count} positive mentions`);
  }
}

// Cross-app summary
console.log(`\n${'='.repeat(70)}`);
console.log(`CROSS-APP SUMMARY: Most common complaints across ALL TTS apps`);
console.log(`${'='.repeat(70)}`);

const globalCounts = {};
for (const [appId, data] of Object.entries(raw)) {
  const reviews = (data.results || []).filter(r => r.score <= 3 && r.text && r.text.trim().length > 15);
  for (const r of reviews) {
    for (const [cat, regex] of Object.entries(CATEGORIES)) {
      if (regex.test(r.text)) {
        globalCounts[cat] = (globalCounts[cat] || 0) + 1;
      }
    }
  }
}
const globalSorted = Object.entries(globalCounts).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of globalSorted) {
  console.log(`  ${cat}: ${count} total negative mentions across all apps`);
}
