import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Map as MapIcon,
  MessageSquareHeart,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { Language, ModuleId } from '../types/medradar';
import { NanoCharacter } from './NanoCharacter';

interface NanoOnboardingModalProps {
  isOpen: boolean;
  step: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

const TOTAL_STEPS = 6;

const WALKTHROUGH_STEPS: {
  titleKey: string;
  descKey: string;
  module: ModuleId;
  tourTarget: string;
  icon: typeof MapIcon;
}[] = [
  {
    titleKey: 'nano_step1_title',
    descKey: 'nano_step1_desc',
    module: 'passport_referrals',
    tourTarget: 'nav-passport_referrals',
    icon: CalendarCheck,
  },
  {
    titleKey: 'nano_step2_title',
    descKey: 'nano_step2_desc',
    module: 'rapid_lab',
    tourTarget: 'nav-rapid_lab',
    icon: FlaskConical,
  },
  {
    titleKey: 'nano_step3_title',
    descKey: 'nano_step3_desc',
    module: 'map',
    tourTarget: 'nav-map',
    icon: MapIcon,
  },
  {
    titleKey: 'nano_step4_title',
    descKey: 'nano_step4_desc',
    module: 'care_loop',
    tourTarget: 'nav-care_loop',
    icon: Bell,
  },
  {
    titleKey: 'nano_step5_title',
    descKey: 'nano_step5_desc',
    module: 'dashboard',
    tourTarget: 'nano',
    icon: MessageSquareHeart,
  },
];

export function NanoOnboardingModal({
  isOpen,
  step,
  onStepChange,
  onComplete,
}: NanoOnboardingModalProps) {
  const { t, language, setLanguage, role, setRole, setActiveModule, setHighlightedTourTarget } =
    useMedradar();

  useEffect(() => {
    if (!isOpen) {
      setHighlightedTourTarget(null);
      return;
    }
    if (step === 0) {
      setHighlightedTourTarget('nav-dashboard');
    } else {
      const target = WALKTHROUGH_STEPS[step - 1]?.tourTarget ?? null;
      setHighlightedTourTarget(target);
    }
    return () => setHighlightedTourTarget(null);
  }, [isOpen, step, setHighlightedTourTarget]);

  if (!isOpen) return null;

  const currentWalkthrough = step > 0 ? WALKTHROUGH_STEPS[step - 1] : null;
  const StepIcon = currentWalkthrough?.icon ?? CalendarCheck;

  const goToStep = (nextStep: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, nextStep));
    onStepChange(clamped);
    if (clamped > 0) {
      const mod = WALKTHROUGH_STEPS[clamped - 1]?.module;
      if (mod) setActiveModule(mod);
    } else {
      setActiveModule('dashboard');
    }
  };

  const handleFinishOrSkip = () => {
    setHighlightedTourTarget(null);
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nano-onboarding-title"
    >
      <div className="w-full max-w-xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Matte Black NANO Header */}
        <div className="bg-zinc-950 text-white px-5 py-4 flex items-center justify-between gap-4 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <NanoCharacter size={40} mood="helpful" animate />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                  NANO
                </span>
                <span className="text-[11px] text-zinc-400 truncate">{t('nano_badge')}</span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 tabular-nums mt-0.5">
                {t('nano_step_of')} {step + 1} / {TOTAL_STEPS}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinishOrSkip}
            className="p-2 text-zinc-400 hover:text-white rounded-lg transition-colors shrink-0"
            aria-label={t('nano_skip')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crisp Segmented Progress Bar */}
        <div className="px-5 pt-4 flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToStep(idx)}
              className={`h-2 flex-1 rounded-sm transition-colors ${
                idx <= step ? 'bg-emerald-600' : 'bg-zinc-200 hover:bg-zinc-300'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {step === 0 ? (
            <>
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 p-1.5 rounded-xl bg-zinc-950 border border-emerald-500/40">
                  <NanoCharacter size={36} mood="happy" animate />
                </div>
                <div>
                  <h2
                    id="nano-onboarding-title"
                    className="text-lg font-bold tracking-tight text-zinc-950"
                  >
                    {t('nano_welcome_title')}
                  </h2>
                  <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">
                    {t('nano_welcome_msg')}
                  </p>
                </div>
              </div>

              {/* Language (Kazakh / Russian / English) + Role Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                    {t('nano_pick_lang')}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
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
                        className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                          language === lang.code
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                    {t('nano_pick_role')}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRole('doctor')}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors truncate ${
                        role === 'doctor'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {t('role_doctor')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('patient')}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors truncate ${
                        role === 'patient'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {t('role_patient')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            currentWalkthrough && (
              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-zinc-950 text-emerald-400 flex items-center justify-center shrink-0">
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2
                      id="nano-onboarding-title"
                      className="text-lg font-bold tracking-tight text-zinc-950"
                    >
                      {t(currentWalkthrough.titleKey)}
                    </h2>
                    <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">
                      {t(currentWalkthrough.descKey)}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-emerald-950">
                    {t(`nav_${currentWalkthrough.module}`)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule(currentWalkthrough.module);
                      setHighlightedTourTarget(currentWalkthrough.tourTarget);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <span>{t('nano_preview_module')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer Controls: Skip, Back, Next, Finish */}
        <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleFinishOrSkip}
            className="px-3 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            {t('nano_skip')}
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t('nano_back')}</span>
              </button>
            )}

            {step === 0 ? (
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                <span>{t('nano_start_tour')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={() => goToStep(step + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
              >
                <span>{t('nano_next')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveModule('dashboard');
                  handleFinishOrSkip();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('nano_finish')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
