'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  X,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  Zap,
  Calendar,
  Tag,
  ChevronLeft,
} from 'lucide-react';
import { CHANGELOG_RELEASES, type ChangelogItem, type ChangelogRelease } from '../data/changelog';
import { APP_VERSION_FA } from '@/lib/version';

export function openChangelogModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-zar-changelog'));
  }
}

type ChangelogModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function ChangelogModal({ isOpen: controlledIsOpen, onClose }: ChangelogModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>(CHANGELOG_RELEASES[0]?.version || '0.0.3-beta');

  const isModalOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  useEffect(() => {
    const handleOpenEvent = () => {
      setInternalIsOpen(true);
    };

    window.addEventListener('open-zar-changelog', handleOpenEvent);
    return () => {
      window.removeEventListener('open-zar-changelog', handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const activeRelease = CHANGELOG_RELEASES.find((r) => r.version === selectedVersion) || CHANGELOG_RELEASES[0];

  const getChangeIcon = (type: ChangelogItem['type']) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'fix':
        return <Wrench className="w-4 h-4 text-sky-500" />;
      case 'security':
        return <ShieldCheck className="w-4 h-4 text-purple-500" />;
      case 'improvement':
      default:
        return <Zap className="w-4 h-4 text-amber-500" />;
    }
  };

  const getChangeTypeLabel = (type: ChangelogItem['type']) => {
    switch (type) {
      case 'feature':
        return { label: 'امکان جدید', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'fix':
        return { label: 'رفع باگ', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' };
      case 'security':
        return { label: 'امنیت', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'improvement':
      default:
        return { label: 'بهبود', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    }
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
            className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      یادداشت‌های انتشار و تغییرات
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      نسخه فعال: {APP_VERSION_FA}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    مرور تاریخچه و جزییات به‌روزرسانی‌های نرم‌افزار حسابداری زر
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="بستن (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Version Selection Tabs */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none bg-white dark:bg-slate-900">
              {CHANGELOG_RELEASES.map((rel) => {
                const isSelected = rel.version === selectedVersion;
                return (
                  <button
                    key={rel.version}
                    type="button"
                    onClick={() => setSelectedVersion(rel.version)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{rel.versionFa}</span>
                    {rel.isCurrent && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-black ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                        جدید
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
              {/* Release Summary Card */}
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {activeRelease.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{activeRelease.dateFa}</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeRelease.summary}
                </p>
              </div>

              {/* Changes List */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span>تغییرات و قابلیت‌های این نسخه:</span>
                </div>

                <div className="space-y-3">
                  {activeRelease.changes.map((change, idx) => {
                    const badgeInfo = getChangeTypeLabel(change.type);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 transition-colors shadow-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {getChangeIcon(change.type)}
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-black ${badgeInfo.color}`}>
                                {badgeInfo.label}
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                {change.title}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {change.description}
                            </p>
                            {change.badges && change.badges.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {change.badges.map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium"
                                  >
                                    #{b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                سامانه هوشمند طلا، سکه و حسابداری زر (Zarfolio)
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
