import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Phone, Globe2 } from 'lucide-react';
import { COUNTRY_CODES, CountryCodeItem, parsePhoneNumber } from '../data/countryCodes';
import { Language } from '../types';

interface InternationalPhoneInputProps {
  value: string;
  onChange: (fullFormattedNumber: string) => void;
  lang?: Language;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}

export const InternationalPhoneInput: React.FC<InternationalPhoneInputProps> = ({
  value,
  onChange,
  lang = 'ar',
  required = false,
  disabled = false,
  placeholder,
  id,
  className = ''
}) => {
  // Parse initial or passed value
  const parsed = useMemo(() => parsePhoneNumber(value), [value]);

  const [selectedCountry, setSelectedCountry] = useState<CountryCodeItem>(parsed.country);
  const [localNumber, setLocalNumber] = useState<string>(parsed.localNumber);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when value prop changes from outside (e.g. switching accounts)
  useEffect(() => {
    const p = parsePhoneNumber(value);
    setSelectedCountry(p.country);
    setLocalNumber(p.localNumber);
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input on open
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Filter countries by query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      return COUNTRY_CODES;
    }
    const q = searchQuery.toLowerCase().trim();
    return COUNTRY_CODES.filter((c) => {
      return (
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.dialCode.toLowerCase().includes(q) ||
        c.dialCode.replace('+', '').includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  // Group into Priority (Arab / Top) and Others when not searching
  const priorityCountries = useMemo(() => {
    return filteredCountries.filter((c) => c.priority);
  }, [filteredCountries]);

  const otherCountries = useMemo(() => {
    return filteredCountries.filter((c) => !c.priority);
  }, [filteredCountries]);

  // Trigger parent onChange whenever country or localNumber changes
  const notifyChange = (country: CountryCodeItem, num: string) => {
    const cleanNum = num.replace(/^0+/, '').replace(/\s+/g, '');
    if (!cleanNum) {
      onChange('');
    } else {
      onChange(`${country.dialCode}${cleanNum}`);
    }
  };

  const handleCountrySelect = (country: CountryCodeItem) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');
    notifyChange(country, localNumber);
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only permit digits
    const cleaned = e.target.value.replace(/[^0-9]/g, '');
    setLocalNumber(cleaned);
    notifyChange(selectedCountry, cleaned);
  };

  // Default placeholders
  const defaultPlaceholder = lang === 'ar' 
    ? '501234567 (بدون صفر البداية)' 
    : '501234567 (without leading 0)';

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 focus-within:border-emerald-500 transition-colors shadow-inner overflow-hidden">
        {/* Country Selector Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-r border-slate-700/80 transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          title={lang === 'ar' ? 'اختر الدولة ومفتاح الاتصال الدولي' : 'Select country and international dial code'}
        >
          <span className="text-xl leading-none">{selectedCountry.flag}</span>
          <span className="font-mono text-xs font-bold text-emerald-400 dir-ltr">
            {selectedCountry.dialCode}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Local Number Input */}
        <div className="relative flex-1">
          <input
            id={id}
            type="tel"
            required={required}
            disabled={disabled}
            value={localNumber}
            onChange={handleLocalNumberChange}
            placeholder={placeholder || defaultPlaceholder}
            className="w-full px-3.5 py-2.5 bg-transparent text-sm font-mono font-bold text-emerald-400 placeholder:text-slate-500 placeholder:font-sans placeholder:font-normal focus:outline-none dir-ltr text-left"
          />
        </div>
      </div>

      {/* Formatted Preview Tag */}
      {localNumber && (
        <div className="flex items-center justify-between gap-2 mt-1.5 px-1 text-[11px] text-slate-400 font-mono">
          <span className="text-slate-400">
            {lang === 'ar' ? 'الرقم الدولي المعتمد:' : 'Full International Phone:'}
          </span>
          <span className="font-bold text-emerald-400 dir-ltr bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            {selectedCountry.flag} {selectedCountry.dialCode} {localNumber}
          </span>
        </div>
      )}

      {/* Country Dropdown Popover */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/80 flex flex-col overflow-hidden backdrop-blur-md">
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'ابحث باسم الدولة أو كود الاتصال (+966)...'
                    : 'Search country name or code (+966)...'
                }
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Countries List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {lang === 'ar' ? 'لا توجد دولة مطابقة للبحث' : 'No matching countries found'}
              </div>
            ) : (
              <>
                {/* If no search, show Priority Section */}
                {!searchQuery && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <Globe2 className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'الدول العربية والأكثر استخداماً' : 'Popular Countries'}</span>
                    </div>

                    {priorityCountries.map((c) => {
                      const isSelected = selectedCountry.code === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleCountrySelect(c)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-right ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{c.flag}</span>
                            <span className="truncate">
                              {lang === 'ar' ? c.nameAr : c.nameEn}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-emerald-400 font-bold dir-ltr">
                              {c.dialCode}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                          </div>
                        </button>
                      );
                    })}

                    <div className="px-2 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-800 mt-1">
                      <span>{lang === 'ar' ? 'جميع دول العالم' : 'All World Countries'}</span>
                    </div>
                  </>
                )}

                {/* Other or Filtered Countries */}
                {(!searchQuery ? otherCountries : filteredCountries).map((c) => {
                  const isSelected = selectedCountry.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountrySelect(c)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-right ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{c.flag}</span>
                        <span className="truncate">
                          {lang === 'ar' ? c.nameAr : c.nameEn}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-emerald-400 font-bold dir-ltr">
                          {c.dialCode}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
