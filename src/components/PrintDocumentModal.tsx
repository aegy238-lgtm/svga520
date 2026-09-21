import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Award, 
  Package, 
  CheckCircle, 
  ShieldCheck, 
  Download, 
  QrCode,
  Calendar,
  DollarSign,
  User,
  Mail,
  Copy,
  Check
} from 'lucide-react';
import { DeliveryItem, Language } from '../types';

interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryItem | null;
  allDeliveries?: DeliveryItem[];
  defaultDocType?: 'invoice' | 'certificate' | 'voucher' | 'report';
  lang: Language;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  onClose,
  delivery,
  allDeliveries = [],
  defaultDocType = 'invoice',
  lang
}) => {
  const [docType, setDocType] = useState<'invoice' | 'certificate' | 'voucher' | 'report'>(defaultDocType);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentDelivery = delivery || allDeliveries[0];

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLicense = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRtl = lang === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[96vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Top Control Bar (Hidden during actual print via .no-print) */}
        <div className="no-print p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'مركز معاينة وطباعة المستندات' : 'Document Printing Center'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar' 
                  ? 'اختر المستند المطلوب واضغط طباعة للتصدير إلى طابعة أو حفظ بصيغة PDF' 
                  : 'Select document and print or export as PDF'}
              </p>
            </div>
          </div>

          {/* Document Type Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {currentDelivery && (
              <>
                <button
                  type="button"
                  onClick={() => setDocType('invoice')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    docType === 'invoice'
                      ? 'bg-cyan-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'الفاتورة الرسمية' : 'Invoice'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDocType('certificate')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    docType === 'certificate'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'شهادة الترخيص' : 'License Cert'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDocType('voucher')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    docType === 'voucher'
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'بطاقة الاستلام' : 'Delivery Slip'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDocType('report')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                docType === 'report'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'كشف المبيعات' : 'Sales Report'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg hover:brightness-110 active:scale-95 flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'ar' ? 'طباعة الآن (Print)' : 'Print Now'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Body (Scrollable in modal, cleanly formatted for paper print) */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-950/60 flex justify-center">
          
          {/* Printable Sheet (Simulated A4 Paper) */}
          <div 
            id="printable-document" 
            className="w-full max-w-[800px] bg-white text-slate-900 rounded-xl p-6 sm:p-10 shadow-2xl border border-slate-200 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
          >

            {/* 1. OFFICIAL INVOICE */}
            {docType === 'invoice' && currentDelivery && (
              <div className="space-y-6">
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                        JW
                      </div>
                      <span className="text-xl font-black tracking-tight text-slate-900">
                        {lang === 'ar' ? 'جياوي للمؤثرات | Jiawei Effects' : 'Jiawei Effects VFX'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {lang === 'ar' 
                        ? 'المنصة الرسمية المعتمدة لمؤثرات وهدايا البث المباشر الأصلية' 
                        : 'Official Licensed Live-Stream Gift Visual Effects Platform'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Web: www.jwtexiao.com · Support: support@jwtexiao.com
                    </p>
                  </div>

                  <div className="text-right rtl:text-left">
                    <span className="inline-block px-3 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
                      {lang === 'ar' ? 'فاتورة بيع رسمية' : 'Official Tax Invoice'}
                    </span>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div><strong className="text-slate-800">{lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice No:'}</strong> <span className="font-mono">{currentDelivery.orderId}</span></div>
                      <div><strong className="text-slate-800">{lang === 'ar' ? 'التاريخ:' : 'Date:'}</strong> {currentDelivery.purchaseDate}</div>
                      <div><strong className="text-slate-800">{lang === 'ar' ? 'طريقة الدفع:' : 'Payment:'}</strong> {currentDelivery.paymentMethod || 'WeChat / Electronic'}</div>
                      <div><strong className="text-slate-800">{lang === 'ar' ? 'الحالة:' : 'Status:'}</strong> <span className="text-emerald-700 font-bold">PAID / مدفوعة</span></div>
                    </div>
                  </div>
                </div>

                {/* Bill To Info */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'بيانات المشتري / الحساب المستفيد:' : 'Billed To (Client Details):'}
                    </h4>
                    <p className="font-semibold text-slate-900 text-sm">
                      {currentDelivery.buyerName || 'مشتري معتمد (VIP Client)'}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      {currentDelivery.buyerContact || 'client@streamer.com'}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'تفاصيل الترخيص الرقمي:' : 'Digital Licensing Code:'}
                    </h4>
                    <p className="font-mono font-bold text-blue-700">
                      {currentDelivery.licenseKey}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      {currentDelivery.licenseType === 'exclusive' 
                        ? (lang === 'ar' ? 'ترخيص شراء حصري كامل (Exclusive Buyout)' : 'Exclusive Buyout License')
                        : (lang === 'ar' ? 'ترخيص تجاري عام للبث المباشر (Commercial Standard)' : 'Standard Commercial License')}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left rtl:text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">{lang === 'ar' ? 'اسم الهدية / المادة البصرية' : 'Item Description'}</th>
                        <th className="p-3">{lang === 'ar' ? 'الصيغ المرفقة' : 'Formats'}</th>
                        <th className="p-3">{lang === 'ar' ? 'نوع الترخيص' : 'License Type'}</th>
                        <th className="p-3 text-right rtl:text-left">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      <tr>
                        <td className="p-3 font-mono text-slate-500">01</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{currentDelivery.giftTitle}</div>
                          <div className="text-[11px] text-slate-500 font-mono">ID: {currentDelivery.giftId}</div>
                        </td>
                        <td className="p-3 text-slate-600">{currentDelivery.format}</td>
                        <td className="p-3 font-medium">
                          {currentDelivery.licenseType === 'exclusive' ? 'حقوق حصرية كاملة' : 'ترخيص تجاري للبث'}
                        </td>
                        <td className="p-3 text-right rtl:text-left font-mono font-bold text-slate-900">
                          $ {currentDelivery.price}.00
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Calculation Summary */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between py-1">
                      <span>{lang === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                      <span className="font-mono">$ {currentDelivery.price}.00</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>{lang === 'ar' ? 'ضريبة القيمة المضافة (0%):' : 'VAT / Tax (0%):'}</span>
                      <span className="font-mono">$ 0.00</span>
                    </div>
                    <div className="flex justify-between py-2 border-t-2 border-slate-900 font-bold text-sm text-slate-950">
                      <span>{lang === 'ar' ? 'المجموع الإجمالي المدفوع:' : 'Total Amount Paid:'}</span>
                      <span className="font-mono text-emerald-700">$ {currentDelivery.price}.00 USD</span>
                    </div>
                  </div>
                </div>

                {/* Stamp & Footer Notice */}
                <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
                  <div className="space-y-1 max-w-sm">
                    <p className="font-semibold text-slate-700">
                      {lang === 'ar' ? 'ملاحظات الضمان والملكية:' : 'License Terms:'}
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      {lang === 'ar' 
                        ? 'هذا المستند يعتبر فاتورة شراء رسمية وتأكيداً لاستلام الترخيص التجاري الرقمي. جميع الحقوق محمية بموجب قانون الملكية الفكرية.'
                        : 'This invoice serves as proof of commercial streaming authorization. All assets are guaranteed 100% original without infringement.'}
                    </p>
                  </div>

                  {/* Official Digital Seal */}
                  <div className="text-center p-2 border-2 border-dashed border-red-500 rounded-lg text-red-600 transform -rotate-2">
                    <div className="text-[10px] font-bold tracking-wider uppercase">JIAWEI VFX CO., LTD</div>
                    <div className="text-xs font-black my-0.5">★ 佳维特效 财务专用章 ★</div>
                    <div className="text-[9px] font-mono">AUTHORIZED OFFICIAL SEAL</div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. OFFICIAL LICENSE CERTIFICATE */}
            {docType === 'certificate' && currentDelivery && (
              <div className="relative border-4 border-double border-amber-600/80 p-8 rounded-xl bg-gradient-to-b from-amber-50/40 via-white to-amber-50/30 text-center space-y-6">
                {/* Decorative Corners */}
                <div className="flex justify-between items-center text-amber-700">
                  <span className="font-mono text-xs">CERTIFICATE NO: {currentDelivery.licenseKey}</span>
                  <Award className="w-8 h-8 text-amber-600 mx-auto" />
                  <span className="font-mono text-xs">SECURITY CODE: 994-A</span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 tracking-wide">
                    {lang === 'ar' ? 'شهادة ترخيص تجاري رسمي' : 'COMMERCIAL LICENSE CERTIFICATE'}
                  </h2>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-1">
                    {lang === 'ar' ? 'منصة جياوي للمؤثرات البصرية وهدايا البث المباشر' : 'Jiawei Visual Effects Digital Assets Certification'}
                  </p>
                </div>

                <div className="py-2">
                  <p className="text-xs text-slate-600 mb-2">
                    {lang === 'ar' ? 'تشهد منصة جياوي بموجب هذا المستند بأن العميل / الحساب المذكور أدناه:' : 'This certificate hereby grants official authorization to:'}
                  </p>
                  <p className="text-xl font-bold text-blue-900 font-serif border-b border-amber-300 pb-1 max-w-md mx-auto">
                    {currentDelivery.buyerName || 'المشتري المعتمد (Authorized Streamer)'}
                  </p>
                </div>

                <div className="text-xs text-slate-700 space-y-2 max-w-lg mx-auto leading-relaxed">
                  <p>
                    {lang === 'ar' ? 'قد حصل رسمياً وقانونياً على كامل حقوق الاستخدام التجاري للهدية والمؤثر البصري:' : 'Has been granted full commercial broadcasting rights for the visual asset:'}
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-amber-200 font-bold text-slate-900 text-sm shadow-sm">
                    {currentDelivery.giftTitle}
                    <span className="block text-xs font-normal text-slate-500 mt-0.5 font-mono">
                      Asset ID: {currentDelivery.giftId} · Format: {currentDelivery.format}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-4 border-y border-amber-200/80 text-xs text-slate-700">
                  <div>
                    <span className="block text-slate-500 text-[10px]">{lang === 'ar' ? 'نوع الترخيص' : 'License Type'}</span>
                    <strong className="text-amber-800 font-bold">
                      {currentDelivery.licenseType === 'exclusive' ? 'شراء حصري كامل (Buyout)' : 'ترخيص تجاري دائم (Standard)'}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px]">{lang === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                    <strong className="text-slate-800 font-mono">{currentDelivery.purchaseDate}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px]">{lang === 'ar' ? 'نطاق الاستخدام' : 'Authorized Scope'}</span>
                    <strong className="text-emerald-700 font-bold">{lang === 'ar' ? 'عالمي لجميع المنصات' : 'Global Platforms'}</strong>
                  </div>
                </div>

                {/* Certificate Bottom Signatures */}
                <div className="pt-4 flex justify-between items-center text-xs">
                  <div className="text-left rtl:text-right">
                    <p className="text-[11px] text-slate-500">{lang === 'ar' ? 'رقم التحقق الإلكتروني:' : 'Verification Hash:'}</p>
                    <p className="font-mono text-blue-700 font-bold">{currentDelivery.licenseKey}</p>
                  </div>

                  {/* Gold Badge Stamp */}
                  <div className="w-20 h-20 rounded-full border-4 border-amber-500 bg-amber-100/80 flex flex-col items-center justify-center text-amber-900 shadow-md">
                    <ShieldCheck className="w-5 h-5 text-amber-700" />
                    <span className="text-[9px] font-black uppercase mt-0.5">VERIFIED</span>
                    <span className="text-[7px]">100% ORIGINAL</span>
                  </div>

                  <div className="text-right rtl:text-left">
                    <p className="text-[11px] text-slate-500">{lang === 'ar' ? 'التوقيع والاعتماد الرسمي:' : 'Authorized Signature:'}</p>
                    <p className="font-serif font-bold text-slate-900 italic">Jiawei VFX Certification Bureau</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. DELIVERY VOUCHER / SLIP */}
            {docType === 'voucher' && currentDelivery && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {lang === 'ar' ? 'بطاقة استلام وتنزيل حزمة المؤثر' : 'Visual Effects Handover Voucher'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'ar' ? 'بيانات التحميل وكود الاستخراج لحزمة ملفات الهدية' : 'Digital package access & cloud extract codes'}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                    {currentDelivery.orderId}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={currentDelivery.posterUrl} 
                      alt={currentDelivery.giftTitle} 
                      className="w-16 h-16 rounded-lg object-cover border border-slate-300"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{currentDelivery.giftTitle}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {lang === 'ar' ? 'الصيغ المتاحة:' : 'Formats:'} {currentDelivery.format}
                      </p>
                      <p className="text-[11px] font-mono text-blue-600 mt-0.5">
                        {lang === 'ar' ? 'الحجم:' : 'Size:'} {currentDelivery.fileSize}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block mb-1">
                        {lang === 'ar' ? 'كود استخراج السحابة (Cloud Disk Code):' : 'Cloud Disk Extraction Code:'}
                      </span>
                      <div className="font-mono text-base font-black text-cyan-700 flex items-center justify-between">
                        <span>{currentDelivery.cloudDiskCode || 'JW8866'}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyLicense(currentDelivery.cloudDiskCode || 'JW8866')}
                          className="text-xs text-slate-400 hover:text-slate-700 no-print"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block mb-1">
                        {lang === 'ar' ? 'رقم كود الترخيص (License Key):' : 'License Key:'}
                      </span>
                      <div className="font-mono text-sm font-bold text-slate-800">
                        {currentDelivery.licenseKey}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                    <span className="text-[11px] text-slate-500 block mb-1">
                      {lang === 'ar' ? 'رابط التحميل المباشر للكمبيوتر / الاستوديو:' : 'Direct Download URL:'}
                    </span>
                    <p className="font-mono text-blue-700 break-all select-all text-[11px]">
                      {currentDelivery.downloadUrl}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                  <strong className="block font-bold">
                    {lang === 'ar' ? 'تعليمات الاستخدام للبث المباشر:' : 'Streaming Setup Instructions:'}
                  </strong>
                  <p className="leading-relaxed text-[11px]">
                    {lang === 'ar'
                      ? '1. قم بفك الضغط عن الملف zip. ستجد ملفات SVGA لتطبيقات البث، وفيديو MP4 مع شفافية Alpha Channel لبرامج OBS Studio و vMix. 2. احفظ هذه البطاقة كإثبات ملكية تجارية في حال طلبها من إدارة المنصة.'
                      : 'Extract the zip bundle. Import SVGA/VAP into your live stream app or MP4 with alpha transparency into OBS/vMix.'}
                  </p>
                </div>
              </div>
            )}

            {/* 4. FULL SALES & ORDERS REPORT */}
            {docType === 'report' && (
              <div className="space-y-6">
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {lang === 'ar' ? 'كشف تقرير المبيعات والطلبات الشامل' : 'Comprehensive Sales & Orders Report'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'ar' ? 'سجل الطلبات والمعاملات المسجلة في النظام' : 'Full registered orders and delivery transactions log'}
                    </p>
                  </div>

                  <div className="text-right rtl:text-left text-xs text-slate-600">
                    <div><strong>{lang === 'ar' ? 'تاريخ التقرير:' : 'Report Date:'}</strong> {new Date().toLocaleDateString()}</div>
                    <div><strong>{lang === 'ar' ? 'عدد الطلبات:' : 'Total Orders:'}</strong> {allDeliveries.length}</div>
                    <div>
                      <strong>{lang === 'ar' ? 'إجمالي المبيعات:' : 'Total Revenue:'}</strong>{' '}
                      <span className="font-mono font-bold text-emerald-700">
                        $ {allDeliveries.reduce((acc, curr) => acc + (curr.price || 0), 0).toLocaleString()} USD
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left rtl:text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">{lang === 'ar' ? 'رقم الطلب' : 'Order ID'}</th>
                        <th className="p-2.5">{lang === 'ar' ? 'العميل' : 'Customer'}</th>
                        <th className="p-2.5">{lang === 'ar' ? 'الهدية' : 'Gift Item'}</th>
                        <th className="p-2.5">{lang === 'ar' ? 'نوع الترخيص' : 'License'}</th>
                        <th className="p-2.5">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="p-2.5 text-right rtl:text-left">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {allDeliveries.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-700">{item.orderId}</td>
                          <td className="p-2.5 font-medium">{item.buyerName || 'عميل معتمد'}</td>
                          <td className="p-2.5">{item.giftTitle}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              item.licenseType === 'exclusive' 
                                ? 'bg-purple-100 text-purple-800 font-bold' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {item.licenseType === 'exclusive' ? 'حصري' : 'تجاري'}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500">{item.purchaseDate}</td>
                          <td className="p-2.5 text-right rtl:text-left font-mono font-bold text-slate-900">
                            $ {item.price}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-slate-600">
                    {lang === 'ar' ? 'تم استخراج هذا التقرير آلياً من لوحة تحكم متجر جياوي للمؤثرات.' : 'Generated automatically from Jiawei Effects Admin Dashboard.'}
                  </span>
                  <div className="font-bold text-slate-900">
                    {lang === 'ar' ? 'الإجمالي العام:' : 'Grand Total:'}{' '}
                    <span className="font-mono text-emerald-700 text-sm">
                      $ {allDeliveries.reduce((acc, curr) => acc + (curr.price || 0), 0).toLocaleString()} USD
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
