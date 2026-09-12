const fs = require('fs');
const path = require('path');

const oldContent = fs.readFileSync('src/utils/siteDictionary.ts', 'utf8');

function extractLangDict(content, lang) {
  const dict = {};
  const regex = new RegExp(`"${lang}":\\s*\\{([\\s\\S]*?)\\n  \\}`, 'm');
  const match = content.match(regex);
  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const kv = line.match(/^\s*"([^"]+)":\s*"([^"]+)",?\s*$/);
      if (kv) {
        dict[kv[1]] = kv[2];
      }
    }
  }
  return dict;
}

const langMaps = {
  en: extractLangDict(oldContent, 'en'),
  hi: extractLangDict(oldContent, 'hi'),
  ur: extractLangDict(oldContent, 'ur'),
  zh: extractLangDict(oldContent, 'zh'),
  tl: extractLangDict(oldContent, 'tl'),
  id: extractLangDict(oldContent, 'id'),
};

const priorityPhrases = JSON.parse(fs.readFileSync('/tmp/priority_phrases.json', 'utf8'));
console.log('Priority phrases count:', priorityPhrases.length);

// We will translate items missing in en
const missingInEn = priorityPhrases.filter(p => !langMaps.en[p]);
console.log('Missing in EN count:', missingInEn.length);

const targetLangs = [
  { code: 'en', gt: 'en' },
  { code: 'hi', gt: 'hi' },
  { code: 'ur', gt: 'ur' },
  { code: 'zh', gt: 'zh-CN' },
  { code: 'tl', gt: 'tl' },
  { code: 'id', gt: 'id' },
];

async function translateBatch(items, gtLang) {
  const delimiter = ' ||| ';
  const combined = items.join(delimiter);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${gtLang}&dt=t&q=` + encodeURIComponent(combined);
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const fullText = data[0].map(x => x[0]).join('');
    const parts = fullText.split(/\s*\|\|\|\s*/);
    return parts;
  } catch (err) {
    console.error(`Batch translate error for ${gtLang}:`, err.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const batchSize = 30;
  // Limit to top 1500 most critical UI phrases and tokens to keep dictionary lightweight, performant, and instant
  const toTranslate = missingInEn.slice(0, 1500);
  console.log(`Processing ${toTranslate.length} phrases in batches of ${batchSize}...`);

  for (let i = 0; i < toTranslate.length; i += batchSize) {
    const chunk = toTranslate.slice(i, i + batchSize);
    process.stdout.write(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toTranslate.length / batchSize)}... `);

    for (const lang of targetLangs) {
      // Check if all in chunk already exist
      const needed = chunk.filter(item => !langMaps[lang.code][item]);
      if (needed.length === 0) continue;

      const results = await translateBatch(chunk, lang.gt);
      if (results && results.length === chunk.length) {
        chunk.forEach((orig, idx) => {
          const trans = (results[idx] || '').trim().replace(/"/g, "'");
          if (trans && trans.length > 0) {
            langMaps[lang.code][orig] = trans;
          }
        });
      } else {
        // Fallback: translate one by one or keep existing
        for (const item of chunk) {
          if (!langMaps[lang.code][item]) {
            try {
              const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${lang.gt}&dt=t&q=` + encodeURIComponent(item));
              const d = await r.json();
              const val = d[0].map(x => x[0]).join('').trim().replace(/"/g, "'");
              if (val) langMaps[lang.code][item] = val;
            } catch (e) {}
          }
        }
      }
      await sleep(50);
    }
    console.log('done.');
    await sleep(100);
  }

  console.log('Final counts:', {
    en: Object.keys(langMaps.en).length,
    hi: Object.keys(langMaps.hi).length,
    ur: Object.keys(langMaps.ur).length,
    zh: Object.keys(langMaps.zh).length,
    tl: Object.keys(langMaps.tl).length,
    id: Object.keys(langMaps.id).length,
  });

  fs.writeFileSync('/tmp/translated_lang_maps.json', JSON.stringify(langMaps));
  console.log('Saved to /tmp/translated_lang_maps.json');
}

main().catch(console.error);
