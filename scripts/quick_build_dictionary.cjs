const fs = require('fs');

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

const phraseRegex = /[\u0600-\u06FF][\u0600-\u06FF\s\d.,!?:;()\-–—_/*+&%#@\x22\x27]*[\u0600-\u06FF]/g;
const wordRegex = /[\u0600-\u06FF]+/g;

// Core UI files to extract from
const coreFiles = [
  'src/config/toolsRegistry.tsx',
  'src/components/Uploader.tsx',
  'src/components/Dashboard.tsx',
  'src/components/Header.tsx',
  'src/components/MultiSvgaViewer.tsx',
  'src/components/SvgaLayerEditor/SvgaLayerEditor.tsx',
  'src/components/SvgaLayerEditor/SvgaLayersList.tsx',
  'src/components/SvgaLayerEditor/SvgaMotionTimeline.tsx',
  'src/components/SvgaLayerEditor/SvgaPropertiesPanel.tsx',
  'src/components/SvgaBatchCompressor.tsx',
  'src/components/AIVideoMattingStudio.tsx',
  'src/components/Name3DEditor.tsx',
  'src/components/SmartAutoCropper.tsx',
  'src/components/VideoConverter.tsx',
  'src/components/UniversalMotionTools.tsx',
  'src/components/AudioExtractor.tsx',
  'src/components/ImageEnhancer.tsx',
  'src/components/ImageProcessor.tsx',
  'src/components/ImageEditor.tsx',
  'src/components/ImageMatcher.tsx',
  'src/components/PagConverter.tsx',
  'src/components/SvgaStore.tsx',
  'src/components/AdminPanel.tsx',
  'src/components/AppVersionModal.tsx',
  'src/components/AudioDurationModal.tsx',
  'src/components/FeatureWalkthroughGuide.tsx',
  'src/components/Workspace.tsx'
];

const selectedPhrases = new Set();
const wordsFreq = {};

coreFiles.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const words = content.match(wordRegex);
    if (words) {
      words.forEach(w => {
        wordsFreq[w] = (wordsFreq[w] || 0) + 1;
      });
    }
    const pMatches = content.match(phraseRegex);
    if (pMatches) {
      pMatches.forEach(p => {
        const clean = p.trim().replace(/^["\x27`]/, '').replace(/["\x27`]$/, '').trim();
        if (clean.length >= 2 && clean.length <= 60 && !clean.includes('\n') && !clean.includes('${')) {
          selectedPhrases.add(clean);
        }
      });
    }
  }
});

// Add top 150 single words
Object.entries(wordsFreq)
  .filter(([w]) => w.length >= 2)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 150)
  .forEach(([w]) => selectedPhrases.add(w));

console.log('Selected phrases to ensure in dictionary:', selectedPhrases.size);

const targetLangs = [
  { code: 'en', gt: 'en' },
  { code: 'hi', gt: 'hi' },
  { code: 'ur', gt: 'ur' },
  { code: 'zh', gt: 'zh-CN' },
  { code: 'tl', gt: 'tl' },
  { code: 'id', gt: 'id' },
];

async function translateBatch(items, gtLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${gtLang}&dt=t&q=` + encodeURIComponent(items.join('\n'));
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const fullText = data[0].map(x => x[0]).join('');
    const parts = fullText.split('\n');
    return parts;
  } catch (err) {
    console.error(`Translate error (${gtLang}):`, err.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const phrasesList = Array.from(selectedPhrases);
  const batchSize = 25;

  for (const lang of targetLangs) {
    const missing = phrasesList.filter(p => !langMaps[lang.code][p]);
    console.log(`Language ${lang.code}: ${missing.length} missing items...`);

    for (let i = 0; i < missing.length; i += batchSize) {
      const chunk = missing.slice(i, i + batchSize);
      const results = await translateBatch(chunk, lang.gt);
      if (results && results.length === chunk.length) {
        chunk.forEach((p, idx) => {
          const trans = (results[idx] || '').trim().replace(/"/g, "'");
          if (trans) langMaps[lang.code][p] = trans;
        });
      } else {
        // Fallback: set basic transliteration or fallback
        chunk.forEach((p, idx) => {
          if (results && results[idx]) {
            langMaps[lang.code][p] = results[idx].trim().replace(/"/g, "'");
          }
        });
      }
      await sleep(60);
    }
  }

  console.log('Result counts:', {
    en: Object.keys(langMaps.en).length,
    hi: Object.keys(langMaps.hi).length,
    ur: Object.keys(langMaps.ur).length,
    zh: Object.keys(langMaps.zh).length,
    tl: Object.keys(langMaps.tl).length,
    id: Object.keys(langMaps.id).length,
  });

  fs.writeFileSync('/tmp/final_lang_maps.json', JSON.stringify(langMaps, null, 2));
  console.log('Saved to /tmp/final_lang_maps.json');
}

run().catch(console.error);
