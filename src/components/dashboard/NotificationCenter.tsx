'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Send,
  User,
  Users,
  X,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { jalaliDateToIso } from '@/lib/jalali';

export type NotificationMetadata = {
  id: string;
  notificationId: string;
  senderName: string;
  recipientMode: 'private' | 'broadcast';
  readAt: string | null;
  created: string;
};

export type NotificationDetail = {
  id: string;
  receiptId?: string;
  title: string;
  body: string;
  senderName: string;
  recipientMode: 'private' | 'broadcast';
  readAt: string | null;
  created: string;
  decryptFailed?: boolean;
};

export type UserItem = {
  id: string;
  name: string;
  email: string;
};

export default function NotificationCenter({ userRole }: { userRole: 'user' | 'manager' | 'admin' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationMetadata[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousNotificationIds = useRef<Set<string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Selected Notification Modal
  const [activeNotification, setActiveNotification] = useState<NotificationDetail | null>(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Send Notification Form Modal (Admin / Manager)
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendForm, setSendForm] = useState({
    title: '',
    body: '',
    recipientMode: 'private' as 'private' | 'broadcast',
    recipientId: '',
    sendTiming: 'immediate' as 'immediate' | 'scheduled',
    jalaliDate: '1405/01/01',
    time: '12:00',
  });
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmBroadcast, setShowConfirmBroadcast] = useState(false);

  const canSend = userRole === 'admin' || userRole === 'manager';

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') void audioContext.resume();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.21);
    } catch {
      // Audio is an enhancement; notification delivery continues
    }
  }, [soundEnabled]);

  const unlockNotificationAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') void audioContext.resume();
    } catch {
      // Audio optional
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.status === 401) {
        // Clear state on logout/unauthorized
        setItems([]);
        setUnreadCount(0);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          const nextItems = data.items as NotificationMetadata[];
          const nextIds = new Set(nextItems.map((item) => item.id));
          const previousIds = previousNotificationIds.current;
          const hasNewUnread = previousIds
            && nextItems.some((item) => !previousIds.has(item.id) && !item.readAt);
          previousNotificationIds.current = nextIds;
          setItems(nextItems);
          setUnreadCount(Number(data.unreadCount) || 0);
          if (hasNewUnread) playNotificationSound();
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setFetchError(errData.message || 'خطا در دریافت لیست اعلانات');
      }
    } catch {
      setFetchError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, [playNotificationSound]);

  useEffect(() => {
    let active = true;
    const runFetch = async () => {
      if (active) {
        await fetchNotifications();
      }
    };
    const timer = setTimeout(() => {
      void runFetch();
    }, 0);

    const interval = setInterval(() => {
      void runFetch();
    }, 5000);

    const handleFocus = () => void runFetch();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void runFetch();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [unlockNotificationAudio]);

  // Fetch Users List for Send Modal
  const fetchUsersList = useCallback(async () => {
    if (!canSend) return;
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsersList(data.users.map((u: { id: string; name?: string; email?: string }) => ({
            id: u.id,
            name: u.name || u.email || 'کاربر',
            email: u.email || '',
          })));
        }
      }
    } catch {
      // Ignore
    }
  }, [canSend]);

  useEffect(() => {
    if (isSendModalOpen) {
      const timer = setTimeout(() => {
        void fetchUsersList();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSendModalOpen, fetchUsersList]);

  // Open notification detail & mark as read
  async function handleOpenDetail(item: NotificationMetadata) {
    setFetchingDetail(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/notifications/${item.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.notification) {
        setActiveNotification(data.notification);

        // Mark read AFTER successfully receiving and rendering message detail / decrypt failure status
        if (!item.readAt) {
          await fetch(`/api/notifications/${item.id}/read`, { method: 'PATCH' });
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        setDetailError(data.message || 'خطا در دریافت جزئیات پیام.');
      }
    } catch {
      setDetailError('خطا در برقراری ارتباط با سرور جهت دریافت پیام.');
    } finally {
      setFetchingDetail(false);
    }
  }

  // Handle Send Notification Submit
  async function handleSendNotification() {
    if (!sendForm.title.trim()) {
      setSendNotice({ type: 'error', text: 'لطفاً عنوان اعلان را وارد کنید.' });
      return;
    }
    if (!sendForm.body.trim()) {
      setSendNotice({ type: 'error', text: 'لطفاً متن اعلان را وارد کنید.' });
      return;
    }
    if (sendForm.recipientMode === 'private' && !sendForm.recipientId) {
      setSendNotice({ type: 'error', text: 'لطفاً کاربر دریافت‌کننده را انتخاب کنید.' });
      return;
    }

    if (sendForm.recipientMode === 'broadcast' && !showConfirmBroadcast) {
      setShowConfirmBroadcast(true);
      return;
    }

    let scheduledAtIso: string | null = null;
    if (sendForm.sendTiming === 'scheduled') {
      const isoDate = jalaliDateToIso(sendForm.jalaliDate);
      if (!isoDate) {
        setSendNotice({ type: 'error', text: 'تاریخ زمان‌بندی جلالی نامعتبر است.' });
        return;
      }
      const [hours, minutes] = sendForm.time.split(':').map(Number);
      const dt = new Date(isoDate);
      dt.setUTCHours(hours || 12, minutes || 0, 0, 0);
      scheduledAtIso = dt.toISOString();
    }

    setIsSending(true);
    setSendNotice(null);

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sendForm.title,
          body: sendForm.body,
          recipientMode: sendForm.recipientMode,
          recipientId: sendForm.recipientId,
          scheduledAt: scheduledAtIso,
        }),
      });

      const data = await res.json();
      setIsSending(false);

      if (!res.ok) {
        setSendNotice({ type: 'error', text: data.message || 'خطا در ارسال اعلان' });
        return;
      }

      setSendNotice({
        type: 'success',
        text: scheduledAtIso
          ? 'اعلان زمان‌بندی‌شده با موفقیت ثبت شد.'
          : `اعلان با موفقیت به ${data.recipientCount} کاربر ارسال شد.`,
      });

      setSendForm({
        title: '',
        body: '',
        recipientMode: 'private',
        recipientId: '',
        sendTiming: 'immediate',
        jalaliDate: '1405/01/01',
        time: '12:00',
      });
      setShowConfirmBroadcast(false);
      void fetchNotifications();
      setTimeout(() => {
        setIsSendModalOpen(false);
        setSendNotice(null);
      }, 1500);
    } catch (err) {
      setIsSending(false);
      setSendNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور',
      });
    }
  }

  const toFaDigits = (num: number) => num.toLocaleString('fa-IR');

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            unlockNotificationAudio();
            void fetchNotifications();
          }
        }}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="اعلانات"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white font-black text-[10px] shadow-sm animate-pulse">
            {toFaDigits(unreadCount)}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">اعلانات</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {toFaDigits(unreadCount)} خوانده‌نشده
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canSend && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsSendModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <Send size={12} />
                  ارسال اعلان
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSoundEnabled((enabled) => !enabled);
                  if (!soundEnabled) playNotificationSound();
                }}
                className="text-slate-400 hover:text-amber-500 transition-colors"
                aria-label={soundEnabled ? 'خاموش کردن صدای اعلان' : 'روشن کردن صدای اعلان'}
                title={soundEnabled ? 'صدای اعلان روشن است' : 'صدای اعلان خاموش است'}
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {fetchError && (
              <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{fetchError}</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
                <Loader2 className="animate-spin" size={16} />
                <span>در حال دریافت اعلانات...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                هیچ اعلانی یافت نشد.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    void handleOpenDetail(item);
                  }}
                  className={`w-full p-3 text-right flex items-start gap-3 transition-colors ${
                    !item.readAt
                      ? 'bg-amber-500/5 hover:bg-amber-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${
                    item.recipientMode === 'broadcast'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {item.recipientMode === 'broadcast' ? <Users size={16} /> : <User size={16} />}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <strong className="text-slate-800 dark:text-slate-200 font-bold truncate">
                        {item.senderName}
                      </strong>
                      <small className="text-[10px] text-slate-400">
                        {item.created ? new Date(item.created).toLocaleDateString('fa-IR') : ''}
                      </small>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      جهت مشاهده متن کامل، کلیک کنید (رمزنگاری AES-256)
                    </p>
                  </div>

                  {!item.readAt && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 self-center" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Notification Detail Modal - Centered */}
      {(activeNotification || fetchingDetail || detailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm m-auto" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 my-auto">
            {fetchingDetail ? (
              <div className="flex flex-col items-center justify-center p-8 gap-3 text-xs text-slate-500">
                <Loader2 className="animate-spin text-amber-500" size={24} />
                <span>در حال رمزگشایی امن پیام (AES-256-GCM)...</span>
              </div>
            ) : detailError ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <AlertCircle size={16} />
                    <span>خطا در دریافت پیام</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailError(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300">
                  {detailError}
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailError(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs"
                  >
                    بستن
                  </button>
                </div>
              </div>
            ) : activeNotification ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {activeNotification.decryptFailed ? (
                      <ShieldAlert size={16} className="text-amber-500" />
                    ) : (
                      <ShieldCheck size={16} className="text-emerald-500" />
                    )}
                    <span>
                      {activeNotification.decryptFailed
                        ? 'خطای رمزگشایی پیام'
                        : 'پیام رمزنگاری‌شده (GCM)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNotification(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                    {activeNotification.title}
                  </h3>

                  {activeNotification.decryptFailed ? (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
                      <strong className="block font-bold">این پیام قابل بازیابی نیست.</strong>
                      <p className="text-[11px] leading-relaxed">
                        به دلیل عدم تطابق کلید رمزنگاری یا آسیب‌دیدگی داده‌ها، متن اصلی این پیام قابل بازیابی نمی‌باشد.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                      {activeNotification.body}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>فرستنده: {activeNotification.senderName}</span>
                    <span>{activeNotification.created ? new Date(activeNotification.created).toLocaleString('fa-IR') : ''}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveNotification(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs"
                  >
                    بستن
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Send Notification Modal (Admin/Manager) - Centered */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm m-auto" dir="rtl">
          <div className="notification-send-modal w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Send size={18} className="text-amber-500" />
                ارسال اعلان جدید (رمزنگاری‌‌شده)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsSendModalOpen(false);
                  setShowConfirmBroadcast(false);
                  setSendNotice(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {sendNotice && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  sendNotice.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                {sendNotice.type === 'success' ? <CheckCheck size={16} /> : <AlertCircle size={16} />}
                <span>{sendNotice.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">عنوان اعلان</span>
                <input
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="مثال: به‌روزرسانی سیستم"
                  maxLength={200}
                />
              </label>

              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">نوع ارسال</span>
                <select
                  value={sendForm.recipientMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'private' | 'broadcast';
                    setSendForm((prev) => ({ ...prev, recipientMode: mode }));
                    setShowConfirmBroadcast(false);
                  }}
                >
                  <option value="private">پیام خصوصی (تک‌کاربر)</option>
                  <option value="broadcast">همگانی (Broadcast به همه کاربران)</option>
                </select>
              </label>

              {sendForm.recipientMode === 'private' && (
                <label className="account-field">
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-300">گیرنده</span>
                  <select
                    value={sendForm.recipientId}
                    onChange={(e) => setSendForm((prev) => ({ ...prev, recipientId: e.target.value }))}
                  >
                    <option value="">انتخاب کاربر...</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Scheduled sending options */}
              <div className="space-y-2 border-t border-b border-slate-100 dark:border-slate-800 py-3">
                <label className="account-field">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Clock size={14} className="text-amber-500" />
                    زمان‌بندی ارسال
                  </span>
                  <select
                    value={sendForm.sendTiming}
                    onChange={(e) =>
                      setSendForm((prev) => ({
                        ...prev,
                        sendTiming: e.target.value as 'immediate' | 'scheduled',
                      }))}
                  >
                    <option value="immediate">ارسال فوری (هم‌اکنون)</option>
                    <option value="scheduled">ارسال زمان‌بندی‌شده (تاریخ/ساعت آینده)</option>
                  </select>
                </label>

                {sendForm.sendTiming === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="account-field">
                      <span className="text-[11px] text-slate-500">تاریخ جلالی (مثال: ۱۴۰۵/۰۱/۰۱)</span>
                      <input
                        type="text"
                        value={sendForm.jalaliDate}
                        onChange={(e) => setSendForm((prev) => ({ ...prev, jalaliDate: e.target.value }))}
                        placeholder="۱۴۰۵/۰۱/۰۱"
                      />
                    </label>

                    <label className="account-field">
                      <span className="text-[11px] text-slate-500">ساعت ارسال</span>
                      <input
                        type="time"
                        value={sendForm.time}
                        onChange={(e) => setSendForm((prev) => ({ ...prev, time: e.target.value }))}
                      />
                    </label>
                  </div>
                )}
              </div>

              {sendForm.recipientMode === 'broadcast' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  این پیام به‌صورت رمزنگاری‌شده برای تمامی کاربران فعال سیستم ارسال خواهد شد.
                </div>
              )}

              <label className="account-field">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">متن اعلان</span>
                <textarea
                  value={sendForm.body}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={4}
                  placeholder="متن اعلان را وارد کنید..."
                  maxLength={4000}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </label>

              {showConfirmBroadcast && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                  <strong className="block">تأیید ارسال همگانی:</strong>
                  <p>آیا از ارسال این اعلان همگانی اطمینان دارید؟</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsSendModalOpen(false);
                  setShowConfirmBroadcast(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleSendNotification}
                disabled={isSending}
                className="customer-save-button"
              >
                {isSending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                <span>
                  {showConfirmBroadcast
                    ? 'بله، ارسال همگانی کن'
                    : isSending
                      ? 'در حال ارسال...'
                      : 'ارسال اعلان'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
