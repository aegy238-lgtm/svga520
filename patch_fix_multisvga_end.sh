#!/bin/bash
sed -i '1312a\
    </div>\
  );\
};\
\
const InfoItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (\
  <div className="text-center sm:text-right">\
    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>\
    <p className="text-lg text-white font-black">{value}</p>\
  </div>\
);\
' src/components/MultiSvgaViewer.tsx
