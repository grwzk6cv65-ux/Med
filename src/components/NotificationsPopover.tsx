import { Bell, BellRing, Check, CheckCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';

export function NotificationsPopover() {
  const {
    t,
    language,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveModule,
    setActivePatientId,
    accessibility,
    enableBrowserNotifications,
    disableBrowserNotifications,
  } = useMedradar();

  const [open, setOpen] = useState(false);
  const [permMessage, setPermMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const handleEnableBrowser = async () => {
    const res = await enableBrowserNotifications();
    if (res === 'granted') {
      setPermMessage(t('notif_browser_enabled'));
    } else {
      setPermMessage(t('notif_browser_denied'));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notif_title')}
        aria-expanded={open}
        className="relative h-9 px-2.5 inline-flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg text-zinc-800 transition-colors"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadNotificationCount > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums bg-emerald-600 text-white rounded-md leading-none">
            {unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            role="dialog"
            aria-label={t('notif_title')}
            className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white border border-zinc-200 rounded-xl shadow-2xl z-40 overflow-hidden"
          >
            <div className="px-4 py-3 bg-zinc-950 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <BellRing className="w-4 h-4 text-emerald-400" />
                <span>{t('notif_title')}</span>
                <span className="font-mono text-[11px] text-emerald-400">
                  ({unreadNotificationCount})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotificationCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-emerald-400"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{t('notif_mark_all')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-1 text-zinc-400 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-200">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">{t('notif_empty')}</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 text-xs space-y-1 transition-colors ${
                      n.read ? 'bg-white text-zinc-600' : 'bg-emerald-50/50 text-zinc-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.patientId) setActivePatientId(n.patientId);
                          if (n.module) setActiveModule(n.module);
                          setOpen(false);
                        }}
                        className="text-left font-semibold text-zinc-950 hover:text-emerald-700"
                      >
                        {pickLocalized(n.title, language)}
                      </button>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(n.id)}
                          aria-label="Mark read"
                          className="p-1 text-emerald-700 hover:bg-emerald-100 rounded shrink-0"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      {pickLocalized(n.message, language)}
                    </p>
                    <div className="text-[10px] font-mono text-zinc-400">{n.createdAt}</div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-zinc-600 font-medium">{t('notif_browser_label')}</span>
              {accessibility.browserNotificationsEnabled ? (
                <button
                  type="button"
                  onClick={disableBrowserNotifications}
                  className="px-2.5 py-1 font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md"
                >
                  {t('notif_browser_enabled')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableBrowser}
                  className="px-2.5 py-1 font-semibold bg-zinc-950 hover:bg-zinc-800 text-white rounded-md"
                >
                  {t('notif_browser_enable')}
                </button>
              )}
            </div>
            {permMessage && (
              <div className="px-4 py-1.5 bg-zinc-100 text-[11px] text-zinc-700 border-t border-zinc-200">
                {permMessage}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
