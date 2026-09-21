import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface FooterProps {
  lang: Language;
  onOpenSupport: () => void;
  onOpenTool: (name: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang,
  onOpenSupport,
  onOpenTool
}) => {
  const t = translations[lang];

  return (
    <footer className="w-full bg-[#080b11] border-t border-slate-800/80 text-xs text-slate-400 py-8 px-4 lg:px-8 mt-12">
      <div className="max-w-[1720px] mx-auto space-y-5">
        {/* Links bar - exact clone of the video footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
            <span className="text-white font-semibold">佳维特效</span>
            <span className="hover:text-cyan-400 cursor-pointer">首页</span>
            <span className="hover:text-cyan-400 cursor-pointer">直播礼物特效</span>
            <span onClick={() => onOpenTool('礼物性能助手')} className="hover:text-cyan-400 cursor-pointer">礼物性能助手</span>
            <span onClick={() => onOpenTool('动画制作工具')} className="hover:text-cyan-400 cursor-pointer">动画制作工具</span>
            <span onClick={() => onOpenTool('测试文件下载')} className="hover:text-cyan-400 cursor-pointer">测试文件下载</span>
            <span onClick={onOpenSupport} className="hover:text-cyan-400 cursor-pointer">帮助文档</span>
            <span onClick={onOpenSupport} className="hover:text-cyan-400 cursor-pointer">关于我们</span>
            <span onClick={onOpenSupport} className="hover:text-cyan-400 cursor-pointer">意见反馈</span>
            <span onClick={onOpenSupport} className="hover:text-cyan-400 cursor-pointer text-cyan-400">联系客服</span>
            <span className="hover:text-cyan-400 cursor-pointer">用户隐私协议</span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            浏览方式: 分类浏览 | <strong className="text-cyan-400">共计 57131 礼品特效，本月上新 2547</strong>
          </div>
        </div>

        {/* Copyright & Disclaimer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span>© 2026 佳维特效 JIAWEI EFFECTS. 版权所有·正版商用授权保障平台.</span>
          </div>

          <div className="flex items-center gap-2">
            <span>粤ICP备202409886号-1</span>
            <span>·</span>
            <span>增值电信业务经营许可证</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
