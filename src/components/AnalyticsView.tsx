import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';

const RISK_COLORS: Record<string, string> = {
  low: '#059669',
  moderate: '#d97706',
  high: '#ea580c',
  critical: '#dc2626',
};

const CONCERN_COLORS = ['#059669', '#09090b', '#10b981', '#dc2626', '#71717a'];

const TOOLTIP_STYLE = {
  fontSize: '12px',
  borderRadius: '8px',
  backgroundColor: '#09090b',
  border: '1px solid #27272a',
  color: '#ffffff',
};

export function AnalyticsView() {
  const { t, language, clusters, villages, patients, referrals, rapidLabs } = useMedradar();

  const riskDistData = useMemo(() => {
    const counts = { low: 0, moderate: 0, high: 0, critical: 0 };
    villages.forEach((v) => {
      counts[v.riskLevel] += 1;
    });
    return (['critical', 'high', 'moderate', 'low'] as const).map((level) => ({
      level,
      name: t(`risk_${level}`),
      villages: counts[level],
      color: RISK_COLORS[level],
    }));
  }, [villages, t]);

  const clusterCoverageData = useMemo(() => {
    return clusters.slice(0, 10).map((c) => {
      const cVillages = villages.filter((v) => v.clusterId === c.id);
      const active = cVillages.reduce((acc, v) => acc + v.activePatientsCount, 0);
      const screened = cVillages.reduce((acc, v) => acc + v.screenedLast30d, 0);
      return {
        cluster: c.id,
        label: pickLocalized(c.name, language),
        active,
        screened,
      };
    });
  }, [clusters, villages, language]);

  const concernData = useMemo(() => {
    const map: Record<string, number> = {
      cardiovascular: 0,
      diabetes: 0,
      respiratory: 0,
      maternal: 0,
      preventive: 0,
    };
    villages.forEach((v) => {
      map[v.dominantConcern] += 1;
    });
    return Object.entries(map).map(([key, value]) => ({
      name: t(`concern_${key}`),
      value,
    }));
  }, [villages, t]);

  const loopFunnelData = useMemo(() => {
    const totalPatients = patients.length;
    const labDone = patients.filter((p) => p.journeyStage >= 1).length + rapidLabs.length;
    const referred = referrals.length;
    const consultDone = referrals.filter((r) => r.status === 'completed' || r.loopClosed).length;
    const loopClosed = referrals.filter((r) => r.loopClosed).length;
    return [
      { stage: t('stage_0'), count: totalPatients },
      { stage: t('stage_1'), count: labDone },
      { stage: t('stage_3'), count: referred },
      { stage: t('stage_4'), count: consultDone },
      { stage: t('stage_5'), count: loopClosed },
    ];
  }, [patients, rapidLabs, referrals, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('ana_title')}</h1>
        <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('ana_sub')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-950 mb-4">{t('ana_chart_risk_dist')}</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#52525b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#52525b' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="villages" name={t('ana_villages_count')} radius={[6, 6, 0, 0]}>
                  {riskDistData.map((entry) => (
                    <Cell key={entry.level} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-950 mb-4">
            {t('ana_chart_cluster_coverage')}
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={clusterCoverageData}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="cluster" tick={{ fontSize: 11, fill: '#52525b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#52525b' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="active"
                  name={t('ana_active_patients')}
                  fill="#09090b"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="screened"
                  name={t('ana_screened')}
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-950 mb-4">{t('ana_chart_concerns')}</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={concernData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {concernData.map((entry, idx) => (
                    <Cell key={entry.name} fill={CONCERN_COLORS[idx % CONCERN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-950 mb-4">{t('ana_chart_loop_funnel')}</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={loopFunnelData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#52525b' }} />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11, fill: '#27272a' }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
