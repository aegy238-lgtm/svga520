const fs = require('fs');
const content = fs.readFileSync('src/components/Workspace.tsx', 'utf8');

const regex = /const handleAudioUpload = async \([^)]+\) => \{[\s\S]*?e\.target\.value = "";\n  \};/;
const replacement = `const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      alert("تعذر العثور على الملف الصوتي المحدد. يرجى إعادة اختيار الملف.");
      return;
    }

    const validation = await validateMp3File(file);
    
    if (!validation.isValid) {
      alert(validation.message);
      e.target.value = "";
      return;
    }

    const audioDuration = (validation as any).duration || 0;
    const animationDuration = metadata.frames / (metadata.fps || 30);

    if (audioDuration > animationDuration + 0.5) {
      alert(
        \`تنبيه: مدة الملف الصوتي (\${audioDuration.toFixed(1)} ثانية) أطول من مدة الأنيميشن (\${animationDuration.toFixed(1)} ثانية). قد يؤدي ذلك إلى قطع الصوت في المنصات الرسمية.\`
      );
    }

    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    e.target.value = "";
  };`;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/components/Workspace.tsx', newContent);
