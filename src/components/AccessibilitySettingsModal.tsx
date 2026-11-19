import {
  Accessibility,
  BellRing,
  Contrast,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Type,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useMedradar } from '../context/MedradarContext';
import { TextSizeSetting } from '../types/medradar';

interface AccessibilitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartTutorial: () => void;
}

export function AccessibilitySettingsModal({
  isOpen,
  onClose,
  onRestartTutorial,
}: AccessibilitySettingsModalProps) {
  const {
    t,
    accessibility,
    updateAccessibility,
    isOfflineActive,
    pendingSync,
    lastSyncedAt,
    syncNow,
    enableBrowserNotifications,
    disableBrowserNotifications,
  } = useMedradar();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Accessibility className="w-5 h-5 text-emerald-400" />
            <h2 id="settings-modal-title" className="text-sm font-bold tracking-tight">
              {t('settings_title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto text-xs">
          {/* Adjustable Text Size */}
          <div className="space-y-2">
            <div className="font-semibold text-zinc-950 flex items-center gap-2">
              <Type className="w-4 h-4 text-emerald-600" />
              <span>{t('settings_text_size')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'normal', label: t('settings_size_normal') },
                  { id: 'large', label: t('settings_size_large') },
                  { id: 'xlarge', label: t('settings_size_xlarge') },
                ] as { id: TextSizeSetting; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateAccessibility({ textSize: opt.id })}
                  className={`py-2.5 px-3 font-semibold rounded-lg border transition-colors ${
                    accessibility.textSize === opt.id
                      ? 'bg-zinc-950 text-emerald-400 border-zinc-950'
                      : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* High-Contrast Toggle */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex items-center gap-2.5">
              <Contrast className="w-4 h-4 text-zinc-900 shrink-0" />
              <span className="font-semibold text-zinc-950">{t('settings_high_contrast')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={accessibility.highContrast}
              onClick={() => updateAccessibility({ highContrast: !accessibility.highContrast })}
              className={`px-3.5 py-1.5 font-semibold rounded-lg border transition-colors ${
                accessibility.highContrast
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white text-zinc-700 border-zinc-300'
              }`}
            >
              {accessibility.highContrast ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Offline Demo Mode + Sync */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {isOfflineActive ? (
                  <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span className="font-semibold text-zinc-950">{t('settings_offline_demo')}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={accessibility.offlineDemoMode}
                onClick={() =>
                  updateAccessibility({ offlineDemoMode: !accessibility.offlineDemoMode })
                }
                className={`px-3.5 py-1.5 font-semibold rounded-lg border transition-colors ${
                  accessibility.offlineDemoMode
                    ? 'bg-zinc-950 text-emerald-400 border-zinc-950'
                    : 'bg-white text-zinc-700 border-zinc-300'
                }`}
              >
                {accessibility.offlineDemoMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200 text-[11px] text-zinc-600">
              <span>
                {t('pending_sync_label')}:{' '}
                <strong className="font-mono text-zinc-950">{pendingSync.length}</strong> ·{' '}
                {t('last_synced_label')}: <span className="font-mono">{lastSyncedAt}</span>
              </span>
              <button
                type="button"
                onClick={syncNow}
                className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t('sync_now_btn')}</span>
              </button>
            </div>
          </div>

          {/* Browser Notifications Consent */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-zinc-950">{t('notif_browser_label')}</span>
            </div>
            {accessibility.browserNotificationsEnabled ? (
              <button
                type="button"
                onClick={disableBrowserNotifications}
                className="px-3 py-1.5 font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg"
              >
                {t('notif_browser_enabled')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => enableBrowserNotifications()}
                className="px-3 py-1.5 font-semibold bg-zinc-950 text-white rounded-lg"
              >
                {t('notif_browser_enable')}
              </button>
            )}
          </div>

          {/* Restart NANO Onboarding */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onRestartTutorial();
            }}
            className="w-full py-2.5 px-4 inline-flex items-center justify-center gap-2 font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('settings_restart_tour')}</span>
          </button>

          {/* Privacy, Demo Distinction & Backend Scope */}
          <div className="p-3.5 bg-zinc-950 text-zinc-200 rounded-xl space-y-2">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>{t('settings_privacy_title')}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-300">
              {t('settings_privacy_note')}
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-400 border-t border-zinc-800 pt-2">
              {t('settings_backend_note')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
