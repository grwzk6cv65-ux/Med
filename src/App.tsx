import {
  Accessibility,
  BarChart3,
  Database,
  FileBadge2,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Map as MapIcon,
  Menu,
  Phone,
  Radar,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Truck,
  User,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AccessibilitySettingsModal } from './components/AccessibilitySettingsModal';
import { AiAssistantWidget } from './components/AiAssistantWidget';
import { AiHealthRadarView } from './components/AiHealthRadarView';
import { AnalyticsView } from './components/AnalyticsView';
import { CareLoopJourneyView } from './components/CareLoopJourneyView';
import { DashboardView } from './components/DashboardView';
import { MedMobileView } from './components/MedMobileView';
import { NanoCharacter } from './components/NanoCharacter';
import { NanoOnboardingModal } from './components/NanoOnboardingModal';
import { NotificationsPopover } from './components/NotificationsPopover';
import { PassportReferralsView } from './components/PassportReferralsView';
import { PhoneAuthModal } from './components/PhoneAuthModal';
import { ProfileView } from './components/ProfileView';
import { RapidLabView } from './components/RapidLabView';
import { RegionalMapView } from './components/RegionalMapView';
import { SupportRequestsView } from './components/SupportRequestsView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MedradarProvider, useMedradar } from './context/MedradarContext';
import { Language, ModuleId } from './types/medradar';

const NAV_ITEMS: { id: ModuleId; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
  { id: 'map', labelKey: 'nav_map', icon: MapIcon },
  { id: 'rapid_lab', labelKey: 'nav_rapid_lab', icon: FlaskConical },
  { id: 'ai_radar', labelKey: 'nav_ai_radar', icon: Radar },
  { id: 'medmobile', labelKey: 'nav_medmobile', icon: Truck },
  { id: 'passport_referrals', labelKey: 'nav_passport_referrals', icon: FileBadge2 },
  { id: 'care_loop', labelKey: 'nav_care_loop', icon: RefreshCcw },
  { id: 'analytics', labelKey: 'nav_analytics', icon: BarChart3 },
  { id: 'support', labelKey: 'nav_support', icon: LifeBuoy },
  { id: 'profile', labelKey: 'nav_profile', icon: User },
];

function useNanoOnboarding() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showNanoWelcome, setShowNanoWelcome] = useState(false);

  useEffect(() => {
    try {
      const completed = localStorage.getItem('onboardingCompleted');
      if (completed !== 'true') {
        setShowNanoWelcome(true);
        setOnboardingStep(0);
        setIsOnboardingOpen(true);
      }
    } catch {
      setShowNanoWelcome(true);
      setOnboardingStep(0);
      setIsOnboardingOpen(true);
    }
  }, []);

  const completeOnboarding = () => {
    try {
      localStorage.setItem('onboardingCompleted', 'true');
    } catch {
      // Ignore storage errors in restricted environments
    }
    setIsOnboardingOpen(false);
    setShowNanoWelcome(false);
  };

  const replayOnboarding = () => {
    setOnboardingStep(0);
    setShowNanoWelcome(true);
    setIsOnboardingOpen(true);
  };

  const minimizeOnboardingForPreview = () => {
    setIsOnboardingOpen(false);
    setShowNanoWelcome(true);
  };

  return {
    isOnboardingOpen,
    onboardingStep,
    showNanoWelcome,
    setOnboardingStep,
    completeOnboarding,
    replayOnboarding,
    minimizeOnboardingForPreview,
  };
}

function MedradarShell() {
  const {
    t,
    language,
    setLanguage,
    role,
    setRole,
    activeModule,
    setActiveModule,
    resetDemoData,
    isOfflineActive,
    pendingSync,
    syncNow,
    highlightedTourTarget,
    setHighlightedTourTarget,
  } = useMedradar();
  const { user, openAuthModal, logout } = useAuth();

  const {
    isOnboardingOpen,
    onboardingStep,
    showNanoWelcome,
    setOnboardingStep,
    completeOnboarding,
    replayOnboarding,
    minimizeOnboardingForPreview,
  } = useNanoOnboarding();

  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const handlePreviewTourModule = (mod: ModuleId, tourTarget: string) => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    setActiveModule(mod);
    minimizeOnboardingForPreview();
    setHighlightedTourTarget(tourTarget);
    if (tourTarget === 'nano') {
      window.dispatchEvent(new CustomEvent('medradar:open-nano'));
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedTourTarget(null);
      highlightTimerRef.current = null;
    }, 4500);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetToast, setResetToast] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeModule) ?? NAV_ITEMS[0];

  const handleReset = () => {
    resetDemoData();
    setResetToast(true);
    setTimeout(() => setResetToast(false), 2500);
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardView />;
      case 'map':
        return <RegionalMapView />;
      case 'rapid_lab':
        return <RapidLabView />;
      case 'ai_radar':
        return <AiHealthRadarView />;
      case 'medmobile':
        return <MedMobileView />;
      case 'passport_referrals':
        return <PassportReferralsView />;
      case 'care_loop':
        return <CareLoopJourneyView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'support':
        return <SupportRequestsView />;
      case 'profile':
        return <ProfileView />;
    }
  };

  // Matte Black Sidebar with Crisp Emerald Green Accents
  const SidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 bg-zinc-950 text-zinc-100 border-r border-zinc-800">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setActiveModule('dashboard');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-emerald-400 shrink-0"
            >
              <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
              <path d="M12 12L17.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="1.75" fill="currentColor" />
            </svg>
            <span className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
              {t('brand')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            const highlighted = highlightedTourTarget === `nav-${item.id}`;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveModule(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                } ${highlighted ? 'tour-highlight-ring' : ''}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-zinc-950' : 'text-zinc-400'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-zinc-800 space-y-2.5">
        <p className="text-[11px] leading-relaxed text-zinc-400 px-1">{t('demo_notice')}</p>
        {resetToast && (
          <div className="px-2.5 py-1.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg">
            {t('reset_confirm')}
          </div>
        )}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              replayOnboarding();
              setMobileMenuOpen(false);
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('nano_replay_btn')}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>{t('reset_demo')}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-zinc-950">
      {/* Desktop Matte Black Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 sticky top-0 h-screen overflow-y-auto">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-zinc-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-xs h-full z-10 overflow-y-auto">{SidebarContent}</div>
        </div>
      )}

      {/* Crisp White Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Crisp White Top Bar */}
        <header className="sticky top-0 z-30 min-h-14 py-1.5 bg-white/95 backdrop-blur-xs border-b border-zinc-200 px-4 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-zinc-700 hover:text-zinc-950 rounded-lg"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs text-zinc-500 whitespace-nowrap truncate">
              <span className="font-bold text-zinc-950">{t('brand')}</span>
              <span aria-hidden="true">/</span>
              <span className="text-emerald-700 font-semibold truncate">{t(activeNav.labelKey)}</span>
            </div>

            {/* Clear DEMO DATA Label */}
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wide bg-zinc-950 text-emerald-400 rounded-md whitespace-nowrap">
              <Database className="w-3 h-3" aria-hidden="true" />
              <span>{t('demo_badge')}</span>
            </span>

            {/* Offline / Online Status Indicator */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors whitespace-nowrap ${
                isOfflineActive
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {isOfflineActive ? (
                <WifiOff className="w-3 h-3" aria-hidden="true" />
              ) : (
                <Wifi className="w-3 h-3" aria-hidden="true" />
              )}
              <span>{isOfflineActive ? t('offline_mode_label') : t('online_mode_label')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 3-Language Switcher (Kazakh, Russian, English) */}
            <div
              className="inline-flex items-center p-0.5 bg-zinc-100 rounded-lg border border-zinc-200"
              role="group"
              aria-label="Language"
            >
              {(
                [
                  { code: 'kk', label: 'ҚАЗ' },
                  { code: 'ru', label: 'РУС' },
                  { code: 'en', label: 'ENG' },
                ] as { code: Language; label: string }[]
              ).map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    language === lang.code
                      ? 'bg-zinc-950 text-white'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Role Switcher */}
            <div className="hidden sm:inline-flex items-center p-0.5 bg-zinc-100 rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setRole('doctor');
                  setActiveModule('dashboard');
                }}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  role === 'doctor'
                    ? 'bg-white text-zinc-950 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {t('role_doctor')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('patient');
                  setActiveModule('dashboard');
                }}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  role === 'patient'
                    ? 'bg-white text-zinc-950 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {t('role_patient')}
              </button>
            </div>

            {/* In-App & Browser Notifications Popover */}
            <NotificationsPopover />

            {/* Accessibility & Settings Button */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settings_title')}
              className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Accessibility className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span className="hidden md:inline">{t('settings_btn')}</span>
            </button>

            {/* Account Profile / Sign In & Register / Logout */}
            {user ? (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveModule('profile')}
                  className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-semibold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {user.firstName || user.lastName
                      ? `${user.firstName} ${user.lastName}`.trim()
                      : user.fullName || user.phoneE164}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  aria-label={t('auth_logout')}
                  title={t('auth_logout')}
                  className="h-9 w-9 inline-flex items-center justify-center bg-zinc-100 hover:bg-red-50 hover:text-red-700 border border-zinc-200 text-zinc-700 rounded-lg transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>{t('auth_btn_signin')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <User className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('auth_btn_register')}</span>
                </button>
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => setActiveModule('rapid_lab')}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('quick_rapid_lab')}</span>
            </button>
          </div>
        </header>

        {/* Mobile Role & Demo Status Strip */}
        <div className="sm:hidden px-4 py-2 bg-white border-b border-zinc-200 flex items-center justify-between gap-2">
          <div className="inline-flex items-center p-0.5 bg-zinc-100 rounded-lg border border-zinc-200">
            <button
              type="button"
              onClick={() => {
                setRole('doctor');
                setActiveModule('dashboard');
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                role === 'doctor' ? 'bg-zinc-950 text-white' : 'text-zinc-600'
              }`}
            >
              {t('role_doctor')}
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('patient');
                setActiveModule('dashboard');
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                role === 'patient' ? 'bg-zinc-950 text-white' : 'text-zinc-600'
              }`}
            >
              {t('role_patient')}
            </button>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-zinc-950 text-emerald-400 rounded-md">
            {t('demo_badge')}
          </span>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-24 space-y-5">
          {/* Offline / Pending Sync Banner */}
          {isOfflineActive && (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span className="font-semibold">{t('offline_mode_label')}</span>
                <span className="text-amber-800">
                  · {t('demo_badge')} · {t('pending_sync_label')}:{' '}
                  <strong className="font-mono">{pendingSync.length}</strong>
                </span>
              </div>
              {pendingSync.length > 0 && (
                <button
                  type="button"
                  onClick={syncNow}
                  className="px-3 py-1 font-semibold bg-zinc-950 text-emerald-400 rounded-md"
                >
                  {t('sync_now_btn')}
                </button>
              )}
            </div>
          )}

          {/* NANO Welcome Strip when dismissed or minimized */}
          {showNanoWelcome && !isOnboardingOpen && (
            <div className="bg-zinc-950 text-white border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <NanoCharacter size={32} mood="happy" animate />
                <div className="text-xs text-zinc-200 truncate">
                  <span className="font-semibold text-emerald-400 mr-1.5">NANO:</span>
                  {t('nano_welcome_title')}
                </div>
              </div>
              <button
                type="button"
                onClick={replayOnboarding}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg whitespace-nowrap shrink-0"
              >
                {t('nano_start_tour')}
              </button>
            </div>
          )}

          {renderModule()}
        </main>
      </div>

      {/* NANO Interactive Tutorial */}
      <NanoOnboardingModal
        isOpen={isOnboardingOpen}
        step={onboardingStep}
        onStepChange={setOnboardingStep}
        onComplete={completeOnboarding}
        onPreviewModule={handlePreviewTourModule}
      />

      {/* Accessibility & Settings Modal */}
      <AccessibilitySettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRestartTutorial={replayOnboarding}
      />

      {/* Phone Registration & Login Modal */}
      <PhoneAuthModal />

      {/* Corner NANO Character Floating Widget */}
      <AiAssistantWidget />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MedradarProvider>
        <MedradarShell />
      </MedradarProvider>
    </AuthProvider>
  );
}
