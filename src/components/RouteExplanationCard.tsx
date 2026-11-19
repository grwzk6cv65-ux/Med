import { AlertCircle, CheckCircle2, Clock, Hospital, Navigation, Route } from 'lucide-react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { RouteExplanation } from '../types/medradar';

interface RouteExplanationCardProps {
  explanation: RouteExplanation;
  compact?: boolean;
}

export function RouteExplanationCard({ explanation, compact = false }: RouteExplanationCardProps) {
  const { t, language } = useMedradar();

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-zinc-950 flex items-center gap-1.5">
          <Route className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t('route_why_title')}</span>
        </div>
        <span className="font-mono text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
          ~{explanation.primaryDistanceKm} km
        </span>
      </div>

      <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
        <Hospital className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
        <span>{pickLocalized(explanation.primaryCluster.hubHospital, language)}</span>
      </div>

      <ul className="space-y-1.5 text-zinc-700">
        <li className="flex items-start gap-2">
          <Navigation className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
          <span>
            {explanation.isClosest ? t('route_closest_yes') : t('route_closest_no')} (
            <span className="font-mono font-medium">~{explanation.primaryDistanceKm} km</span>)
          </span>
        </li>

        <li className="flex items-start gap-2">
          <CheckCircle2
            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
              explanation.hasRequiredService ? 'text-emerald-600' : 'text-amber-600'
            }`}
          />
          <span>
            {explanation.hasRequiredService ? t('route_service_yes') : t('route_service_no')}:{' '}
            <strong className="text-zinc-950">{explanation.requiredSpecialty}</strong>
          </span>
        </li>

        <li className="flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-700 mt-0.5 shrink-0" />
          <span>
            {t('route_time_est')}:{' '}
            <strong className="font-mono text-zinc-950">~{explanation.estimatedTimeMin} min</strong>
            {explanation.estimatedSavedMin !== null && (
              <>
                {' '}· {t('route_saved_est')}:{' '}
                <strong className="font-mono text-emerald-700">~{explanation.estimatedSavedMin} min</strong>
              </>
            )}
          </span>
        </li>

        {!compact && explanation.alternativeCluster && explanation.alternativeDistanceKm !== null && (
          <li className="flex items-start gap-2 text-zinc-600">
            <Hospital className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
            <span>
              {t('route_alt_label')}:{' '}
              <span className="font-medium text-zinc-800">
                {pickLocalized(explanation.alternativeCluster.hubHospital, language)}
              </span>{' '}
              (<span className="font-mono">~{explanation.alternativeDistanceKm} km</span>)
            </span>
          </li>
        )}
      </ul>

      <div className="pt-2 border-t border-zinc-200 flex items-start gap-1.5 text-[11px] text-zinc-500">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <span>{t('route_unconfirmed_note')}</span>
      </div>
    </div>
  );
}
