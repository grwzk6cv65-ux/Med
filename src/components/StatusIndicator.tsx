import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Truck } from 'lucide-react';
import { useMedradar } from '../context/MedradarContext';
import { RiskLevel } from '../types/medradar';

export function RiskStatusTag({ level }: { level: RiskLevel }) {
  const { t } = useMedradar();

  const styles: Record<RiskLevel, string> = {
    low: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    moderate: 'text-amber-800 bg-amber-50 border-amber-200',
    high: 'text-orange-800 bg-orange-50 border-orange-200',
    critical: 'text-red-800 bg-red-50 border-red-200',
  };

  const Icon =
    level === 'low'
      ? CheckCircle2
      : level === 'moderate'
        ? Clock
        : level === 'high'
          ? AlertTriangle
          : AlertOctagon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded-md whitespace-nowrap shrink-0 ${styles[level]}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{t(`risk_${level}`)}</span>
    </span>
  );
}

export function WorkflowStatusTag({
  status,
}: {
  status: 'scheduled' | 'en_route' | 'completed' | 'delayed' | 'pending' | 'confirmed' | 'overdue' | 'due' | 'snoozed';
}) {
  const { t } = useMedradar();

  const map: Record<string, { cls: string; icon: typeof Clock }> = {
    completed: { cls: 'text-emerald-800 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    confirmed: { cls: 'text-emerald-800 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    en_route: { cls: 'text-zinc-900 bg-zinc-100 border-zinc-300', icon: Truck },
    scheduled: { cls: 'text-zinc-700 bg-zinc-100 border-zinc-200', icon: Clock },
    pending: { cls: 'text-amber-800 bg-amber-50 border-amber-200', icon: Clock },
    due: { cls: 'text-amber-800 bg-amber-50 border-amber-200', icon: Clock },
    snoozed: { cls: 'text-zinc-600 bg-zinc-100 border-zinc-200', icon: Clock },
    delayed: { cls: 'text-red-800 bg-red-50 border-red-200', icon: AlertTriangle },
    overdue: { cls: 'text-red-800 bg-red-50 border-red-200', icon: AlertOctagon },
  };

  const entry = map[status] ?? map.scheduled;
  const Icon = entry.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded-md whitespace-nowrap shrink-0 ${entry.cls}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{t(`status_${status}`)}</span>
    </span>
  );
}
