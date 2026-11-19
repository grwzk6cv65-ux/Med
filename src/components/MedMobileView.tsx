import { Calendar, Plus, RefreshCw, Truck, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { MedMobileStop } from '../types/medradar';
import { validateMedMobileStopInput } from '../utils/validation';
import { WorkflowStatusTag } from './StatusIndicator';

const DAYS: MedMobileStop['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MedMobileView() {
  const {
    t,
    language,
    clusters,
    villages,
    medMobileSchedule,
    addMedMobileStop,
    cycleMedMobileStatus,
    bookMedMobileSlot,
  } = useMedradar();

  const [dayFilter, setDayFilter] = useState<'all' | MedMobileStop['dayOfWeek']>('all');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const [newVillageId, setNewVillageId] = useState<string>(villages[0]?.id ?? 'V-01');
  const [newDay, setNewDay] = useState<MedMobileStop['dayOfWeek']>('Fri');
  const [newTime, setNewTime] = useState<string>('09:00 - 14:00');
  const [newSpecialty, setNewSpecialty] = useState<MedMobileStop['specialtyFocus']>('diagnostics');
  const [newLead, setNewLead] = useState<string>('Dr. Arman Kenzhebayev');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const filteredSchedule = useMemo(() => {
    return medMobileSchedule.filter((s) => dayFilter === 'all' || s.dayOfWeek === dayFilter);
  }, [medMobileSchedule, dayFilter]);

  const handleAddStop = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateMedMobileStopInput(
      { villageId: newVillageId, timeWindow: newTime, teamLead: newLead },
      language
    );
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    const v = villages.find((vil) => vil.id === newVillageId) ?? villages[0];
    const c = clusters.find((cl) => cl.id === v.clusterId) ?? clusters[0];
    addMedMobileStop({
      unitId: c.medMobileUnit,
      clusterId: c.id,
      villageId: v.id,
      dayOfWeek: newDay,
      timeWindow: newTime.trim(),
      specialtyFocus: newSpecialty,
      teamLead: newLead.trim(),
      bookedSlots: 1,
      maxSlots: 18,
      status: 'scheduled',
    });
    setFormErrors({});
    setShowAddForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('mm_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('mm_sub')}</p>
        </div>
        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t('mm_add_stop')}</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddStop}
          noValidate
          className="bg-white border border-zinc-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-start"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('mm_village')}</label>
            <select
              value={newVillageId}
              onChange={(e) => setNewVillageId(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950"
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} · {v.name} ({v.clusterId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('mm_day')}</label>
            <select
              value={newDay}
              onChange={(e) => setNewDay(e.target.value as MedMobileStop['dayOfWeek'])}
              className="w-full h-9 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('mm_time')}</label>
            <input
              type="text"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              aria-invalid={Boolean(formErrors.timeWindow)}
              className={`w-full h-9 px-2.5 text-xs font-mono rounded-lg border text-zinc-950 ${
                formErrors.timeWindow ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-zinc-50'
              }`}
            />
            {formErrors.timeWindow && (
              <p className="text-[11px] text-red-600 mt-1">{formErrors.timeWindow}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('mm_specialty')}</label>
            <select
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value as MedMobileStop['specialtyFocus'])}
              className="w-full h-9 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950"
            >
              <option value="diagnostics">{t('spec_diagnostics')}</option>
              <option value="cardiology">{t('spec_cardiology')}</option>
              <option value="maternal">{t('spec_maternal')}</option>
              <option value="endocrinology">{t('spec_endocrinology')}</option>
              <option value="general">{t('spec_general')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('mm_lead_input')}</label>
            <input
              type="text"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
              aria-invalid={Boolean(formErrors.teamLead)}
              className={`w-full h-9 px-2.5 text-xs rounded-lg border text-zinc-950 ${
                formErrors.teamLead ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-zinc-50'
              }`}
            />
            {formErrors.teamLead && (
              <p className="text-[11px] text-red-600 mt-1">{formErrors.teamLead}</p>
            )}
          </div>
          <div className="pt-5">
            <button
              type="submit"
              className="w-full h-9 px-4 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {t('mm_add_stop')}
            </button>
          </div>
        </form>
      )}

      {/* Day Filter Tabs */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          <button
            onClick={() => setDayFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              dayFilter === 'all' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            {t('mm_filter_day')}
          </button>
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setDayFilter(day)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dayFilter === day ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="text-xs font-mono tabular-nums text-zinc-500 px-2 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>{filteredSchedule.length} stops</span>
        </div>
      </div>

      {/* High-Density Schedule Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">{t('mm_unit')}</th>
                <th className="py-3 px-4">{t('mm_day')} / {t('mm_time')}</th>
                <th className="py-3 px-4">{t('mm_village')}</th>
                <th className="py-3 px-4">{t('mm_specialty')}</th>
                <th className="py-3 px-4">{t('mm_lead')}</th>
                <th className="py-3 px-4 text-right">{t('mm_capacity')}</th>
                <th className="py-3 px-4">{t('mm_status')}</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {filteredSchedule.map((stop) => {
                const village = villages.find((v) => v.id === stop.villageId);
                const cluster = clusters.find((c) => c.id === stop.clusterId);
                return (
                  <tr key={stop.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-zinc-950 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        {stop.unitId}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-zinc-950 mr-1.5">{stop.dayOfWeek}</span>
                      <span className="font-mono tabular-nums text-zinc-500">{stop.timeWindow}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-950">{village?.name ?? stop.villageId}</div>
                      <div className="text-[11px] text-zinc-500">
                        {stop.clusterId} · {cluster ? pickLocalized(cluster.region, language) : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-700 whitespace-nowrap">
                      {t(`spec_${stop.specialtyFocus}`)}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 whitespace-nowrap">{stop.teamLead}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-zinc-950 whitespace-nowrap">
                      {stop.bookedSlots} / {stop.maxSlots}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <WorkflowStatusTag status={stop.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => bookMedMobileSlot(stop.id)}
                          disabled={stop.bookedSlots >= stop.maxSlots}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-800 rounded-md transition-colors"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>{t('mm_book_slot')}</span>
                        </button>
                        <button
                          onClick={() => cycleMedMobileStatus(stop.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-zinc-950 hover:bg-zinc-800 text-emerald-400 rounded-md transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{t('mm_action_advance')}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
