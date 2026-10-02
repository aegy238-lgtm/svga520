export interface CountryCodeItem {
  code: string;       // ISO 2-letter
  nameAr: string;     // Arabic Name
  nameEn: string;     // English Name
  dialCode: string;   // e.g. "+966"
  flag: string;       // Emoji flag
  priority?: boolean; // Arab and popular countries shown at top
}

export const COUNTRY_CODES: CountryCodeItem[] = [
  // --- Arab & Middle East Countries (Top Priority) ---
  { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', priority: true },
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', dialCode: '+20', flag: '🇪🇬', priority: true },
  { code: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', priority: true },
  { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', dialCode: '+965', flag: '🇰🇼', priority: true },
  { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', dialCode: '+974', flag: '🇶🇦', priority: true },
  { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', dialCode: '+973', flag: '🇧🇭', priority: true },
  { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman', dialCode: '+968', flag: '🇴🇲', priority: true },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', dialCode: '+964', flag: '🇮🇶', priority: true },
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', dialCode: '+962', flag: '🇯🇴', priority: true },
  { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', dialCode: '+970', flag: '🇵🇸', priority: true },
  { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', dialCode: '+961', flag: '🇱🇧', priority: true },
  { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', dialCode: '+963', flag: '🇸🇾', priority: true },
  { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', dialCode: '+967', flag: '🇾🇪', priority: true },
  { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', dialCode: '+212', flag: '🇲🇦', priority: true },
  { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', dialCode: '+213', flag: '🇩🇿', priority: true },
  { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', dialCode: '+216', flag: '🇹🇳', priority: true },
  { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', dialCode: '+218', flag: '🇱🇾', priority: true },
  { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', dialCode: '+249', flag: '🇸🇩', priority: true },
  { code: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania', dialCode: '+222', flag: '🇲🇷', priority: true },
  { code: 'SO', nameAr: 'الصومال', nameEn: 'Somalia', dialCode: '+252', flag: '🇸🇴', priority: true },
  { code: 'DJ', nameAr: 'جيبوتي', nameEn: 'Djibouti', dialCode: '+253', flag: '🇩🇯', priority: true },
  { code: 'KM', nameAr: 'جزر القمر', nameEn: 'Comoros', dialCode: '+269', flag: '🇰🇲', priority: true },

  // --- Popular Global Countries ---
  { code: 'US', nameAr: 'الولايات المتحدة الأمريكية', nameEn: 'United States', dialCode: '+1', flag: '🇺🇸', priority: true },
  { code: 'CA', nameAr: 'كندا', nameEn: 'Canada', dialCode: '+1', flag: '🇨🇦', priority: true },
  { code: 'GB', nameAr: 'المملكة المتحدة (بريطانيا)', nameEn: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', priority: true },
  { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', dialCode: '+90', flag: '🇹🇷', priority: true },
  { code: 'CN', nameAr: 'الصين', nameEn: 'China', dialCode: '+86', flag: '🇨🇳', priority: true },
  { code: 'DE', nameAr: 'ألمانيا', nameEn: 'Germany', dialCode: '+49', flag: '🇩🇪', priority: true },
  { code: 'FR', nameAr: 'فرنسا', nameEn: 'France', dialCode: '+33', flag: '🇫🇷', priority: true },
  { code: 'IT', nameAr: 'إيطاليا', nameEn: 'Italy', dialCode: '+39', flag: '🇮🇹', priority: true },
  { code: 'ES', nameAr: 'إسبانيا', nameEn: 'Spain', dialCode: '+34', flag: '🇪🇸', priority: true },
  { code: 'RU', nameAr: 'روسيا', nameEn: 'Russia', dialCode: '+7', flag: '🇷🇺', priority: true },
  { code: 'IN', nameAr: 'الهند', nameEn: 'India', dialCode: '+91', flag: '🇮🇳', priority: true },
  { code: 'PK', nameAr: 'باكستان', nameEn: 'Pakistan', dialCode: '+92', flag: '🇵🇰', priority: true },
  { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', dialCode: '+62', flag: '🇮🇩', priority: true },
  { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia', dialCode: '+60', flag: '🇲🇾', priority: true },
  { code: 'JP', nameAr: 'اليابان', nameEn: 'Japan', dialCode: '+81', flag: '🇯🇵', priority: true },
  { code: 'KR', nameAr: 'كوريا الجنوبية', nameEn: 'South Korea', dialCode: '+82', flag: '🇰🇷', priority: true },
  { code: 'AU', nameAr: 'أستراليا', nameEn: 'Australia', dialCode: '+61', flag: '🇦🇺', priority: true },
  { code: 'BR', nameAr: 'البرازيل', nameEn: 'Brazil', dialCode: '+55', flag: '🇧🇷', priority: true },

  // --- Comprehensive World Countries (Alphabetical) ---
  { code: 'AF', nameAr: 'أفغانستان', nameEn: 'Afghanistan', dialCode: '+93', flag: '🇦🇫' },
  { code: 'AL', nameAr: 'ألبانيا', nameEn: 'Albania', dialCode: '+355', flag: '🇦🇱' },
  { code: 'AD', nameAr: 'أندورا', nameEn: 'Andorra', dialCode: '+376', flag: '🇦🇩' },
  { code: 'AO', nameAr: 'أنغولا', nameEn: 'Angola', dialCode: '+244', flag: '🇦🇴' },
  { code: 'AR', nameAr: 'الأرجنتين', nameEn: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'AM', nameAr: 'أرمينيا', nameEn: 'Armenia', dialCode: '+374', flag: '🇦🇲' },
  { code: 'AT', nameAr: 'النمسا', nameEn: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'AZ', nameAr: 'أذربيجان', nameEn: 'Azerbaijan', dialCode: '+994', flag: '🇦🇿' },
  { code: 'BD', nameAr: 'بنغلاديش', nameEn: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { code: 'BY', nameAr: 'بيلاروسيا', nameEn: 'Belarus', dialCode: '+375', flag: '🇧🇾' },
  { code: 'BE', nameAr: 'بلجيكا', nameEn: 'Belgium', dialCode: '+32', flag: '🇧🇪' },
  { code: 'BZ', nameAr: 'بليز', nameEn: 'Belize', dialCode: '+501', flag: '🇧🇿' },
  { code: 'BJ', nameAr: 'بنين', nameEn: 'Benin', dialCode: '+229', flag: '🇧🇯' },
  { code: 'BO', nameAr: 'بوليفيا', nameEn: 'Bolivia', dialCode: '+591', flag: '🇧🇴' },
  { code: 'BA', nameAr: 'البوسنة والهرسك', nameEn: 'Bosnia and Herzegovina', dialCode: '+387', flag: '🇧🇦' },
  { code: 'BW', nameAr: 'بوتسوانا', nameEn: 'Botswana', dialCode: '+267', flag: '🇧🇼' },
  { code: 'BN', nameAr: 'بروناي', nameEn: 'Brunei', dialCode: '+673', flag: '🇧🇳' },
  { code: 'BG', nameAr: 'بلغاريا', nameEn: 'Bulgaria', dialCode: '+359', flag: '🇧🇬' },
  { code: 'BF', nameAr: 'بوركينا فاسو', nameEn: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫' },
  { code: 'BI', nameAr: 'بوروندي', nameEn: 'Burundi', dialCode: '+257', flag: '🇧🇮' },
  { code: 'KH', nameAr: 'كمبوديا', nameEn: 'Cambodia', dialCode: '+855', flag: '🇰🇭' },
  { code: 'CM', nameAr: 'الكاميرون', nameEn: 'Cameroon', dialCode: '+237', flag: '🇨🇲' },
  { code: 'CL', nameAr: 'تشيلي', nameEn: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { code: 'CO', nameAr: 'كولومبيا', nameEn: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { code: 'CR', nameAr: 'كوستاريكا', nameEn: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { code: 'HR', nameAr: 'كرواتيا', nameEn: 'Croatia', dialCode: '+385', flag: '🇭🇷' },
  { code: 'CY', nameAr: 'قبرص', nameEn: 'Cyprus', dialCode: '+357', flag: '🇨🇾' },
  { code: 'CZ', nameAr: 'التشيك', nameEn: 'Czech Republic', dialCode: '+420', flag: '🇨🇿' },
  { code: 'DK', nameAr: 'الدنمارك', nameEn: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
  { code: 'DO', nameAr: 'جمهورية الدومينيكان', nameEn: 'Dominican Republic', dialCode: '+1', flag: '🇩🇴' },
  { code: 'EC', nameAr: 'الإكوادور', nameEn: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { code: 'EE', nameAr: 'إستونيا', nameEn: 'Estonia', dialCode: '+372', flag: '🇪🇪' },
  { code: 'ET', nameAr: 'إثيوبيا', nameEn: 'Ethiopia', dialCode: '+251', flag: '🇪🇹' },
  { code: 'FI', nameAr: 'فنلندا', nameEn: 'Finland', dialCode: '+358', flag: '🇫🇮' },
  { code: 'GE', nameAr: 'جورجيا', nameEn: 'Georgia', dialCode: '+995', flag: '🇬🇪' },
  { code: 'GH', nameAr: 'غانا', nameEn: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
  { code: 'GR', nameAr: 'اليونان', nameEn: 'Greece', dialCode: '+30', flag: '🇬🇷' },
  { code: 'HK', nameAr: 'هونغ كونغ', nameEn: 'Hong Kong', dialCode: '+852', flag: '🇭🇰' },
  { code: 'HU', nameAr: 'المجر (هنغاريا)', nameEn: 'Hungary', dialCode: '+36', flag: '🇭🇺' },
  { code: 'IS', nameAr: 'آيسلندا', nameEn: 'Iceland', dialCode: '+354', flag: '🇮🇸' },
  { code: 'IR', nameAr: 'إيران', nameEn: 'Iran', dialCode: '+98', flag: '🇮🇷' },
  { code: 'IE', nameAr: 'أيرلندا', nameEn: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'CI', nameAr: 'ساحل العاج', nameEn: 'Ivory Coast', dialCode: '+225', flag: '🇨🇮' },
  { code: 'KZ', nameAr: 'كازاخستان', nameEn: 'Kazakhstan', dialCode: '+7', flag: '🇰🇿' },
  { code: 'KE', nameAr: 'كينيا', nameEn: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'KG', nameAr: 'قيرغيزستان', nameEn: 'Kyrgyzstan', dialCode: '+996', flag: '🇰🇬' },
  { code: 'LV', nameAr: 'لاتفيا', nameEn: 'Latvia', dialCode: '+371', flag: '🇱🇻' },
  { code: 'LT', nameAr: 'ليتوانيا', nameEn: 'Lithuania', dialCode: '+370', flag: '🇱🇹' },
  { code: 'LU', nameAr: 'لوكسمبورغ', nameEn: 'Luxembourg', dialCode: '+352', flag: '🇱🇺' },
  { code: 'MO', nameAr: 'ماكاو', nameEn: 'Macau', dialCode: '+853', flag: '🇲🇴' },
  { code: 'MV', nameAr: 'جزر المالديف', nameEn: 'Maldives', dialCode: '+960', flag: '🇲🇻' },
  { code: 'ML', nameAr: 'مالي', nameEn: 'Mali', dialCode: '+223', flag: '🇲🇱' },
  { code: 'MT', nameAr: 'مالطا', nameEn: 'Malta', dialCode: '+356', flag: '🇲🇹' },
  { code: 'MX', nameAr: 'المكسيك', nameEn: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { code: 'MD', nameAr: 'مولدوفا', nameEn: 'Moldova', dialCode: '+373', flag: '🇲🇩' },
  { code: 'MC', nameAr: 'موناكو', nameEn: 'Monaco', dialCode: '+377', flag: '🇲🇨' },
  { code: 'MN', nameAr: 'منغوليا', nameEn: 'Mongolia', dialCode: '+976', flag: '🇲🇳' },
  { code: 'ME', nameAr: 'الجبل الأسود', nameEn: 'Montenegro', dialCode: '+382', flag: '🇲🇪' },
  { code: 'NP', nameAr: 'نيبال', nameEn: 'Nepal', dialCode: '+977', flag: '🇳🇵' },
  { code: 'NL', nameAr: 'هولندا', nameEn: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'NZ', nameAr: 'نيوزيلندا', nameEn: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'NG', nameAr: 'نيجيريا', nameEn: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'NO', nameAr: 'النرويج', nameEn: 'Norway', dialCode: '+47', flag: '🇳🇴' },
  { code: 'PA', nameAr: 'بنما', nameEn: 'Panama', dialCode: '+507', flag: '🇵🇦' },
  { code: 'PY', nameAr: 'باراغواي', nameEn: 'Paraguay', dialCode: '+595', flag: '🇵🇾' },
  { code: 'PE', nameAr: 'بيرو', nameEn: 'Peru', dialCode: '+51', flag: '🇵🇪' },
  { code: 'PH', nameAr: 'الفلبين', nameEn: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'PL', nameAr: 'بولندا', nameEn: 'Poland', dialCode: '+48', flag: '🇵🇱' },
  { code: 'PT', nameAr: 'البرتغال', nameEn: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'RO', nameAr: 'رومانيا', nameEn: 'Romania', dialCode: '+40', flag: '🇷🇴' },
  { code: 'SN', nameAr: 'السنغال', nameEn: 'Senegal', dialCode: '+221', flag: '🇸🇳' },
  { code: 'RS', nameAr: 'صربيا', nameEn: 'Serbia', dialCode: '+381', flag: '🇷🇸' },
  { code: 'SG', nameAr: 'سنغافورة', nameEn: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'SK', nameAr: 'سلوفاكيا', nameEn: 'Slovakia', dialCode: '+421', flag: '🇸🇰' },
  { code: 'SI', nameAr: 'سلوفينيا', nameEn: 'Slovenia', dialCode: '+386', flag: '🇸🇮' },
  { code: 'ZA', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'LK', nameAr: 'سريلانكا', nameEn: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰' },
  { code: 'SE', nameAr: 'السويد', nameEn: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
  { code: 'CH', nameAr: 'سويسرا', nameEn: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { code: 'TW', nameAr: 'تايوان', nameEn: 'Taiwan', dialCode: '+886', flag: '🇹🇼' },
  { code: 'TJ', nameAr: 'طاجيكستان', nameEn: 'Tajikistan', dialCode: '+992', flag: '🇹🇯' },
  { code: 'TH', nameAr: 'تايلاند', nameEn: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'UA', nameAr: 'أوكرانيا', nameEn: 'Ukraine', dialCode: '+380', flag: '🇺🇦' },
  { code: 'UY', nameAr: 'أوروغواي', nameEn: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { code: 'UZ', nameAr: 'أوزبكستان', nameEn: 'Uzbekistan', dialCode: '+998', flag: '🇺🇿' },
  { code: 'VE', nameAr: 'فنزويلا', nameEn: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
  { code: 'VN', nameAr: 'فيتنام', nameEn: 'Vietnam', dialCode: '+84', flag: '🇻🇳' }
];

/**
 * Helper to parse any raw phone string into a matching country and national number
 */
export function parsePhoneNumber(rawPhone: string): { country: CountryCodeItem; localNumber: string } {
  const defaultCountry = COUNTRY_CODES[0]; // Saudi Arabia (+966) by default
  if (!rawPhone || !rawPhone.trim()) {
    return { country: defaultCountry, localNumber: '' };
  }

  const clean = rawPhone.trim().replace(/[^0-9+]/g, '');

  // Try matching against dial codes sorted by length descending (+971 before +97, etc.)
  const sortedByDialLen = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);

  for (const c of sortedByDialLen) {
    if (clean.startsWith(c.dialCode)) {
      const local = clean.slice(c.dialCode.length).replace(/^0+/, ''); // strip leading zero
      return { country: c, localNumber: local };
    }
    // Also check without the '+' sign
    const dialDigits = c.dialCode.replace('+', '');
    if (clean.startsWith(dialDigits)) {
      const local = clean.slice(dialDigits.length).replace(/^0+/, '');
      return { country: c, localNumber: local };
    }
  }

  // Fallback: If no dialCode matched, return defaultCountry with the whole input
  return {
    country: defaultCountry,
    localNumber: clean.replace(/^\+/, '').replace(/^966/, '').replace(/^0+/, '')
  };
}
