import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Save, Phone, Globe, Image as ImageIcon, CheckCircle, AlertCircle, Gift } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminSettings() {
  const { siteName, siteLogo, whatsappNumber, welcomeGiftEnabled, welcomeGiftDiscount, updateSettings } = useStore();
  const [formData, setFormData] = useState({
    siteName,
    siteLogo,
    whatsappNumber,
    welcomeGiftEnabled,
    welcomeGiftDiscount,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await updateSettings(formData);
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Website Settings</h1>
          <p className="text-slate-500 mt-1">Configure your site identity and contact preferences.</p>
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="font-medium">{message.text}</span>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
          {/* Site Identity Section */}
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              Site Identity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Website Name</label>
                <input
                  type="text"
                  value={formData.siteName}
                  onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                  placeholder="Enter shop name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Logo URL</label>
                <p className="text-[10px] text-amber-600 font-bold uppercase animate-pulse">Recommended: 512 x 512 px or 400 x 100 px</p>
                <div className="relative">
                  <input
                    type="url"
                    value={formData.siteLogo}
                    onChange={(e) => setFormData({ ...formData, siteLogo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <ImageIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-slate-400">Provide an image URL for your shop logo. Transparent background recommended.</p>
              </div>
            </div>
            
            {formData.siteLogo && (
              <div className="mt-6 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center">
                <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 block text-center">Logo Preview</span>
                    <img src={formData.siteLogo} alt="Logo Preview" className="h-12 w-auto object-contain" />
                </div>
              </div>
            )}
          </div>

          {/* Promotions Section */}
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
              Promotions & Marketing
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-pink-100 text-pink-600 rounded-xl">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Welcome Gift (هدايا ترحيبية)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Show a high-quality gift opening animation for new users with a promo code.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, welcomeGiftEnabled: !formData.welcomeGiftEnabled })}
                  className={`w-14 h-8 rounded-full transition-colors relative flex-shrink-0 ${formData.welcomeGiftEnabled ? 'bg-pink-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-sm ${formData.welcomeGiftEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {formData.welcomeGiftEnabled && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3"
                >
                  <label className="text-sm font-bold text-slate-700">Gift Discount Percentage (%)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.welcomeGiftDiscount}
                      onChange={(e) => setFormData({ ...formData, welcomeGiftDiscount: parseInt(e.target.value) })}
                      className="w-32 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-sm text-slate-500 font-medium">This discount will be applied to the randomly generated codes.</span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Contact Section */}
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-500" />
              Contact Preferences
            </h2>
            <div className="space-y-2 max-w-md">
              <label className="text-sm font-bold text-slate-700">WhatsApp Support Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  placeholder="+20 123 456 7890"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-xs text-slate-400">Include country code (e.g. +20...). This number will receive manual payment inquiries.</p>
            </div>
          </div>

          <div className="p-6 bg-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
