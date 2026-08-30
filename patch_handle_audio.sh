#!/bin/bash
cat << 'INNER_EOF' > src/utils/validateMp3.ts
export const validateMp3File = async (file: File): Promise<{ isValid: boolean; message?: string }> => {
  if (!file) return { isValid: false, message: "تعذر العثور على الملف الصوتي." };

  const validExtensions = ["audio/mpeg", "audio/mp3"];
  const validExtensionsFallback = /\.mp3$/i;
  const isSupported =
    validExtensions.includes(file.type) || validExtensionsFallback.test(file.name);

  if (!isSupported) {
    return {
      isValid: false,
      message: "المنصات الرسمية لـ SVGA تدعم صيغة MP3 فقط. يرجى استخدام ملف بصيغة MP3 لتجنب مشاكل التشغيل.",
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Check if file is too small to be an MP3
    if (bytes.length < 100) {
      return { isValid: false, message: "حجم الملف الصوتي صغير جداً، تأكد من أنه ليس تالفاً." };
    }

    let isValidMp3 = false;
    
    // Look for ID3 tag (ID3)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      isValidMp3 = true;
    } else {
      // Look for MPEG frame sync (11 bits set to 1) in the first 4096 bytes
      const searchLimit = Math.min(bytes.length, 4096);
      for (let i = 0; i < searchLimit - 1; i++) {
        if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
          isValidMp3 = true;
          break;
        }
      }
    }

    if (!isValidMp3) {
      return {
        isValid: false,
        message: "الملف الصوتي لا يحتوي على ترويسة (Header) MP3 صالحة. يرجى التأكد من أن الملف بصيغة MP3 حقيقية (MPEG Audio) وليس مجرد تغيير في اسم الملف.",
      };
    }

    // Attempt to decode with Web Audio API to ensure it's playable
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedData = await audioContext.decodeAudioData(arrayBuffer);
      if (decodedData.duration === 0) {
         return { isValid: false, message: "الملف الصوتي فارغ أو لا يحتوي على بيانات مسموعة." };
      }
      return { isValid: true, duration: decodedData.duration };
    } catch (decodeErr) {
       return { isValid: false, message: "فشل المتصفح في فك تشفير الملف الصوتي. الملف قد يكون تالفاً أو بتشفير غير مدعوم." };
    }
  } catch (err) {
    return { isValid: false, message: "حدث خطأ غير متوقع أثناء قراءة الملف الصوتي." };
  }
};
INNER_EOF
