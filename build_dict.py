# -*- coding: utf-8 -*-
import json

# Master dictionary: Arabic key -> { en, hi, ur, zh, tl, id }
lexicon = {
    # Tools & Modules
    "Animation File Manager & Studio": {"en": "Animation File Manager & Studio", "hi": "एनिमेशन फ़ाइल प्रबंधक और स्टूडियो", "ur": "اینیمیشن فائل مینیجر اور اسٹوڈیو", "zh": "动画文件管理与工作室", "tl": "Tagapamahala ng File ng Animasyon", "id": "Manajer File Animasi & Studio"},
    "مدير ملفات الأنيميشن": {"en": "Animation File Manager & Studio", "hi": "एनिमेशन फ़ाइल प्रबंधक और स्टूडियो", "ur": "اینیمیشن فائل مینیجر اور اسٹوڈیو", "zh": "动画文件管理与工作室", "tl": "Tagapamahala ng File ng Animasyon", "id": "Manajer File Animasi & Studio"},
    "تحرير طبقات SVGA": {"en": "SVGA Layer Editor", "hi": "SVGA लेयर संपादक", "ur": "SVGA پرت ایڈیٹر", "zh": "SVGA 图层编辑器", "tl": "Editor ng Layer ng SVGA", "id": "Editor Lapisan SVGA"},
    "محرر طبقات SVGA": {"en": "SVGA Layer Editor", "hi": "SVGA लेयर संपादक", "ur": "SVGA پرت ایڈیٹر", "zh": "SVGA 图层编辑器", "tl": "Editor ng Layer ng SVGA", "id": "Editor Lapisan SVGA"},
    "SVGA Layer Editor": {"en": "SVGA Layer Editor", "hi": "SVGA लेयर संपादक", "ur": "SVGA پرت ایڈیٹر", "zh": "SVGA 图层编辑器", "tl": "Editor ng Layer ng SVGA", "id": "Editor Lapisan SVGA"},
    "SVGA & VAP Batch Compressor": {"en": "SVGA & VAP Batch Compressor", "hi": "SVGA और VAP बैच कंप्रेसर", "ur": "SVGA اور VAP بیچ کمپریسر", "zh": "SVGA 与 VAP 批量压缩器", "tl": "Batch Compressor ng SVGA at VAP", "id": "Kompresor Batch SVGA & VAP"},
    "ضاغط دفعات SVGA و VAP": {"en": "SVGA & VAP Batch Compressor", "hi": "SVGA और VAP बैच कंप्रेसर", "ur": "SVGA اور VAP بیچ کمپریسر", "zh": "SVGA 与 VAP 批量压缩器", "tl": "Batch Compressor ng SVGA at VAP", "id": "Kompresor Batch SVGA & VAP"},
    "ضاغط دفعات SVGA": {"en": "SVGA Batch Compressor", "hi": "SVGA बैच कंप्रेसर", "ur": "SVGA بیچ کمپریسر", "zh": "SVGA 批量压缩器", "tl": "Batch Compressor ng SVGA", "id": "Kompresor Batch SVGA"},
    "SVGA Editor EX": {"en": "SVGA Editor EX", "hi": "SVGA एडिटर EX", "ur": "SVGA ایڈیٹر EX", "zh": "SVGA 高级编辑器 EX", "tl": "SVGA Editor EX", "id": "Editor SVGA Tingkat Lanjut EX"},
    "محرر SVGA المطور": {"en": "SVGA Editor EX", "hi": "SVGA एडिटर EX", "ur": "SVGA ایڈیٹر EX", "zh": "SVGA 高级编辑器 EX", "tl": "SVGA Editor EX", "id": "Editor SVGA Tingkat Lanjut EX"},
    "PAG to SVGA Converter": {"en": "PAG to SVGA Converter", "hi": "PAG से SVGA कनवर्टर", "ur": "PAG سے SVGA کنورٹر", "zh": "PAG 转 SVGA 转换器", "tl": "Converter ng PAG sa SVGA", "id": "Konverter PAG ke SVGA"},
    "محول PAG إلى SVGA": {"en": "PAG to SVGA Converter", "hi": "PAG से SVGA कनवर्टर", "ur": "PAG سے SVGA کنورٹر", "zh": "PAG 转 SVGA 转换器", "tl": "Converter ng PAG sa SVGA", "id": "Konverter PAG ke SVGA"},
    "Multi SVGA Preview": {"en": "Multi SVGA Preview", "hi": "मल्टी SVGA पूर्वावलोकन", "ur": "ملٹی SVGA پیش نظارہ", "zh": "多重 SVGA 预览器", "tl": "Multi SVGA Previewer", "id": "Pratinjau Multi SVGA"},
    "معاينة SVGA المتعددة": {"en": "Multi SVGA Preview", "hi": "मल्टी SVGA पूर्वावलोकन", "ur": "ملٹی SVGA پیش نظارہ", "zh": "多重 SVGA 预览器", "tl": "Multi SVGA Previewer", "id": "Pratinjau Multi SVGA"},
    "عارض SVGA المتعدد": {"en": "Multi SVGA Preview", "hi": "मल्टी SVGA पूर्वावलोकन", "ur": "ملٹی SVGA پیش نظارہ", "zh": "多重 SVGA 预览器", "tl": "Multi SVGA Previewer", "id": "Pratinjau Multi SVGA"},
    "Image to SVGA": {"en": "Image to SVGA", "hi": "इमेज से SVGA", "ur": "تصویر سے SVGA", "zh": "图片转 SVGA", "tl": "Larawan patungong SVGA", "id": "Gambar ke SVGA"},
    "تحويل الصور إلى SVGA": {"en": "Image to SVGA", "hi": "इमेज से SVGA", "ur": "تصویر سے SVGA", "zh": "图片转 SVGA", "tl": "Larawan patungong SVGA", "id": "Gambar ke SVGA"},
    "AI Video Matting Studio": {"en": "AI Video Matting Studio", "hi": "AI वीडियो मैटिंग स्टूडियो", "ur": "AI ویڈیو میٹنگ اسٹوڈیو", "zh": "AI 视频抠像工作室", "tl": "AI Video Matting Studio", "id": "Studio Matting Video AI"},
    "استوديو تفريغ الفيديو بالذكاء الاصطناعي": {"en": "AI Video Matting Studio", "hi": "AI वीडियो मैटिंग स्टूडियो", "ur": "AI ویڈیو میٹنگ اسٹوڈیو", "zh": "AI 视频抠像工作室", "tl": "AI Video Matting Studio", "id": "Studio Matting Video AI"},
    "3D Theme Editor": {"en": "3D Theme Editor", "hi": "3D थीम संपादक", "ur": "3D تھیم ایڈیٹر", "zh": "3D 主题编辑器", "tl": "Editor ng 3D Tema", "id": "Editor Tema 3D"},
    "3D Name Editor": {"en": "3D Name Editor", "hi": "3D नाम संपादक", "ur": "3D نام ایڈیٹر", "zh": "3D 名字编辑器", "tl": "Editor ng 3D Pangalan", "id": "Editor Nama 3D"},
    "محرر الأسماء والسمات 3D": {"en": "3D Name & Theme Editor", "hi": "3D नाम और थीम संपादक", "ur": "3D نام اور تھیم ایڈیٹر", "zh": "3D 名字与主题编辑器", "tl": "Editor ng 3D Pangalan at Tema", "id": "Editor Nama & Tema 3D"},
    "محرر الأسماء ثلاثية الأبعاد": {"en": "3D Name Editor", "hi": "3D नाम संपादक", "ur": "3D نام ایڈیٹر", "zh": "3D 名字编辑器", "tl": "Editor ng 3D Pangalan", "id": "Editor Nama 3D"},
    "AI Image Enhancer": {"en": "AI Image Enhancer", "hi": "AI इमेज एन्हांसर", "ur": "AI تصویر بہتر بنانے والا", "zh": "AI 图像画质增强器", "tl": "AI Pampahusay ng Larawan", "id": "Peningkat Kualitas Gambar AI"},
    "محسن الصور بالذكاء الاصطناعي": {"en": "AI Image Enhancer", "hi": "AI इमेज एन्हांसर", "ur": "AI تصویر بہتر بنانے والا", "zh": "AI 图像画质增强器", "tl": "AI Pampahusay ng Larawan", "id": "Peningkat Kualitas Gambar AI"},
    "Image Processor": {"en": "Image Processor", "hi": "इमेज प्रोसेसर", "ur": "تصویر پروسیسر", "zh": "图像调色处理器", "tl": "Prosesor ng Larawan", "id": "Pemroses Gambar"},
    "معالج الصور": {"en": "Image Processor", "hi": "इमेज प्रोसेसर", "ur": "تصویر پروسیسر", "zh": "图像调色处理器", "tl": "Prosesor ng Larawan", "id": "Pemroses Gambar"},
    "Image Editor": {"en": "Image Editor", "hi": "इमेज संपादक", "ur": "تصویر ایڈیٹر", "zh": "图像编辑器", "tl": "Editor ng Larawan", "id": "Editor Gambar"},
    "محرر الصور": {"en": "Image Editor", "hi": "इमेज संपादक", "ur": "تصویر ایڈیٹر", "zh": "图像编辑器", "tl": "Editor ng Larawan", "id": "Editor Gambar"},
    "Image Matcher": {"en": "Image Matcher", "hi": "इमेज मैचर", "ur": "تصویر میچر", "zh": "图像风格匹配器", "tl": "Matcher ng Estilo ng Larawan", "id": "Pencocok Gaya Gambar"},
    "مطابقة الصور": {"en": "Image Matcher", "hi": "इमेज मैचर", "ur": "تصویر میچر", "zh": "图像风格匹配器", "tl": "Matcher ng Estilo ng Larawan", "id": "Pencocok Gaya Gambar"},
    "Audio Extractor": {"en": "Audio Extractor", "hi": "ऑडियो एक्सट्रैक्टर", "ur": "آڈیو ایکسٹریکٹر", "zh": "音频提取器", "tl": "Tagakuha ng Audio", "id": "Pengekstrak Audio"},
    "مستخرج الصوتيات": {"en": "Audio Extractor", "hi": "ऑडियो एक्सट्रैक्टर", "ur": "آڈیو ایکسٹریکٹر", "zh": "音频提取器", "tl": "Tagakuha ng Audio", "id": "Pengekstrak Audio"},
    "Batch Image Processor": {"en": "Batch Image Processor", "hi": "बैच इमेज प्रोसेसर", "ur": "بیچ تصویر پروسیسر", "zh": "批量图像处理器", "tl": "Batch Prosesor ng Larawan", "id": "Pemroses Gambar Batch"},
    "معالج الصور الدفعي": {"en": "Batch Image Processor", "hi": "बैच इमेज प्रोसेसर", "ur": "بیچ تصویر پروسیسر", "zh": "批量图像处理器", "tl": "Batch Prosesor ng Larawan", "id": "Pemroses Gambar Batch"},
    "Batch Compress": {"en": "Batch Compress", "hi": "बैच कंप्रेस", "ur": "بیچ کمپریس", "zh": "批量图像压缩", "tl": "Batch Compress", "id": "Kompresi Batch"},
    "ضاغط الدفعات": {"en": "Batch Compress", "hi": "बैच कंप्रेसर", "ur": "بیچ کمپریسر", "zh": "批量压缩器", "tl": "Batch Compressor", "id": "Kompresor Batch"},
    "ضغط الدفعات": {"en": "Batch Compress", "hi": "बैच कंप्रेस", "ur": "بیچ کمپریس", "zh": "批量压缩", "tl": "Batch Compress", "id": "Kompresi Batch"},
    "Smart Auto Crop & Detection": {"en": "Smart Auto Crop & Detection", "hi": "स्मार्ट ऑटो क्रॉप और डिटेक्शन", "ur": "سمارٹ آٹو کراپ اور شناخت", "zh": "智能自动裁剪与元素识别", "tl": "Matalinong Auto Crop at Pagtukoy", "id": "Pemotong Otomatis Pintar & Deteksi"},
    "القص والتحديد الذكي التلقائي": {"en": "Smart Auto Crop & Detection", "hi": "स्मार्ट ऑटो क्रॉप और डिटेक्शन", "ur": "سمارٹ آٹو کراپ اور شناخت", "zh": "智能自动裁剪与元素识别", "tl": "Matalinong Auto Crop at Pagtukoy", "id": "Pemotong Otomatis Pintar & Deteksi"},
    "Universal Motion Tools": {"en": "Universal Motion Tools", "hi": "यूनिवर्सल मोशन टूल्स", "ur": "یونیورسل موشن ٹولز", "zh": "通用动效全能工具箱", "tl": "Mga Pangkalahatang Tool sa Paggalaw", "id": "Alat Gerak Universal"},
    "أدوات الحركة الشاملة": {"en": "Universal Motion Tools", "hi": "यूनिवर्सल मोशन टूल्स", "ur": "یونیورسل موشن ٹولز", "zh": "通用动效全能工具箱", "tl": "Mga Pangkalahatang Tool sa Paggalaw", "id": "Alat Gerak Universal"},
    "Video Converter": {"en": "Video Converter", "hi": "वीडियो कनवर्टर", "ur": "ویڈیو کنورٹر", "zh": "视频转换器", "tl": "Converter ng Video", "id": "Konverter Video"},
    "محول الفيديو": {"en": "Video Converter", "hi": "वीडियो कनवर्टर", "ur": "ویڈیو کنورٹر", "zh": "视频转换器", "tl": "Converter ng Video", "id": "Konverter Video"},
    "SVGA Store": {"en": "SVGA Store", "hi": "SVGA स्टोर", "ur": "SVGA اسٹور", "zh": "SVGA 动画素材商城", "tl": "Tindahan ng SVGA", "id": "Toko Aset SVGA"},
    "متجر SVGA": {"en": "SVGA Store", "hi": "SVGA स्टोर", "ur": "SVGA اسٹور", "zh": "SVGA 动画素材商城", "tl": "Tindahan ng SVGA", "id": "Toko Aset SVGA"},
    "Batch Image Converter": {"en": "Batch Image Converter", "hi": "बैच इमेज कनवर्टर", "ur": "بیچ تصویر کنورٹر", "zh": "批量图像转换器", "tl": "Batch Converter ng Larawan", "id": "Konverter Gambar Batch"},
    "محول الصور الجماعي": {"en": "Batch Image Converter", "hi": "बैच इमेज कनवर्टर", "ur": "بیچ تصویر کنورٹر", "zh": "批量图像转换器", "tl": "Batch Converter ng Larawan", "id": "Konverter Gambar Batch"},

    # Categories
    "أنيميشن و SVGA": {"en": "Animation & SVGA", "hi": "एनिमेशन और SVGA", "ur": "اینیمیشن اور SVGA", "zh": "动画与 SVGA", "tl": "Animasyon at SVGA", "id": "Animasi & SVGA"},
    "معالجة الصور والذكاء الاصطناعي": {"en": "Image Processing & AI", "hi": "इमेज प्रोसेसिंग और AI", "ur": "تصویر پروسیسنگ اور AI", "zh": "图像处理与 AI", "tl": "Pagproseso ng Larawan at AI", "id": "Pemrosesan Gambar & AI"},
    "أدوات الصوت والميديا": {"en": "Audio & Media Tools", "hi": "ऑडियो और मीडिया टूल्स", "ur": "آڈیو اور میڈیا ٹولز", "zh": "音频与媒体工具", "tl": "Mga Tool sa Audio at Media", "id": "Alat Audio & Media"},
    "المعالجة الجماعية (Batch)": {"en": "Batch Processing", "hi": "बैच प्रोसेसिंग", "ur": "بیچ پروسیسنگ", "zh": "批量批处理", "tl": "Batch Processing", "id": "Pemrosesan Massal (Batch)"},
    "المعالجة الجماعية": {"en": "Batch Processing", "hi": "बैच प्रोसेसिंग", "ur": "بیچ پروسیسنگ", "zh": "批量批处理", "tl": "Batch Processing", "id": "Pemrosesan Massal (Batch)"},
    "المتجر والأصول المساعدة": {"en": "Store & Assets", "hi": "स्टोर और एसेट्स", "ur": "اسٹور اور اثاثے", "zh": "商城与素材库", "tl": "Tindahan at Materyales", "id": "Toko & Aset"},

    # Header, Search & Toolbar
    "البحث عن أداة (Ctrl+K)...": {"en": "Search tools (Ctrl+K)...", "hi": "टूल खोजें (Ctrl+K)...", "ur": "ٹول تلاش کریں (Ctrl+K)...", "zh": "搜索功能工具 (Ctrl+K)...", "tl": "Maghanap ng tool (Ctrl+K)...", "id": "Cari alat (Ctrl+K)..."},
    "البحث السريع في الأدوات": {"en": "Quick Tool Search", "hi": "त्वरित टूल खोज", "ur": "فوری ٹول تلاش", "zh": "快捷工具搜索", "tl": "Mabilisang Paghahanap ng Tool", "id": "Pencarian Alat Cepat"},
    "ابحث عن أي أداة بالاسم أو الوظيفة": {"en": "Search any tool by name or function", "hi": "नाम या कार्य द्वारा कोई भी टूल खोजें", "ur": "نام یا کام سے کوئی بھی ٹول تلاش کریں", "zh": "按名称或功能搜索任何工具", "tl": "Maghanap ng anumang tool ayon sa pangalan", "id": "Cari alat apa saja berdasarkan nama atau fungsi"},
    "ابدأ بكتابة اسم الأداة أو الوظيفة للبحث": {"en": "Type tool name or function to search", "hi": "खोजने के लिए टूल का नाम लिखें", "ur": "تلاش کے لیے ٹول کا نام لکھیں", "zh": "输入工具名称或功能开始搜索", "tl": "I-type ang pangalan ng tool para maghanap", "id": "Ketik nama alat atau fungsi untuk mencari"},
    "جميع الأدوات": {"en": "All Tools", "hi": "सभी टूल्स", "ur": "تمام ٹولز", "zh": "所有功能工具", "tl": "Lahat ng Tool", "id": "Semua Alat"},
    "جميع الأدوات (20+ أداة)": {"en": "All Tools (20+ tools)", "hi": "सभी टूल्स (20+ टूल्स)", "ur": "تمام ٹولز (20+ ٹولز)", "zh": "所有功能 (20+ 工具)", "tl": "Lahat ng Tool (20+ tool)", "id": "Semua Alat (20+ Alat)"},
    "الأدوات والتطبيقات": {"en": "Tools & Applications", "hi": "टूल्स और ऍप्लिकेशन्स", "ur": "ٹولز اور ایپلی کیشنز", "zh": "工具与应用程序", "tl": "Mga Tool at Aplikasyon", "id": "Alat & Aplikasi"},
    "الأدوات المثبتة بنجمة في البداية": {"en": "Starred tools pinned at top", "hi": "शीर्ष पर पिन किए गए स्टार टूल्स", "ur": "سب سے اوپر پن کیے گئے اسٹار ٹولز", "zh": "顶部星标固定工具", "tl": "Naka-pin na mga star tool sa itaas", "id": "Alat bintang disematkan di atas"},
    "أداة مثبتة بنجمة في البداية": {"en": "Starred tool pinned at top", "hi": "शीर्ष पर पिन किया गया स्टार टूल", "ur": "اوپر پن کیا گیا اسٹار ٹول", "zh": "置顶星标工具", "tl": "Naka-star na tool na naka-pin sa itaas", "id": "Alat berbintang disematkan di atas"},
    "أداة مثبتة": {"en": "Pinned Tool", "hi": "पिन किया गया टूल", "ur": "پن کیا ہوا ٹول", "zh": "已固定工具", "tl": "Naka-pin na Tool", "id": "Alat yang Disematkan"},
    "المفضلة": {"en": "Favorites", "hi": "पसंदीदा", "ur": "پسندیدہ", "zh": "收藏夹", "tl": "Mga Paborito", "id": "Favorit"},
    "تثبيت بنجمة ⭐": {"en": "Pin with Star ⭐", "hi": "स्टार से पिन करें ⭐", "ur": "ستارے کے ساتھ پن کریں ⭐", "zh": "星标置顶 ⭐", "tl": "I-pin gamit ang Star ⭐", "id": "Sematkan Bintang ⭐"},
    "إلغاء التثبيت ⭐": {"en": "Unpin ⭐", "hi": "अनपिन करें ⭐", "ur": "ان پن کریں ⭐", "zh": "取消置顶 ⭐", "tl": "I-unpin ⭐", "id": "Lepas Bintang ⭐"},
    "اضغط لإلغاء التثبيت": {"en": "Click to unpin", "hi": "अनपिन करने के लिए क्लिक करें", "ur": "ان پن کرنے کے لیے کلک کریں", "zh": "点击取消置顶", "tl": "I-click para i-unpin", "id": "Klik untuk melepas sematan"},
    "انقر لإلغاء التثبيت": {"en": "Click to unpin", "hi": "अनपिन करने के लिए क्लिक करें", "ur": "ان پن کرنے کے لیے کلک کریں", "zh": "点击取消固定", "tl": "I-click para i-unpin", "id": "Klik untuk melepas sematan"},
    "تثبيت القائمة": {"en": "Pin Menu", "hi": "मेनू पिन करें", "ur": "مینو پن کریں", "zh": "固定导航栏", "tl": "I-pin ang Menu", "id": "Sematkan Menu"},
    "تثبيت القائمة العلوية": {"en": "Pin Header Menu", "hi": "शीर्ष मेनू पिन करें", "ur": "اوپری مینو پن کریں", "zh": "固定顶部菜单", "tl": "I-pin ang Header Menu", "id": "Sematkan Menu Atas"},
    "إلغاء تثبيت القائمة": {"en": "Unpin Menu", "hi": "मेनू अनपिन करें", "ur": "مینو ان پن کریں", "zh": "取消固定导航栏", "tl": "I-unpin ang Menu", "id": "Lepas Sematan Menu"},
    "إلغاء تثبيت القائمة العلوية": {"en": "Unpin Header Menu", "hi": "शीर्ष मेनू अनपिन करें", "ur": "اوپری مینو ان پن کریں", "zh": "取消固定顶部菜单", "tl": "I-unpin ang Header Menu", "id": "Lepas Sematan Menu Atas"},
    "إغلاق القائمة": {"en": "Close Menu", "hi": "मेनू बंद करें", "ur": "مینو بند کریں", "zh": "关闭菜单", "tl": "Isara ang Menu", "id": "Tutup Menu"},
    "الرجوع للرئيسية": {"en": "Back to Home", "hi": "होम पर वापस जाएं", "ur": "ہوم پر واپس جائیں", "zh": "返回首页", "tl": "Bumalik sa Home", "id": "Kembali ke Beranda"},
    "العودة للرئيسية": {"en": "Back to Home", "hi": "होम पर वापस जाएं", "ur": "ہوم پر واپس جائیں", "zh": "返回首页", "tl": "Bumalik sa Home", "id": "Kembali ke Beranda"},
    "شرح الموقع": {"en": "Site Guide", "hi": "साइट गाइड", "ur": "سائٹ گائیڈ", "zh": "网站使用手册", "tl": "Gabay sa Site", "id": "Panduan Situs"},
    "شرح ودليل الموقع": {"en": "Site Guide & Walkthrough", "hi": "साइट गाइड और वॉकथ्रू", "ur": "سائٹ گائیڈ اور واک تھرو", "zh": "平台指南", "tl": "Gabay sa Site", "id": "Panduan & Tutorial Situs"},
    "دليل الميزات": {"en": "Features Guide", "hi": "सुविधा गाइड", "ur": "خصوصیات گائیڈ", "zh": "功能手册", "tl": "Gabay sa Tampok", "id": "Panduan Fitur"},
    "دليل ومميزات المنصة": {"en": "Features & Platform Guide", "hi": "सुविधाएं और प्लेटफ़ॉर्म गाइड", "ur": "خصوصیات اور پلیٹ فارم گائیڈ", "zh": "功能与平台手册", "tl": "Gabay sa Platform at Tampok", "id": "Panduan Fitur & Platform"},
    "لوحة المدير": {"en": "Admin Panel", "hi": "व्यवस्थापक पैनल", "ur": "ایڈمن پینل", "zh": "管理员控制台", "tl": "Admin Panel", "id": "Panel Admin"},
    "لوحة تحكم المدير": {"en": "Admin Dashboard", "hi": "एडमिन डैशबोर्ड", "ur": "ایڈمن ڈیش بورڈ", "zh": "管理后台", "tl": "Admin Dashboard", "id": "Dasbor Admin"},
    "تسجيل الخروج": {"en": "Log Out", "hi": "लॉग आउट", "ur": "لاگ آؤٹ", "zh": "退出登录", "tl": "Mag-logout", "id": "Keluar"},
    "تسجيل الدخول": {"en": "Log In", "hi": "लॉग इन", "ur": "لاگ ان", "zh": "登录账号", "tl": "Mag-login", "id": "Masuk"},
    "إنشاء حساب": {"en": "Sign Up", "hi": "साइन अप", "ur": "اکاؤنٹ بنائیں", "zh": "注册新账号", "tl": "Gumawa ng Account", "id": "Daftar Akun"},
    "الملف الشخصي": {"en": "Profile", "hi": "प्रोफ़ाइल", "ur": "پروفائل", "zh": "个人资料", "tl": "Profile", "id": "Profil"},
    "نسخة التطبيق": {"en": "App Version", "hi": "ऐप संस्करण", "ur": "ایپ ورژن", "zh": "系统版本", "tl": "Bersyon ng App", "id": "Versi Aplikasi"},
    "معلومات النسخة والتحديثات": {"en": "Version & Release Info", "hi": "संस्करण और रिलीज़ जानकारी", "ur": "ورژن اور ریلیز کی معلومات", "zh": "版本与发布说明", "tl": "Impormasyon sa Bersyon at Update", "id": "Info Versi & Rilis"},
    "إعادة ضبط": {"en": "Reset", "hi": "रीसेट", "ur": "دوبارہ ترتیب دیں", "zh": "重置", "tl": "I-reset", "id": "Atur Ulang"},
    "ترجمة الموقع بالكامل": {"en": "Translate Entire Site", "hi": "पूरी साइट का अनुवाद करें", "ur": "پوری سائٹ کا ترجمہ کریں", "zh": "全站完整翻译", "tl": "Isalin ang Buong Site", "id": "Terjemahkan Seluruh Situs"},
    "ترجمة الموقع": {"en": "Translate Site", "hi": "साइट अनुवाद करें", "ur": "سائٹ کا ترجمہ کریں", "zh": "网站翻译", "tl": "Isalin ang Site", "id": "Terjemahkan Situs"},
    "ترجمة الموقع بالكامل (Translate Website)": {"en": "Translate Entire Site", "hi": "पूरी साइट का अनुवाद करें", "ur": "پوری سائٹ کا ترجمہ کریں", "zh": "全站完整翻译", "tl": "Isalin ang Buong Site", "id": "Terjemahkan Seluruh Situs"},
    "تطبيق وترجمة الموقع بالكامل الآن": {"en": "Apply Full Translation Now", "hi": "अभी पूरा अनुवाद लागू करें", "ur": "ابھی مکمل ترجمہ لاگو کریں", "zh": "立即应用全站翻译", "tl": "Ilapat ang Buong Pagsasalin Ngayon", "id": "Terapkan Terjemahan Sekarang"},
    "اللغة الحالية:": {"en": "Current Language:", "hi": "वर्तमान भाषा:", "ur": "موجودہ زبان:", "zh": "当前语言:", "tl": "Kasalukuyang Wika:", "id": "Bahasa Saat Ini:"},
    "استعادة الأصلية (عربي)": {"en": "Restore Original (Arabic)", "hi": "मूल अरबी पुनर्स्थापित करें", "ur": "اصل عربی بحال کریں", "zh": "恢复原语言 (阿拉伯语)", "tl": "Ibalik ang Orihinal (Arabic)", "id": "Kembalikan ke Asli (Arab)"},
    "انقر لتخطي الإعلان والدخول فوراً": {"en": "Click to skip and enter immediately", "hi": "छोड़ने और तुरंत प्रवेश करने के लिए क्लिक करें", "ur": "اشتہار چھوڑنے اور فوری داخل ہونے کے لیے کلک کریں", "zh": "点击跳过并立即进入", "tl": "Mag-click para lumaktaw at pumasok agad", "id": "Klik untuk melewati dan langsung masuk"},
    "انقر في أي مكان للتخطي": {"en": "Click anywhere to skip", "hi": "छोड़ने के लिए कहीं भी क्लिक करें", "ur": "چھوڑنے کے لیے کہیں بھی کلک کریں", "zh": "点击任意位置跳过", "tl": "Mag-click kahit saan para lumaktaw", "id": "Klik di mana saja untuk melewati"},

    # File Drag & Drop & Upload
    "انقر أو اسحب وأفلت الملف هنا": {"en": "Click or drag & drop file here", "hi": "फ़ाइल क्लिक करें या ड्रैग और ड्रॉप करें", "ur": "فائل پر کلک کریں یا ڈریگ اینڈ ڈراپ کریں", "zh": "点击或拖拽文件至此区域", "tl": "Mag-click o i-drag at i-drop ang file dito", "id": "Klik atau seret & lepas file ke sini"},
    "اسحب وأفلت ملف": {"en": "Drag & drop file", "hi": "फ़ाइल खींचें और छोड़ें", "ur": "فائل ڈریگ اینڈ ڈراپ کریں", "zh": "拖放文件", "tl": "I-drag at i-drop ang file", "id": "Seret & lepas file"},
    "اسحب وأفلت فيديو": {"en": "Drag & drop video", "hi": "वीडियो खींचें और छोड़ें", "ur": "ویڈیو ڈریگ اینڈ ڈراپ کریں", "zh": "拖放视频", "tl": "I-drag at i-drop ang video", "id": "Seret & lepas video"},
    "أو اسحب وأفلت الملف هنا": {"en": "or drag and drop file here", "hi": "या फ़ाइल यहां खींचें और छोड़ें", "ur": "یا فائل یہاں ڈریگ اینڈ ڈراپ کریں", "zh": "或将文件拖放至此", "tl": "o i-drag at i-drop ang file dito", "id": "atau seret dan lepas file ke sini"},
    "استعراض الملفات": {"en": "Browse Files", "hi": "फ़ाइलें ब्राउज़ करें", "ur": "فائلیں براؤز کریں", "zh": "浏览选择文件", "tl": "Mag-browse ng mga File", "id": "Jelajahi File"},
    "اختر ملف SVGA للبدء": {"en": "Select SVGA file to begin", "hi": "शुरू करने के लिए SVGA फ़ाइल चुनें", "ur": "شروع کرنے کے لیے SVGA فائل منتخب کریں", "zh": "选择 SVGA 文件以开始", "tl": "Pumili ng SVGA file para magsimula", "id": "Pilih file SVGA untuk memulai"},
    "اختر صيغة التصدير المستهدفة": {"en": "Select Target Export Format", "hi": "लक्ष्य निर्यात प्रारूप चुनें", "ur": "ہدف برآمدی فارمیٹ منتخب کریں", "zh": "选择目标导出格式", "tl": "Pumili ng Target na Format ng Pag-export", "id": "Pilih Format Ekspor Target"},
    "رفع ملف جديد": {"en": "Upload New File", "hi": "नई फ़ाइल अपलोड करें", "ur": "نئی فائل اپ لوڈ کریں", "zh": "上传新文件", "tl": "Mag-upload ng Bagong File", "id": "Unggah File Baru"},
    "رفع ملف SVGA": {"en": "Upload SVGA File", "hi": "SVGA फ़ाइल अपलोड करें", "ur": "SVGA فائل اپ لوڈ کریں", "zh": "上传 SVGA 文件", "tl": "Mag-upload ng SVGA File", "id": "Unggah File SVGA"},
    "رفع ملف": {"en": "Upload File", "hi": "फ़ाइल अपलोड करें", "ur": "فائل اپ لوڈ کریں", "zh": "上传文件", "tl": "Mag-upload ng File", "id": "Unggah File"},
    "رفع خلفية": {"en": "Upload Background", "hi": "बैकग्राउंड अपलोड करें", "ur": "پس منظر اپ لوڈ کریں", "zh": "上传背景图", "tl": "Mag-upload ng Background", "id": "Unggah Latar Belakang"},
    "رفع علامة": {"en": "Upload Watermark", "hi": "वॉटरमार्क अपलोड करें", "ur": "واٹر مارک اپ لوڈ کریں", "zh": "上传水印", "tl": "Mag-upload ng Watermark", "id": "Unggah Tanda Air"},
    "رفع علامة مائية": {"en": "Upload Watermark", "hi": "वॉटरमार्क अपलोड करें", "ur": "واٹر مارک اپ لوڈ کریں", "zh": "上传水印", "tl": "Mag-upload ng Watermark", "id": "Unggah Tanda Air"},
    "رفع صوت": {"en": "Upload Audio", "hi": "ऑडियो अपलोड करें", "ur": "آڈیو اپ لوڈ کریں", "zh": "上传音频", "tl": "Mag-upload ng Audio", "id": "Unggah Audio"},
    "اضغط لرفع فيديو": {"en": "Click to upload video", "hi": "वीडियो अपलोड करने के लिए क्लिक करें", "ur": "ویڈیو اپ لوڈ کرنے کے لیے کلک کریں", "zh": "点击上传视频", "tl": "I-click para mag-upload ng video", "id": "Klik untuk mengunggah video"},
    "تنزيل الملف": {"en": "Download File", "hi": "फ़ाइल डाउनलोड करें", "ur": "فائل ڈاؤن لوڈ کریں", "zh": "下载文件", "tl": "I-download ang File", "id": "Unduh File"},
    "تحميل الملف": {"en": "Download File", "hi": "फ़ाइल डाउनलोड करें", "ur": "فائل ڈاؤن لوڈ کریں", "zh": "下载文件", "tl": "I-download ang File", "id": "Unduh File"},
    "تحميل الفيديو": {"en": "Download Video", "hi": "वीडियो डाउनलोड करें", "ur": "ویڈیو ڈاؤن لوڈ کریں", "zh": "下载视频", "tl": "I-download ang Video", "id": "Unduh Video"},
    "تحميل الفيديو مرة أخرى": {"en": "Download Video Again", "hi": "वीडियो फिर से डाउनलोड करें", "ur": "ویڈیو دوبارہ ڈاؤن لوڈ کریں", "zh": "再次下载视频", "tl": "I-download Ulit ang Video", "id": "Unduh Video Lagi"},
    "تنزيل الصوت الأصلي": {"en": "Download Original Audio", "hi": "मूल ऑडियो डाउनलोड करें", "ur": "اصل آڈیو ڈاؤن لوڈ کریں", "zh": "下载原始音频", "tl": "I-download ang Orihinal na Audio", "id": "Unduh Audio Asli"},
    "تنزيل بصيغة ZIP": {"en": "Download as ZIP", "hi": "ZIP के रूप में डाउनलोड करें", "ur": "ZIP فارمیٹ میں ڈاؤن لوڈ کریں", "zh": "以 ZIP 压缩包下载", "tl": "I-download bilang ZIP", "id": "Unduh sebagai ZIP"},
    "حفظ التغييرات": {"en": "Save Changes", "hi": "परिवर्तन सहेजें", "ur": "تبدیلیاں محفوظ کریں", "zh": "保存修改", "tl": "I-save ang mga Pagbabago", "id": "Simpan Perubahan"},
    "حفظ المشروع": {"en": "Save Project", "hi": "प्रोजेक्ट सहेजें", "ur": "پروجیکٹ محفوظ کریں", "zh": "保存项目工程", "tl": "I-save ang Proyekto", "id": "Simpan Proyek"},
    "بدء التصدير الاحترافي": {"en": "Start Professional Export", "hi": "प्रो निर्यात शुरू करें", "ur": "پیشہ ورانہ برآمد شروع کریں", "zh": "开始专业导出", "tl": "Simulan ang Pro Export", "id": "Mulai Ekspor Profesional"},
    "بدء التصدير": {"en": "Start Export", "hi": "निर्यात शुरू करें", "ur": "برآمد شروع کریں", "zh": "开始导出", "tl": "Simulan ang Pag-export", "id": "Mulai Ekspor"},
    "بدء المعالجة": {"en": "Start Processing", "hi": "प्रसंस्करण शुरू करें", "ur": "پروسیسنگ شروع کریں", "zh": "开始处理", "tl": "Simulan ang Pagproseso", "id": "Mulai Memproses"},
    "جاري التصدير...": {"en": "Exporting...", "hi": "निर्यात हो रहा है...", "ur": "برآمد ہو رہا ہے...", "zh": "正在导出...", "tl": "Nag-e-export...", "id": "Mengekspor..."},
    "جاري المعالجة...": {"en": "Processing...", "hi": "प्रक्रिया जारी है...", "ur": "پروسیسنگ جاری ہے...", "zh": "正在处理中...", "tl": "Pinoproseso...", "id": "Sedang memproses..."},
    "جاري التحميل...": {"en": "Loading...", "hi": "लोड हो रहा है...", "ur": "لوڈ ہو رہا ہے...", "zh": "加载中...", "tl": "Naglo-load...", "id": "Memuat..."},
    "جاري الحفظ...": {"en": "Saving...", "hi": "सहेजा जा रहा है...", "ur": "محفوظ ہو رہا ہے...", "zh": "保存中...", "tl": "Nagse-save...", "id": "Menyimpan..."},
    "جاري الرفع...": {"en": "Uploading...", "hi": "अपलोड हो रहा है...", "ur": "اپ لوڈ ہو رہا ہے...", "zh": "上传中...", "tl": "Nag-a-upload...", "id": "Mengunggah..."},
    "تم بنجاح": {"en": "Successfully completed", "hi": "सफलतापूर्वक पूरा हुआ", "ur": "کامیابی سے مکمل ہوا", "zh": "已成功完成", "tl": "Matagumpay na nakumpleto", "id": "Berhasil diselesaikan"},
    "بنجاح": {"en": "successfully", "hi": "सफलतापूर्वक", "ur": "کامیابی سے", "zh": "成功", "tl": "matagumpay", "id": "dengan sukses"},
    "فشل": {"en": "Failed", "hi": "विफल", "ur": "ناکام", "zh": "失败", "tl": "Nabigo", "id": "Gagal"},
    "خطأ": {"en": "Error", "hi": "त्रुटि", "ur": "خرابی", "zh": "错误", "tl": "Kamalian", "id": "Kesalahan"},
    "خطأ في الرفع": {"en": "Upload Error", "hi": "अपलोड त्रुटि", "ur": "اپ لوڈ میں خرابی", "zh": "上传失败", "tl": "Error sa Pag-upload", "id": "Kesalahan Pengunggahan"},

    # Inside Universal Motion & VAP Tools
    "إدارة ودمج وإزالة الصوت": {"en": "Audio Management, Merge & Removal", "hi": "ऑडियो प्रबंधन, मर्ज और हटाना", "ur": "آڈیو انتظام، انضمام اور خاتمہ", "zh": "音频管理、合并与移除", "tl": "Pamamahala ng Audio, Pagsasama at Pagtanggal", "id": "Manajemen Audio, Penggabungan & Penghapusan"},
    "إضافة مسار صوتي للهدية": {"en": "Add Audio Track to Gift", "hi": "गिफ्ट में ऑडियो ट्रैक जोड़ें", "ur": "گفٹ میں آڈیو ٹریک شامل کریں", "zh": "为礼物动画添加音频轨道", "tl": "Magdagdag ng Audio Track sa Regalo", "id": "Tambahkan Trek Audio ke Hadiah"},
    "إضافة ودمج وإزالة الصوت": {"en": "Add, Merge & Remove Audio", "hi": "ऑडियो जोड़ें, मर्ज करें और हटाएं", "ur": "آڈیو شامل، ضم اور خارج کریں", "zh": "添加、合并与移除音频", "tl": "Magdagdag, Pagsamahin at Alisin ang Audio", "id": "Tambah, Gabung & Hapus Audio"},
    "أبعاد ومقاسات الهدية وحجم الملف": {"en": "Gift Dimensions & File Size", "hi": "गिफ्ट आयाम और फ़ाइल का आकार", "ur": "گفٹ کی پیمائش اور فائل کا سائز", "zh": "礼物尺寸规格与文件体积", "tl": "Mga Dimensyon ng Regalo at Laki ng File", "id": "Dimensi Hadiah & Ukuran File"},
    "أبعاد ومقاسات الهدية (العرض والارتفاع)": {"en": "Gift Dimensions (Width & Height)", "hi": "गिफ्ट आयाम (चौड़ाई और ऊंचाई)", "ur": "گفٹ کے طول و عرض (چوڑائی اور اونچائی)", "zh": "礼物尺寸 (宽度与高度)", "tl": "Mga Sukat ng Regalo (Lapad at Taas)", "id": "Dimensi Hadiah (Lebar & Tinggi)"},
    "أبعاد ومقاسات الهدية": {"en": "Gift Dimensions", "hi": "गिफ्ट आयाम", "ur": "گفٹ کے طول و عرض", "zh": "礼物尺寸", "tl": "Mga Sukat ng Regalo", "id": "Dimensi Hadiah"},
    "العلامة المائية المتحركة المربعة": {"en": "Animated Square Watermark", "hi": "एनिमेटेड स्क्वायर वॉटरमार्क", "ur": "متحرک مربع واٹر مارک", "zh": "动态方形水印", "tl": "Animated Square Watermark", "id": "Tanda Air Persegi Bergerak"},
    "العلامة المائية المتحركة (مربعة)": {"en": "Animated Square Watermark", "hi": "एनिमेटेड स्क्वायर वॉटरमार्क", "ur": "متحرک مربع واٹر مارک", "zh": "动态方形水印", "tl": "Animated Square Watermark", "id": "Tanda Air Persegi Bergerak"},
    "العلامة المائية المتحركة": {"en": "Animated Watermark", "hi": "एनिमेटेड वॉटरमार्क", "ur": "متحرک واٹر مارک", "zh": "动态水印", "tl": "Animated Watermark", "id": "Tanda Air Bergerak"},
    "تحويلات العلامة المائية": {"en": "Watermark Transforms", "hi": "वॉटरमार्क ट्रांसफ़ॉर्म", "ur": "واٹر مارک ٹرانسفارمیشنز", "zh": "水印形变调整", "tl": "Mga Pagbabago ng Watermark", "id": "Transformasi Tanda Air"},
    "تحويلات الخلفية": {"en": "Background Transforms", "hi": "बैकग्राउंड ट्रांसफ़ॉर्म", "ur": "پس منظر کی تبدیلیاں", "zh": "背景形变调整", "tl": "Mga Pagbabago ng Background", "id": "Transformasi Latar Belakang"},
    "تحويلات الملف (SVGA)": {"en": "SVGA File Transforms", "hi": "SVGA फ़ाइल ट्रांसफ़ॉर्म", "ur": "SVGA فائل کی تبدیلیاں", "zh": "SVGA 动画文件位移调整", "tl": "Mga Pagbabago ng SVGA File", "id": "Transformasi File SVGA"},
    "تدرج الشفافية (Edge Fade)": {"en": "Edge Fade Gradient", "hi": "एज फेड ग्रेडिएंट", "ur": "کناروں کا فیڈ گریڈینٹ", "zh": "边缘淡出渐变 (Edge Fade)", "tl": "Edge Fade Gradient", "id": "Gradien Pudang Tepi (Edge Fade)"},
    "تدرج الشفافية": {"en": "Edge Fade", "hi": "एज फेड", "ur": "کناروں کا فیڈ", "zh": "边缘羽化透明", "tl": "Edge Fade", "id": "Pudar Tepi"},
    "قص الصوت المدمج": {"en": "Trim Integrated Audio", "hi": "एकीकृत ऑडियो ट्रिम करें", "ur": "مربوط آڈیو کاٹیں", "zh": "剪裁内置音频", "tl": "I-trim ang Nakapaloob na Audio", "id": "Potong Audio Terintegrasi"},
    "تعديل الصوت المتقدمة": {"en": "Advanced Audio Editing", "hi": "उन्नत ऑडियो संपादन", "ur": "اعلی درجے کی آڈیو ایڈیٹنگ", "zh": "高级音频编辑", "tl": "Advanced na Pag-edit ng Audio", "id": "Pengeditan Audio Lanjutan"},
    "انقر لفتح نافذة تعديل الصوت المتقدمة": {"en": "Click to open advanced audio editor", "hi": "उन्नत ऑडियो संपादक खोलने के लिए क्लिक करें", "ur": "اعلی درجے کا آڈیو ایڈیٹر کھولنے کے لیے کلک کریں", "zh": "点击打开高级音频剪裁窗口", "tl": "I-click para buksan ang advanced audio editor", "id": "Klik untuk membuka editor audio lanjutan"},
    "تصدير VAP (flutter_vap_plus)": {"en": "Export VAP (flutter_vap_plus)", "hi": "VAP निर्यात करें (flutter_vap_plus)", "ur": "VAP برآمد کریں (flutter_vap_plus)", "zh": "导出 VAP (flutter_vap_plus)", "tl": "I-export ang VAP (flutter_vap_plus)", "id": "Ekspor VAP (flutter_vap_plus)"},
    "تصدير SVGA 2.0": {"en": "Export SVGA 2.0", "hi": "SVGA 2.0 निर्यात करें", "ur": "SVGA 2.0 برآمد کریں", "zh": "导出 SVGA 2.0 规范", "tl": "I-export ang SVGA 2.0", "id": "Ekspor SVGA 2.0"},
    "تصدير SVGA": {"en": "Export SVGA", "hi": "SVGA निर्यात करें", "ur": "SVGA برآمد کریں", "zh": "导出 SVGA", "tl": "I-export ang SVGA", "id": "Ekspor SVGA"},
    "تصدير VAP": {"en": "Export VAP", "hi": "VAP निर्यात करें", "ur": "VAP برآمد کریں", "zh": "导出 VAP", "tl": "I-export ang VAP", "id": "Ekspor VAP"},
    "تصدير MP4": {"en": "Export MP4", "hi": "MP4 निर्यात करें", "ur": "MP4 برآمد کریں", "zh": "导出 MP4", "tl": "I-export ang MP4", "id": "Ekspor MP4"},
    "تحويل MP4": {"en": "Convert to MP4", "hi": "MP4 में बदलें", "ur": "MP4 میں تبدیل کریں", "zh": "转换为 MP4", "tl": "I-convert sa MP4", "id": "Konversi ke MP4"},
    "تسجيل فيديو (Screen Record)": {"en": "Screen Record Video", "hi": "स्क्रीन रिकॉर्ड वीडियो", "ur": "اسکرین ریکارڈ ویڈیو", "zh": "屏幕录像录制", "tl": "Screen Record Video", "id": "Rekam Layar Video"},
    "تسجيل الشاشة فيديو": {"en": "Screen Record Video", "hi": "स्क्रीन रिकॉर्ड वीडियो", "ur": "اسکرین ریکارڈ ویڈیو", "zh": "屏幕录像录制", "tl": "Screen Record Video", "id": "Rekam Layar Video"},
    "نافذة تسجيل الفيديو": {"en": "Video Recording Window", "hi": "वीडियो रिकॉर्डिंग विंडो", "ur": "ویڈیو ریکارڈنگ ونڈو", "zh": "视频录制弹窗", "tl": "Window ng Pag-record ng Video", "id": "Jendela Perekaman Video"},
    "بدء التسجيل الآن": {"en": "Start Recording Now", "hi": "अभी रिकॉर्डिंग शुरू करें", "ur": "ابھی ریکارڈنگ شروع کریں", "zh": "立即开始录屏", "tl": "Simulan ang Pag-record Ngayon", "id": "Mulai Merekam Sekarang"},
    "بدء التسجيل": {"en": "Start Recording", "hi": "रिकॉर्डिंग शुरू करें", "ur": "ریکارڈنگ شروع کریں", "zh": "开始录制", "tl": "Simulan ang Pag-record", "id": "Mulai Merekam"},
    "إيقاف التسجيل": {"en": "Stop Recording", "hi": "रिकॉर्डिंग रोकें", "ur": "ریکارڈنگ بند کریں", "zh": "停止录制", "tl": "Itigil ang Pag-record", "id": "Hentikan Perekaman"},
    "معاينة VAP (MP4)": {"en": "VAP Preview (MP4)", "hi": "VAP पूर्वावलोकन (MP4)", "ur": "VAP پیش نظارہ (MP4)", "zh": "VAP 动画效果预览 (MP4)", "tl": "VAP Preview (MP4)", "id": "Pratinjau VAP (MP4)"},
    "معاينة مباشرة": {"en": "Live Preview", "hi": "लाइव पूर्वावलोकन", "ur": "براہ راست پیش نظارہ", "zh": "实时预览", "tl": "Live Preview", "id": "Pratinjau Langsung"},
    "معاينة حية": {"en": "Live Preview", "hi": "लाइव पूर्वावलोकन", "ur": "براہ راست پیش نظارہ", "zh": "实时动态预览", "tl": "Live Preview", "id": "Pratinjau Langsung"},
    "معاينة": {"en": "Preview", "hi": "पूर्वावलोकन", "ur": "پیش نظارہ", "zh": "预览", "tl": "Preview", "id": "Pratinjau"},

    # Inside SVGA Layer Editor
    "الطبقات": {"en": "Layers", "hi": "लेयर्स", "ur": "پرتیں", "zh": "图层列表", "tl": "Mga Layer", "id": "Lapisan (Layers)"},
    "كل الطبقات": {"en": "All Layers", "hi": "सभी लेयर्स", "ur": "تمام پرتیں", "zh": "所有图层", "tl": "Lahat ng Layer", "id": "Semua Lapisan"},
    "قائمة الطبقات": {"en": "Layers List", "hi": "लेयर्स सूची", "ur": "پرتوں کی فہرست", "zh": "图层树目录", "tl": "Listahan ng mga Layer", "id": "Daftar Lapisan"},
    "لوحة الخصائص": {"en": "Properties Panel", "hi": "गुण पैनल", "ur": "خصوصیات کا پینل", "zh": "属性检查器", "tl": "Panel ng Katangian", "id": "Panel Properti"},
    "الخصائص": {"en": "Properties", "hi": "गुण", "ur": "خصوصیات", "zh": "属性面板", "tl": "Mga Katangian", "id": "Properti"},
    "الخط الزمني للحركة": {"en": "Motion Timeline", "hi": "मोशन टाइमलाइन", "ur": "موشن ٹائم لائن", "zh": "动效时间轴", "tl": "Timeline ng Paggalaw", "id": "Garis Waktu Gerak"},
    "الخط الزمني": {"en": "Timeline", "hi": "टाइमलाइन", "ur": "ٹائم لائن", "zh": "时间轴", "tl": "Timeline", "id": "Garis Waktu (Timeline)"},
    "الإطارات": {"en": "Frames", "hi": "फ्रेम्स", "ur": "فریمز", "zh": "关键帧序列", "tl": "Mga Frame", "id": "Bingkai (Frames)"},
    "مفتاح الإطار": {"en": "Keyframe", "hi": "कीफ्रेम", "ur": "کی فریم", "zh": "关键帧", "tl": "Keyframe", "id": "Keyframe"},
    "إضافة فريم حركة": {"en": "Add Motion Keyframe", "hi": "मोशन कीफ्रेम जोड़ें", "ur": "حرکت کا کی فریم شامل کریں", "zh": "添加运动关键帧", "tl": "Magdagdag ng Motion Keyframe", "id": "Tambah Keyframe Gerak"},
    "إضافة فريم": {"en": "Add Keyframe", "hi": "कीफ्रेम जोड़ें", "ur": "کی فریم شامل کریں", "zh": "添加关键帧", "tl": "Magdagdag ng Keyframe", "id": "Tambah Keyframe"},
    "حذف الفريم": {"en": "Delete Keyframe", "hi": "कीफ्रेम हटाएं", "ur": "کی فریم حذف کریں", "zh": "删除关键帧", "tl": "Burahin ang Keyframe", "id": "Hapus Keyframe"},
    "حذف الطبقة": {"en": "Delete Layer", "hi": "लेयर हटाएं", "ur": "پرت حذف کریں", "zh": "删除图层", "tl": "Burahin ang Layer", "id": "Hapus Lapisan"},
    "دمج الطبقات": {"en": "Merge Layers", "hi": "लेयर्स मर्ज करें", "ur": "پرتیں ضم کریں", "zh": "合并图层", "tl": "Pagsamahin ang mga Layer", "id": "Gabungkan Lapisan"},
    "فك الدمج": {"en": "Ungroup", "hi": "अनग्रुप करें", "ur": "علیحدہ کریں", "zh": "取消编组", "tl": "I-ungroup", "id": "Pisahkan Grup"},
    "تكرار الطبقة": {"en": "Duplicate Layer", "hi": "लेयर डुप्लिकेट करें", "ur": "پرت نقل کریں", "zh": "复制图层", "tl": "Kopyahin ang Layer", "id": "Duplikat Lapisan"},
    "قفل الطبقة": {"en": "Lock Layer", "hi": "लेयर लॉक करें", "ur": "پرت لاک کریں", "zh": "锁定图层", "tl": "I-lock ang Layer", "id": "Kunci Lapisan"},
    "إلغاء قفل الطبقة": {"en": "Unlock Layer", "hi": "लेयर अनलॉक करें", "ur": "پرت انلاک کریں", "zh": "解锁图层", "tl": "I-unlock ang Layer", "id": "Buka Kunci Lapisan"},
    "إلغاء القفل": {"en": "Unlock", "hi": "अनलॉक करें", "ur": "انلاک کریں", "zh": "解除锁定", "tl": "I-unlock", "id": "Buka Kunci"},
    "إخفاء الطبقة": {"en": "Hide Layer", "hi": "लेयर छिपाएं", "ur": "پرت چھپائیں", "zh": "隐藏图层", "tl": "Itago ang Layer", "id": "Sembunyikan Lapisan"},
    "إظهار الطبقة": {"en": "Show Layer", "hi": "लेयर दिखाएं", "ur": "پرت دکھائیں", "zh": "显示图层", "tl": "Ipakita ang Layer", "id": "Tampilkan Lapisan"},
    "إخفاء": {"en": "Hide", "hi": "छिपाएं", "ur": "چھپائیں", "zh": "隐藏", "tl": "Itago", "id": "Sembunyikan"},
    "إظهار": {"en": "Show", "hi": "दिखाएं", "ur": "دکھائیں", "zh": "显示", "tl": "Ipakita", "id": "Tampilkan"},
    "تغيير اسم الطبقة": {"en": "Rename Layer", "hi": "लेयर का नाम बदलें", "ur": "پرت کا نام تبدیل کریں", "zh": "重命名图层", "tl": "Palitan ang Pangalan ng Layer", "id": "Ubah Nama Lapisan"},
    "إعادة التسمية": {"en": "Rename", "hi": "नाम बदलें", "ur": "نام تبدیل کریں", "zh": "重命名", "tl": "Palitan ang Pangalan", "id": "Ubah Nama"},
    "الشفافية": {"en": "Opacity", "hi": "पारदर्शिता", "ur": "شفافیت", "zh": "不透明度", "tl": "Opacity", "id": "Opasitas"},
    "التدوير": {"en": "Rotation", "hi": "रोटेशन", "ur": "گردش", "zh": "旋转角度", "tl": "Pag-ikot", "id": "Rotasi"},
    "الموضع": {"en": "Position", "hi": "स्थिति", "ur": "پوزیشن", "zh": "坐标位置", "tl": "Posisyon", "id": "Posisi"},
    "الموضع الأفقي (X)": {"en": "Horizontal (X)", "hi": "क्षैतिज (X)", "ur": "افقی (X)", "zh": "水平位置 (X)", "tl": "Pahalang (X)", "id": "Horizontal (X)"},
    "الموضع الرأسي (Y)": {"en": "Vertical (Y)", "hi": "ऊर्ध्वाधर (Y)", "ur": "عمودی (Y)", "zh": "垂直位置 (Y)", "tl": "Patayo (Y)", "id": "Vertikal (Y)"},
    "الموضع X": {"en": "Position X", "hi": "स्थिति X", "ur": "پوزیشن X", "zh": "X 轴坐标", "tl": "Posisyon X", "id": "Posisi X"},
    "الموضع Y": {"en": "Position Y", "hi": "स्थिति Y", "ur": "پوزیشن Y", "zh": "Y 轴坐标", "tl": "Posisyon Y", "id": "Posisi Y"},
    "مقياس الحجم": {"en": "Scale", "hi": "स्केल", "ur": "اسکیل", "zh": "缩放比例", "tl": "Scale", "id": "Skala"},
    "الحجم": {"en": "Size", "hi": "आकार", "ur": "سائز", "zh": "尺寸大小", "tl": "Laki", "id": "Ukuran"},
    "الارتفاع": {"en": "Height", "hi": "ऊंचाई", "ur": "اونچائی", "zh": "高度", "tl": "Taas", "id": "Tinggi"},
    "العرض": {"en": "Width", "hi": "चौड़ाई", "ur": "چوڑائی", "zh": "宽度", "tl": "Lapad", "id": "Lebar"},
    "السرعة": {"en": "Speed", "hi": "गति", "ur": "رفتار", "zh": "播放速度", "tl": "Bilis", "id": "Kecepatan"},
    "مزامنة الحركة": {"en": "Sync Motion", "hi": "मोशन सिंक करें", "ur": "موشن ہم آہنگ کریں", "zh": "动效同步", "tl": "I-sync ang Paggalaw", "id": "Sinkronkan Gerak"},
    "طبقة مدمجة": {"en": "Merged Layer", "hi": "मर्ज की गई लेयर", "ur": "ضم شدہ پرت", "zh": "合并图层", "tl": "Pinagsamang Layer", "id": "Lapisan Tergabung"},
    "الصور": {"en": "Images", "hi": "चित्र", "ur": "تصاویر", "zh": "图片素材", "tl": "Mga Larawan", "id": "Gambar"},
    "الأشكال": {"en": "Shapes", "hi": "आकृतियां", "ur": "اشکال", "zh": "矢量图形", "tl": "Mga Hugis", "id": "Bentuk"},
    "المجموعات": {"en": "Groups", "hi": "समूह", "ur": "گروپس", "zh": "编组组群", "tl": "Mga Grupo", "id": "Grup"},
    "النشطة": {"en": "Active", "hi": "सक्रिय", "ur": "فعال", "zh": "当前激活", "tl": "Aktibo", "id": "Aktif"},
    "بحث في الطبقات...": {"en": "Search layers...", "hi": "लेयर्स में खोजें...", "ur": "پرتوں میں تلاش کریں...", "zh": "搜索图层...", "tl": "Maghanap sa mga layer...", "id": "Cari lapisan..."},
    "تراجع": {"en": "Undo", "hi": "पूर्ववत", "ur": "پہلے جیسا کریں", "zh": "撤销", "tl": "I-undo", "id": "Batal (Undo)"},
    "إعادة": {"en": "Redo", "hi": "फिर से करें", "ur": "دوبارہ کریں", "zh": "重做", "tl": "I-redo", "id": "Ulangi (Redo)"},
    "تكبير": {"en": "Zoom In", "hi": "ज़ूम इन", "ur": "بڑا کریں", "zh": "放大视图", "tl": "Zoom In", "id": "Perbesar (Zoom In)"},
    "تصغير": {"en": "Zoom Out", "hi": "ज़ूम आउट", "ur": "چھوٹا کریں", "zh": "缩小视图", "tl": "Zoom Out", "id": "Perkecil (Zoom Out)"},
    "مركز التكبير": {"en": "Zoom Center", "hi": "ज़ूम केंद्र", "ur": "زوم کا مرکز", "zh": "居中缩放", "tl": "Gitna ng Zoom", "id": "Pusat Zoom"},
    "إعادة ضبط الكانفاس": {"en": "Reset Canvas", "hi": "कैनवास रीसेट करें", "ur": "کینوس دوبارہ ترتیب دیں", "zh": "重置画布", "tl": "I-reset ang Canvas", "id": "Atur Ulang Kanvas"},
    "إعدادات الكانفاس": {"en": "Canvas Settings", "hi": "कैनवास सेटिंग्स", "ur": "کینوس کی ترتیبات", "zh": "画布参数设置", "tl": "Mga Setting ng Canvas", "id": "Pengaturan Kanvas"},
    "إطار للأمام": {"en": "Frame Forward", "hi": "एक फ्रेम आगे", "ur": "ایک فریم آگے", "zh": "前进一帧", "tl": "Frame Pasulong", "id": "Maju Satu Bingkai"},
    "إطار للخلف": {"en": "Frame Backward", "hi": "एक फ्रेम पीछे", "ur": "ایک فریم پیچھے", "zh": "后退一帧", "tl": "Frame Pabalik", "id": "Mundur Satu Bingkai"},
    "إعادة للبداية": {"en": "Restart to Beginning", "hi": "शुरुआत पर जाएं", "ur": "شروع پر واپس جائیں", "zh": "跳至首帧", "tl": "Bumalik sa Simula", "id": "Kembali ke Awal"},
    "تشغيل": {"en": "Play", "hi": "चलाएं", "ur": "چلائیں", "zh": "播放", "tl": "I-play", "id": "Putar"},
    "إيقاف مؤقت": {"en": "Pause", "hi": "रोकें", "ur": "روکیں", "zh": "暂停", "tl": "I-pause", "id": "Jeda"},
    "إيقاف التشغيل": {"en": "Stop Playback", "hi": "प्लेबैक रोकें", "ur": "پلے بیک روکیں", "zh": "停止播放", "tl": "Itigil ang Pag-play", "id": "Hentikan Pemutaran"},
    "إعادة التشغيل": {"en": "Replay", "hi": "फिर से चलाएं", "ur": "دوبارہ چلائیں", "zh": "重新播放", "tl": "I-replay", "id": "Putar Ulang"},
    "كتم الصوت": {"en": "Mute", "hi": "म्यूट करें", "ur": "خاموش کریں", "zh": "静音", "tl": "I-mute", "id": "Bisukan (Mute)"},
    "إلغاء كتم الصوت": {"en": "Unmute", "hi": "अनम्यूट करें", "ur": "آواز بحال کریں", "zh": "取消静音", "tl": "I-unmute", "id": "Bunyikan"},
    "إلغاء كتم الصوت أثناء العرض": {"en": "Unmute during playback", "hi": "प्लेबैक के दौरान अनम्यूट करें", "ur": "پلے بیک کے دوران آواز کھولیں", "zh": "演示播放时开启声音", "tl": "I-unmute habang nagpe-play", "id": "Bunyikan saat pemutaran"},
    "تم كتم الصوت": {"en": "Muted", "hi": "म्यूट किया गया", "ur": "خاموش کیا گیا", "zh": "已静音", "tl": "Naka-mute", "id": "Dibisukan"},
    "مستوى الصوت": {"en": "Volume", "hi": "ध्वनि स्तर", "ur": "آواز کی سطح", "zh": "音量控制", "tl": "Lakas ng Tunog", "id": "Volume Suara"},
    "التحكم بالصوت": {"en": "Audio Control", "hi": "ऑडियो नियंत्रण", "ur": "آڈیو کنٹرول", "zh": "声音调节", "tl": "Kontrol sa Audio", "id": "Kontrol Audio"},
    "الصوت مدمج ويعمل": {"en": "Audio embedded & active", "hi": "ऑडियो एम्बेडेड और सक्रिय है", "ur": "آڈیو سرایت شدہ اور فعال ہے", "zh": "音频已成功内嵌正常工作", "tl": "Naka-embed at gumagana ang audio", "id": "Audio tertanam & aktif"},
    "العرض صامت": {"en": "Playback is silent", "hi": "प्लेबैक मूक है", "ur": "پلے بیک خاموش ہے", "zh": "静音播放中", "tl": "Tahimik ang pag-play", "id": "Pemutaran hening"},
    "جودة التصدير (حجم الملف)": {"en": "Export Quality (File Size)", "hi": "निर्यात गुणवत्ता (फ़ाइल आकार)", "ur": "برآمدی معیار (فائل کا سائز)", "zh": "导出画质压缩等级 (体积权重)", "tl": "Kalidad ng Pag-export (Laki ng File)", "id": "Kualitas Ekspor (Ukuran File)"},
    "الجودة": {"en": "Quality", "hi": "गुणवत्ता", "ur": "معیار", "zh": "画面质量", "tl": "Kalidad", "id": "Kualitas"},
    "عالي": {"en": "High", "hi": "उच्च", "ur": "اعلی", "zh": "高清", "tl": "Mataas", "id": "Tinggi"},
    "متوسط": {"en": "Medium", "hi": "मध्यम", "ur": "درمیانہ", "zh": "均衡中等", "tl": "Katamtaman", "id": "Sedang"},
    "منخفض": {"en": "Low", "hi": "कम", "ur": "کم", "zh": "低等体积", "tl": "Mababa", "id": "Rendah"},
    "فائق": {"en": "Ultra", "hi": "अल्ट्रा", "ur": "انتہائی", "zh": "无损极致", "tl": "Ultra", "id": "Ultra"},
    "أقصى ضغط": {"en": "Maximum Compression", "hi": "अधिकतम संपीड़न", "ur": "زیادہ سے زیادہ کمپریشن", "zh": "极致体积压缩", "tl": "Pinakamataas na Compression", "id": "Kompresi Maksimal"},
    "أقصى دقة ونظافة": {"en": "Max Clarity & Cleanliness", "hi": "अधिकतम स्पष्टता और स्वच्छता", "ur": "زیادہ سے زیادہ صفائی", "zh": "最高边缘清晰度", "tl": "Pinakamataas na Kalinawan", "id": "Kejelasan & Kebersihan Maksimal"},
    "الأبعاد": {"en": "Dimensions", "hi": "आयाम", "ur": "طول و عرض", "zh": "分辨率与像素尺寸", "tl": "Mga Dimensyon", "id": "Dimensi"},
    "الأبعاد المستخرجة": {"en": "Extracted Dimensions", "hi": "निकाले गए आयाम", "ur": "نکالے گئے طول و عرض", "zh": "解析提取的尺寸", "tl": "Na-extract na mga Dimensyon", "id": "Dimensi yang Diekstrak"},
    "المدة الزمنية": {"en": "Duration", "hi": "समय अवधि", "ur": "دورانیہ", "zh": "动画时长", "tl": "Tagal ng Oras", "id": "Durasi"},
    "المدة": {"en": "Duration", "hi": "अवधि", "ur": "مدت", "zh": "时长", "tl": "Tagal", "id": "Durasi"},
    "عدد الإطارات": {"en": "Frame Count", "hi": "फ्रेम संख्या", "ur": "فریمز کی تعداد", "zh": "总关键帧数", "tl": "Bilang ng Frame", "id": "Jumlah Bingkai"},
    "معدل الإطارات": {"en": "Frame Rate (FPS)", "hi": "फ्रेम दर (FPS)", "ur": "فریم ریٹ (FPS)", "zh": "帧率 (FPS)", "tl": "Frame Rate (FPS)", "id": "Kecepatan Bingkai (FPS)"},
    "ثانية": {"en": "seconds", "hi": "सेकंड", "ur": "سیکنڈ", "zh": "秒", "tl": "segundo", "id": "detik"},
    "إطار": {"en": "frame", "hi": "फ्रेम", "ur": "فریم", "zh": "帧", "tl": "frame", "id": "bingkai"},
    "فريم": {"en": "frame", "hi": "फ्रेम", "ur": "فریم", "zh": "帧", "tl": "frame", "id": "bingkai"},
    "فريمات": {"en": "frames", "hi": "फ्रेम्स", "ur": "فریمز", "zh": "帧", "tl": "frames", "id": "bingkai"},

    # Positions & Anchors
    "أعلى": {"en": "Top", "hi": "शीर्ष", "ur": "اوپر", "zh": "顶部", "tl": "Itaas", "id": "Atas"},
    "أسفل": {"en": "Bottom", "hi": "नीचे", "ur": "نیچے", "zh": "底部", "tl": "Ibaba", "id": "Bawah"},
    "يسار": {"en": "Left", "hi": "बाएं", "ur": "بائیں", "zh": "左侧", "tl": "Kaliwa", "id": "Kiri"},
    "يمين": {"en": "Right", "hi": "दाएं", "ur": "دائیں", "zh": "右侧", "tl": "Kanan", "id": "Kanan"},
    "الوسط": {"en": "Center", "hi": "केंद्र", "ur": "مرکز", "zh": "居中", "tl": "Gitna", "id": "Tengah"},
    "أعلى يسار": {"en": "Top Left", "hi": "ऊपर बाएं", "ur": "اوپر بائیں", "zh": "左上角", "tl": "Itaas Kaliwa", "id": "Kiri Atas"},
    "أعلى يمين": {"en": "Top Right", "hi": "ऊपर दाएं", "ur": "اوپر دائیں", "zh": "右上角", "tl": "Itaas Kanan", "id": "Kanan Atas"},
    "أسفل يسار": {"en": "Bottom Left", "hi": "नीचे बाएं", "ur": "نیچے بائیں", "zh": "左下角", "tl": "Ibaba Kaliwa", "id": "Kiri Bawah"},
    "أسفل يمين": {"en": "Bottom Right", "hi": "नीचे दाएं", "ur": "نیچے دائیں", "zh": "右下角", "tl": "Ibaba Kanan", "id": "Kanan Bawah"},
    "أعلى (Top)": {"en": "Top", "hi": "शीर्ष", "ur": "اوپر", "zh": "顶部", "tl": "Itaas", "id": "Atas"},
    "أسفل (Bottom)": {"en": "Bottom", "hi": "नीचे", "ur": "نیچے", "zh": "底部", "tl": "Ibaba", "id": "Bawah"},
    "يسار (Left)": {"en": "Left", "hi": "बाएं", "ur": "بائیں", "zh": "左侧", "tl": "Kaliwa", "id": "Kiri"},
    "يمين (Right)": {"en": "Right", "hi": "दाएं", "ur": "دائیں", "zh": "右侧", "tl": "Kanan", "id": "Kanan"},

    # Chroma & Colors
    "أخضر كروما": {"en": "Chroma Green", "hi": "क्रोमा हरा", "ur": "کروما سبز", "zh": "绿幕抠像色", "tl": "Chroma Green", "id": "Hijau Chroma"},
    "أزرق استودियो": {"en": "Studio Blue", "hi": "स्टूडियो नीला", "ur": "اسٹوڈیو نیلا", "zh": "影棚蓝底色", "tl": "Studio Blue", "id": "Biru Studio"},
    "أسود خالص": {"en": "Pure Black", "hi": "शुद्ध काला", "ur": "خالص سیاہ", "zh": "纯黑色", "tl": "Purong Itim", "id": "Hitam Murni"},
    "أبيض ناصع": {"en": "Pure White", "hi": "शुद्ध सफेद", "ur": "خالص سفید", "zh": "纯白色", "tl": "Purong Puti", "id": "Putih Murni"},
    "أحمر قرمزي": {"en": "Crimson Red", "hi": "गहरा लाल", "ur": "سرخ قرمزی", "zh": "深红亮色", "tl": "Crimson Red", "id": "Merah Tua"},
    "إزالة كروما متقدمة": {"en": "Advanced Chroma Removal", "hi": "उन्नत क्रोमा निष्कासन", "ur": "اعلی درجے کا کروما کا اخراج", "zh": "高级色度键控抠图", "tl": "Advanced na Pagtanggal ng Chroma", "id": "Penghapusan Chroma Tingkat Lanjut"},
    "إزالة انعكاسات البرومة واللون": {"en": "Spill & Color Fringe Removal", "hi": "स्पिल और कलर फ्रिंज हटाएं", "ur": "رنگ کے دھبے ہٹائیں", "zh": "消除反光杂色溢出", "tl": "Pagtanggal ng Spill at Color Fringe", "id": "Penghapusan Tumpahan Warna & Fringe"},
    "إزالة الهالة السوداء": {"en": "Black Halo Removal", "hi": "ब्लैक हेलो हटाएं", "ur": "سیاہ ہالہ ہٹائیں", "zh": "去除边缘黑晕瑕疵", "tl": "Pagtanggal ng Black Halo", "id": "Penghapusan Halo Hitam"},
    "ارتداد الحواف": {"en": "Edge Bounce", "hi": "एज बाउंस", "ur": "کناروں کا اچھال", "zh": "边缘反弹物理效果", "tl": "Edge Bounce", "id": "Pantulan Tepi"},
    "ارتداد حواف": {"en": "Edge Bounce", "hi": "एज बाउंस", "ur": "کناروں کا اچھال", "zh": "边缘回弹", "tl": "Edge Bounce", "id": "Pantulan Tepi"},
    "انحناء المربع": {"en": "Corner Radius", "hi": "कोने की गोलाई", "ur": "کونے کا گھماؤ", "zh": "圆角曲率", "tl": "Radius ng Sulok", "id": "Radius Sudut"},
    "إطار خارجي وظل للمربع": {"en": "Outer Border & Shadow", "hi": "बाहरी बॉर्डर और छाया", "ur": "بیرونی بارڈر اور سایہ", "zh": "外边框与高光阴影", "tl": "Panlabas na Border at Shadow", "id": "Batas Luar & Bayangan"},
    "استخدام شعار تجريبي جاهز": {"en": "Use Demo Logo", "hi": "डेमो लोगो का उपयोग करें", "ur": "ڈیمو لوگو استعمال کریں", "zh": "应用演示示例徽标", "tl": "Gumamit ng Demo Logo", "id": "Gunakan Logo Demo"},
    "استعادة الأصل": {"en": "Restore Original", "hi": "मूल पुनर्स्थापित करें", "ur": "اصل بحال کریں", "zh": "还原原始参数", "tl": "Ibalik ang Orihinal", "id": "Pulihkan Asli"},
    "الأصل": {"en": "Original", "hi": "मूल", "ur": "اصل", "zh": "原始源", "tl": "Orihinal", "id": "Asli"},
    "الأصلي": {"en": "Original", "hi": "मूल", "ur": "اصل", "zh": "原始", "tl": "Orihinal", "id": "Asli"},
    "الفيديو الأصلي": {"en": "Original Video", "hi": "मूल वीडियो", "ur": "اصل ویڈیو", "zh": "原始视频", "tl": "Orihinal na Video", "id": "Video Asli"},
    "الفيديو المصدر": {"en": "Source Video", "hi": "स्रोत वीडियो", "ur": "ماخذ ویڈیو", "zh": "源头视频", "tl": "Source Video", "id": "Video Sumber"},
    "المصدر النظيف": {"en": "Clean Source", "hi": "स्वच्छ स्रोत", "ur": "صاف ماخذ", "zh": "纯净源文件", "tl": "Malinis na Source", "id": "Sumber Bersih"},
    "الحجم الأصلي": {"en": "Original Size", "hi": "मूल आकार", "ur": "اصل سائز", "zh": "原始文件大小", "tl": "Orihinal na Laki", "id": "Ukuran Asli"},
    "الحجم النهائي": {"en": "Final Size", "hi": "अंतिम आकार", "ur": "حتمی سائز", "zh": "最终体积", "tl": "Huling Laki", "id": "Ukuran Akhir"},
    "الحجم التقريبي المتوقع": {"en": "Estimated Expected Size", "hi": "अनुमानित अपेक्षित आकार", "ur": "متوقع تخمینہ سائز", "zh": "预估生成文件体积", "tl": "Tinatayang Inaasahang Laki", "id": "Perkiraan Ukuran yang Diharapkan"},
    "الدقة الأصلية": {"en": "Original Resolution", "hi": "मूल रिज़ॉल्यूशन", "ur": "اصل ریزولوشن", "zh": "原始像素分辨率", "tl": "Orihinal na Resolution", "id": "Resolusi Asli"},
    "الخلفية الحالية": {"en": "Current Background", "hi": "वर्तमान पृष्ठभूमि", "ur": "موجودہ پس منظر", "zh": "当前选定背景", "tl": "Kasalukuyang Background", "id": "Latar Belakang Saat Ini"},
    "النهائي": {"en": "Final", "hi": "अंतिम", "ur": "حتمی", "zh": "最终成果", "tl": "Huli", "id": "Final"},
    "الكل": {"en": "All", "hi": "सभी", "ur": "سب", "zh": "全部", "tl": "Lahat", "id": "Semua"},
    "مسح الكل": {"en": "Clear All", "hi": "सभी साफ़ करें", "ur": "سب صاف کریں", "zh": "清空全部", "tl": "I-clear Lahat", "id": "Hapus Semua"},
    "تحديد الكل": {"en": "Select All", "hi": "सभी चुनें", "ur": "سب منتخب کریں", "zh": "全选", "tl": "Piliin Lahat", "id": "Pilih Semua"},
    "إلغاء التحديد": {"en": "Deselect", "hi": "अचयनित करें", "ur": "انتخاب ختم کریں", "zh": "取消选择", "tl": "I-deselect", "id": "Batal Pilih"},
    "إغلاق": {"en": "Close", "hi": "बंद करें", "ur": "بند کریں", "zh": "关闭", "tl": "Isara", "id": "Tutup"},
    "إلغاء": {"en": "Cancel", "hi": "रद्द करें", "ur": "منسوخ کریں", "zh": "取消", "tl": "Kanselahin", "id": "Batal"},
    "تأكيد": {"en": "Confirm", "hi": "पुष्टि करें", "ur": "تصدیق کریں", "zh": "确认", "tl": "Kumpirmahin", "id": "Konfirmasi"},
    "حذف": {"en": "Delete", "hi": "हटाएं", "ur": "حذف کریں", "zh": "删除", "tl": "Burahin", "id": "Hapus"},
    "تعديل": {"en": "Edit", "hi": "संपादित करें", "ur": "ترمیم کریں", "zh": "编辑修改", "tl": "I-edit", "id": "Edit"},
    "إضافة": {"en": "Add", "hi": "जोड़ें", "ur": "شامل کریں", "zh": "添加", "tl": "Magdagdag", "id": "Tambah"},
    "استيراد": {"en": "Import", "hi": "आयात करें", "ur": "درآمد کریں", "zh": "导入工程", "tl": "Mag-import", "id": "Impor"},
    "تصدير": {"en": "Export", "hi": "निर्यात करें", "ur": "برآمد کریں", "zh": "导出", "tl": "I-export", "id": "Ekspor"},
    "تنزيل": {"en": "Download", "hi": "डाउनलोड", "ur": "ڈاؤن لوڈ", "zh": "下载", "tl": "I-download", "id": "Unduh"},
    "تحميل": {"en": "Upload", "hi": "अपलोड", "ur": "اپ لوڈ", "zh": "上传", "tl": "I-upload", "id": "Unggah"},
    "مفعل": {"en": "Enabled", "hi": "सक्षम", "ur": "فعال", "zh": "已启用", "tl": "Naka-enable", "id": "Diaktifkan"},
    "معطل": {"en": "Disabled", "hi": "अक्षम", "ur": "غیر فعال", "zh": "已禁用", "tl": "Naka-disable", "id": "Dinonaktifkan"},
    "تلقائي": {"en": "Automatic", "hi": "स्वचालित", "ur": "خودکار", "zh": "自动", "tl": "Awtomatiko", "id": "Otomatis"},
    "يدوي": {"en": "Manual", "hi": "मैनुअल", "ur": "دستی", "zh": "手动模式", "tl": "Mano-mano", "id": "Manual"},
    "ابدأ الآن": {"en": "Start Now", "hi": "अभी शुरू करें", "ur": "ابھی شروع کریں", "zh": "立即体验", "tl": "Simulan Ngayon", "id": "Mulai Sekarang"},
    "فتح الأداة": {"en": "Open Tool", "hi": "टूल खोलें", "ur": "ٹول کھولیں", "zh": "打开功能", "tl": "Buksan ang Tool", "id": "Buka Alat"},
    "تجربة الأداة": {"en": "Try Tool", "hi": "टूल आज़माएं", "ur": "ٹول آزمائیں", "zh": "尝试使用", "tl": "Subukan ang Tool", "id": "Coba Alat"},
    "الأداة السابقة": {"en": "Previous Tool", "hi": "पिछला टूल", "ur": "پچھلا ٹول", "zh": "上一个工具", "tl": "Nakaraang Tool", "id": "Alat Sebelumnya"},
    "الأداة التالية": {"en": "Next Tool", "hi": "अगला टूल", "ur": "اگلا ٹول", "zh": "下一个工具", "tl": "Susunod na Tool", "id": "Alat Berikutnya"},
    "الانتقال وفتح الأداة السابقة": {"en": "Go to previous tool", "hi": "पिछले टूल पर जाएं", "ur": "پچھلے ٹول پر جائیں", "zh": "切换至上一项功能", "tl": "Pumunta sa nakaraang tool", "id": "Buka alat sebelumnya"},
    "الانتقال وفتح الأداة التالية": {"en": "Go to next tool", "hi": "अगले टूल पर जाएं", "ur": "اگلے ٹول پر جائیں", "zh": "切换至下一项功能", "tl": "Pumunta sa susunod na tool", "id": "Buka alat berikutnya"},
    "عرض الكل": {"en": "View All", "hi": "सभी देखें", "ur": "تمام دیکھیں", "zh": "查看全部", "tl": "Tingnan Lahat", "id": "Lihat Semua"},
    "المزيد": {"en": "More", "hi": "अधिक", "ur": "مزید", "zh": "更多选项", "tl": "Higit pa", "id": "Lebih banyak"},
    "إعادة المحاولة": {"en": "Retry", "hi": "पुनः प्रयास करें", "ur": "دوبارہ کوشش کریں", "zh": "重试", "tl": "Subukan Muli", "id": "Coba Lagi"},
    "متابعة": {"en": "Continue", "hi": "जारी रखें", "ur": "جاری رکھیں", "zh": "继续操作", "tl": "Magpatuloy", "id": "Lanjutkan"},
    "تطبيق": {"en": "Apply", "hi": "लागू करें", "ur": "لاگو کریں", "zh": "应用设置", "tl": "Ilapat", "id": "Terapkan"},
    "تحديث": {"en": "Update", "hi": "अपडेट करें", "ur": "اپ ڈیٹ کریں", "zh": "更新", "tl": "I-update", "id": "Perbarui"},
    "الإعدادات": {"en": "Settings", "hi": "सेटिंग्स", "ur": "ترتیبات", "zh": "设置选项", "tl": "Mga Setting", "id": "Pengaturan"},
    "إعدادات": {"en": "Settings", "hi": "सेटिंग्स", "ur": "ترتیبات", "zh": "设置", "tl": "Mga Setting", "id": "Pengaturan"},
    "الإعدادات السريعة": {"en": "Quick Settings", "hi": "त्वरित सेटिंग्स", "ur": "فوری ترتیبات", "zh": "快捷设置", "tl": "Mabilisang Setting", "id": "Pengaturan Cepat"},
    "الخيارات": {"en": "Options", "hi": "विकल्प", "ur": "آپشنز", "zh": "选项参数", "tl": "Mga Opsyon", "id": "Opsi"},
    "خيارات": {"en": "Options", "hi": "विकल्प", "ur": "آپشنز", "zh": "选项", "tl": "Mga Opsyon", "id": "Opsi"},
    "الملف": {"en": "File", "hi": "फ़ाइल", "ur": "فائل", "zh": "文件", "tl": "File", "id": "File"},
    "ملف": {"en": "file", "hi": "फ़ाइल", "ur": "فائل", "zh": "文件", "tl": "file", "id": "file"},
    "ملفات": {"en": "files", "hi": "फ़ाइलें", "ur": "فائلیں", "zh": "文件列表", "tl": "mga file", "id": "file"},
    "الصورة": {"en": "Image", "hi": "छवि", "ur": "تصویر", "zh": "图像", "tl": "Larawan", "id": "Gambar"},
    "صورة": {"en": "Image", "hi": "चित्र", "ur": "تصویر", "zh": "图片", "tl": "Larawan", "id": "Gambar"},
    "الفيديو": {"en": "Video", "hi": "वीडियो", "ur": "ویڈیو", "zh": "视频", "tl": "Video", "id": "Video"},
    "فيديو": {"en": "Video", "hi": "वीडियो", "ur": "ویڈیو", "zh": "视频", "tl": "Video", "id": "Video"},
    "الصوت": {"en": "Audio", "hi": "ऑडियो", "ur": "آڈیو", "zh": "音频", "tl": "Audio", "id": "Audio"},
    "صوت": {"en": "Audio", "hi": "ध्वनि", "ur": "آواز", "zh": "声音", "tl": "Audio", "id": "Audio"},
    "صيغة": {"en": "Format", "hi": "प्रारूप", "ur": "فارمیٹ", "zh": "格式", "tl": "Format", "id": "Format"},
    "متحرك": {"en": "Animated", "hi": "एनिमेटेड", "ur": "متحرک", "zh": "动态", "tl": "Animated", "id": "Bergerak"},
    "ثابت": {"en": "Static", "hi": "स्थिर", "ur": "جامد", "zh": "静态", "tl": "Static", "id": "Statis"},
    "شفاف": {"en": "Transparent", "hi": "पारदर्शी", "ur": "شفاف", "zh": "透明通道", "tl": "Transparent", "id": "Transparan"},
    "معتم": {"en": "Opaque", "hi": "अपारदर्शी", "ur": "غیر شفاف", "zh": "不透明", "tl": "Opaque", "id": "Buram"},
    "حد أقصى": {"en": "Maximum", "hi": "अधिकतम", "ur": "زیادہ سے زیادہ", "zh": "最大限制", "tl": "Maximum", "id": "Maksimum"},
    "حد أدنى": {"en": "Minimum", "hi": "न्यूनतम", "ur": "کم سے کم", "zh": "最小限制", "tl": "Minimum", "id": "Minimum"}
}

# Group into language dictionaries
langs = ["en", "hi", "ur", "zh", "tl", "id"]
site_dicts = {l: {} for l in langs}

for ar_term, translations in lexicon.items():
    for l in langs:
        site_dicts[l][ar_term] = translations.get(l, translations["en"])

# Write out src/utils/siteDictionary.ts
header = """/**
 * Multi-language lexicon for site-wide translation across all tools, icons, buttons, and pages.
 * Supports: Arabic (ar - source), English (en), Hindi (hi), Urdu (ur), Chinese (zh), Filipino (tl), Indonesian (id).
 */

export interface TranslationDictionary {
  [key: string]: string;
}

export const SITE_DICTIONARIES: Record<string, TranslationDictionary> = """

code = header + json.dumps(site_dicts, ensure_ascii=False, indent=2) + """;

// Pre-sorted dictionary entries cache for high-speed multi-term sentence replacement
const sortedEntriesCache = new Map<string, [string, string][]>();

export function getSortedDictionaryEntries(langCode: string): [string, string][] {
  if (sortedEntriesCache.has(langCode)) {
    return sortedEntriesCache.get(langCode)!;
  }

  const dict = SITE_DICTIONARIES[langCode];
  if (!dict) return [];

  // Sort entries strictly by Arabic key length in descending order (longest compound phrases first)
  const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  sortedEntriesCache.set(langCode, entries);
  return entries;
}

/**
 * Universal text transformer: converts any string containing Arabic words/phrases into the target language.
 */
export function translateString(text: string, langCode: string, isArabic: boolean): string {
  if (isArabic || !text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  const dict = SITE_DICTIONARIES[langCode];
  if (!dict) return text;

  // 1. Direct exact match
  if (dict[trimmed]) {
    return text.replace(trimmed, dict[trimmed]);
  }

  // 2. Comprehensive multi-phrase and token replacement from longest to shortest
  const sortedEntries = getSortedDictionaryEntries(langCode);
  let current = trimmed;
  let replacedAny = false;

  for (let i = 0; i < sortedEntries.length; i++) {
    const [arKey, targetVal] = sortedEntries[i];
    if (arKey.length >= 2 && current.includes(arKey)) {
      current = current.split(arKey).join(targetVal);
      replacedAny = true;
    }
  }

  if (replacedAny) {
    return text.replace(trimmed, current);
  }

  return text;
}
"""

with open("src/utils/siteDictionary.ts", "w", encoding="utf-8") as f:
    f.write(code)

print("Generated src/utils/siteDictionary.ts successfully with", len(lexicon), "terms.")
