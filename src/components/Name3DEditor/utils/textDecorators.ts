export interface DecorationGroup {
    category: string;
    items: string[];
}

export const decorateText = (text: string): DecorationGroup[] => {
    if (!text) return [];
    
    const groups: DecorationGroup[] = [];
    
    // --- Arabic Pure Text Decorations ---
    const isArabic = /[\u0600-\u06FF]/.test(text);
    if (isArabic) {
        const pureArabic = new Set<string>();
        
        // 1. Tatweel Variations (تطويل)
        pureArabic.add(text.split('').join('ـ')); // تطويل خفيف
        pureArabic.add(text.split('').join('ــ')); // تطويل متوسط
        pureArabic.add(text.split('').join('ــــ')); // تطويل كبير
        
        // 2. Separated letters (مقطّع)
        pureArabic.add(text.split('').join(' '));

        // 3. Tashkeel variations (تشكيل)
        const addTashkeel = (txt: string, type: 'light' | 'heavy' | 'random') => {
            const harakat = ['َ', 'ً', 'ُ', 'ٌ', 'ِ', 'ٍ', 'ْ', 'ّ'];
            let res = '';
            for (let i = 0; i < txt.length; i++) {
                res += txt[i];
                if (txt[i] !== ' ' && txt[i] !== 'ـ') {
                    if (type === 'heavy') {
                        res += harakat[Math.floor(Math.random() * harakat.length)];
                        res += harakat[Math.floor(Math.random() * harakat.length)];
                    } else if (type === 'light') {
                        if (Math.random() > 0.5) res += harakat[Math.floor(Math.random() * harakat.length)];
                    } else {
                        if (Math.random() > 0.3) res += harakat[Math.floor(Math.random() * harakat.length)];
                    }
                }
            }
            return res;
        };

        pureArabic.add(addTashkeel(text, 'light'));
        pureArabic.add(addTashkeel(text, 'heavy'));
        pureArabic.add(addTashkeel(text.split('').join('ـ'), 'light'));
        pureArabic.add(addTashkeel(text.split('').join('ــ'), 'heavy'));

        // 4. Letter Replacements (Persian/Urdu variants - الحروف الفارسية والتركية)
        const persianMap: Record<string, string> = { 'ك': 'ک', 'ي': 'ی', 'ة': 'ه', 'ه': 'ھ', 'ق': 'ڨ', 'ف': 'ڤ', 'ز': 'ژ', 'ج': 'چ' };
        pureArabic.add(text.split('').map(c => persianMap[c] || c).join(''));
        pureArabic.add(text.split('').map(c => persianMap[c] || c).join('ـ'));

        // 5. Without dots (حذف النقط - الدارجة قديماً)
        const noDotsMap: Record<string, string> = {
            'ب':'ٮ', 'ت':'ٮ', 'ث':'ٮ', 'ن':'ٮ', 'ي':'ى', 'ئ':'ى',
            'ج':'ح', 'خ':'ح', 'ز':'ر', 'ذ':'د', 'ش':'س', 'ض':'ص',
            'ظ':'ط', 'غ':'ع', 'ف':'ڡ', 'ق':'ٯ', 'ة':'ه'
        };
        pureArabic.add(text.split('').map(c => noDotsMap[c] || c).join(''));

        // 6. Strikethrough / Underline in Arabic
        pureArabic.add(text.split('').map(c => c + '\u0336').join('')); // Strikethrough
        pureArabic.add(text.split('').map(c => c + '\u0332').join('')); // Underline

        groups.push({ category: "زخرفة خطية (عربي)", items: Array.from(pureArabic).slice(0, 20) });
    }

    // --- English Pure Text Decorations (Unicode Fonts) ---
    const isEnglish = /[a-zA-Z]/.test(text);
    if (isEnglish) {
        const pureEng = new Set<string>();
        
        const mapChars = (txt: string, mapFn: (c: string) => string) => txt.split('').map(mapFn).join('');
        
        const generateMath = (upperOffset: number, lowerOffset: number, exceptions?: Record<string, string>) => {
            return mapChars(text, c => {
                if (exceptions && exceptions[c]) return exceptions[c];
                if (c >= 'A' && c <= 'Z') return String.fromCodePoint(c.codePointAt(0)! + upperOffset);
                if (c >= 'a' && c <= 'z') return String.fromCodePoint(c.codePointAt(0)! + lowerOffset);
                return c;
            });
        };

        // 1. Math Bold (𝐀𝐛𝐜)
        pureEng.add(generateMath(119808 - 65, 119834 - 97));
        // 2. Math Italic (𝐴𝑏𝑐)
        pureEng.add(generateMath(119860 - 65, 119886 - 97, {'h':'ℎ'}));
        // 3. Math Bold Italic (𝑨𝒃𝒄)
        pureEng.add(generateMath(119912 - 65, 119938 - 97));
        // 4. Script (𝒜𝒷𝒸)
        pureEng.add(generateMath(119964 - 65, 119990 - 97, { 'B': 'ℬ', 'E': 'ℰ', 'F': 'ℱ', 'H': 'ℋ', 'I': 'ℐ', 'L': 'ℒ', 'M': 'ℳ', 'R': 'ℜ', 'e': 'ℯ', 'g': 'ℊ', 'o': 'ℴ' }));
        // 5. Bold Script (𝓐𝓫𝓬)
        pureEng.add(generateMath(120016 - 65, 120042 - 97));
        // 6. Fraktur (𝔄𝔟𝔠)
        pureEng.add(generateMath(120068 - 65, 120094 - 97, { 'C': 'ℭ', 'H': 'ℌ', 'I': 'ℑ', 'R': 'ℜ', 'Z': 'ℨ' }));
        // 7. Bold Fraktur (𝕬𝖇𝖈)
        pureEng.add(generateMath(120172 - 65, 120198 - 97));
        // 8. Double Struck (𝔸𝕓𝕔)
        pureEng.add(generateMath(120120 - 65, 120146 - 97, { 'C': 'ℂ', 'H': 'ℍ', 'N': 'ℕ', 'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ', 'Z': 'ℤ' }));
        // 9. Sans-serif (𝖠𝖻𝖼)
        pureEng.add(generateMath(120224 - 65, 120250 - 97));
        // 10. Sans-serif Bold (𝗔𝗯𝗰)
        pureEng.add(generateMath(120276 - 65, 120302 - 97));
        // 11. Sans-serif Italic (𝘗𝘲𝘳)
        pureEng.add(generateMath(120328 - 65, 120354 - 97));
        // 12. Monospace (𝙰𝚋𝚌)
        pureEng.add(generateMath(120432 - 65, 120458 - 97));

        // 13. Small caps (ᴀʙᴄ)
        const smallCaps: Record<string, string> = { 'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ' };
        pureEng.add(mapChars(text, c => smallCaps[c.toLowerCase()] || c));
        
        // 14. Fullwidth
        pureEng.add(mapChars(text, c => {
            const code = c.charCodeAt(0);
            if (code >= 33 && code <= 126) return String.fromCharCode(code + 65248);
            if (code === 32) return String.fromCharCode(12288);
            return c;
        }));

        // 15. Circled
        pureEng.add(mapChars(text, c => {
            if (c >= 'A' && c <= 'Z') return String.fromCodePoint(c.charCodeAt(0) - 65 + 0x24B6);
            if (c >= 'a' && c <= 'z') return String.fromCodePoint(c.charCodeAt(0) - 97 + 0x24D0);
            return c;
        }));

        // 16. Squared Negative
        pureEng.add(mapChars(text, c => {
            const upperC = c.toUpperCase();
            if (upperC >= 'A' && upperC <= 'Z') return String.fromCodePoint(upperC.charCodeAt(0) - 65 + 0x1F170);
            return c;
        }));

        // 17. Upside Down (uʍop ǝpısdn)
        const upsideDownMap: Record<string, string> = { 'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ı','j':'ɾ','k':'ʞ','l':'ן','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x','y':'ʎ','z':'z','A':'∀','B':'𐐒','C':'Ɔ','D':'◖','E':'Ǝ','F':'Ⅎ','G':'⅁','H':'H','I':'I','J':'ſ','K':'ʞ','L':'˥','M':'W','N':'N','O':'O','P':'Ԁ','Q':'Ὁ','R':'ᴚ','S':'S','T':'⊥','U':'∩','V':'Λ','W':'M','X':'X','Y':'⅄','Z':'Z' };
        pureEng.add(text.split('').reverse().map(c => upsideDownMap[c] || c).join(''));
        
        // 18. Leetspeak (1337)
        const leetMap: Record<string, string> = { 'a':'4','e':'3','i':'1','o':'0','s':'5','t':'7','l':'1','g':'9','b':'8' };
        pureEng.add(mapChars(text, c => leetMap[c.toLowerCase()] || c));

        // 19. Strikethrough & Overline
        pureEng.add(mapChars(text, c => c + '\u0336')); // Strikethrough
        pureEng.add(mapChars(text, c => c + '\u0332')); // Underline
        pureEng.add(mapChars(text, c => c + '\u0330')); // Wavy underline

        // 20. Zalgo (glitchy)
        const zalgoUp = ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306', '\u0310', '\u0352', '\u0351', '\u0300', '\u0301', '\u0302', '\u0303', '\u030a', '\u030b', '\u030c', '\u0312', '\u0313', '\u0314', '\u0315', '\u031b', '\u033d', '\u0309', '\u0346', '\u031a', '\u0342', '\u0318', '\u0319', '\u0323', '\u0324', '\u0325', '\u0326', '\u032d', '\u032e', '\u0330', '\u0331', '\u032b', '\u032c'];
        pureEng.add(mapChars(text, c => {
            let z = c;
            for(let i=0; i<3; i++) z += zalgoUp[Math.floor(Math.random() * zalgoUp.length)];
            return z;
        }));

        groups.push({ category: "زخرفة خطية (إنجليزي)", items: Array.from(pureEng).slice(0, 25) });
    }

    // --- Symbols & Patterns ---
    const symbolic = new Set<string>();
    symbolic.add(`★ ${text} ★`);
    symbolic.add(`♛ ${text} ♛`);
    symbolic.add(`꧁ ${text} ꧂`);
    symbolic.add(`✿ ${text} ✿`);
    symbolic.add(`« ${text} »`);
    symbolic.add(`} { ${text} } {`);
    symbolic.add(`⸻ ${text} ⸻`);
    symbolic.add(`✗ ${text} ✗`);
    symbolic.add(`∞ ${text} ∞`);
    symbolic.add(`[̲̅${text.split('').join('̲̅')}]̲̅`);
    symbolic.add(text.split('').join('⋆'));
    symbolic.add(text.split('').join('✧'));
    symbolic.add(text.split('').join('•'));
    symbolic.add(`░▒▓█ ${text} █▓▒░`);
    symbolic.add(`【 ${text} 】`);
    symbolic.add(`『 ${text} 』`);
    symbolic.add(`✧･ﾟ: *✧･ﾟ:* ${text} *:･ﾟ✧*:･ﾟ✧`);
    
    groups.push({ category: "رموز وإطارات", items: Array.from(symbolic) });

    return groups;
};
