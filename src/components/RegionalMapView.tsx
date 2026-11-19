import L from 'leaflet';
import { CalendarPlus, FlaskConical, Hospital, Layers, MapPin, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { RiskLevel, Village } from '../types/medradar';
import { buildRouteExplanation } from '../utils/routeExplainer';
import { RouteExplanationCard } from './RouteExplanationCard';
import { RiskStatusTag } from './StatusIndicator';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#059669',
  moderate: '#d97706',
  high: '#ea580c',
  critical: '#dc2626',
};

export function RegionalMapView() {
  const {
    t,
    language,
    clusters,
    villages,
    patients,
    selectedVillageId,
    setSelectedVillageId,
    setActivePatientId,
    setActiveModule,
    addMedMobileStop,
  } = useMedradar();

  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showLinks, setShowLinks] = useState<boolean>(true);
  const [scheduledToast, setScheduledToast] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const filteredVillages = useMemo(() => {
    return villages.filter((v) => {
      if (riskFilter !== 'all' && v.riskLevel !== riskFilter) return false;
      if (clusterFilter !== 'all' && v.clusterId !== clusterFilter) return false;
      if (searchQuery.trim() && !v.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [villages, riskFilter, clusterFilter, searchQuery]);

  const selectedVillage: Village | undefined = useMemo(() => {
    return (
      villages.find((v) => v.id === selectedVillageId) ??
      filteredVillages[0] ??
      villages[0]
    );
  }, [villages, filteredVillages, selectedVillageId]);

  const selectedCluster = useMemo(() => {
    if (!selectedVillage) return clusters[0];
    return clusters.find((c) => c.id === selectedVillage.clusterId) ?? clusters[0];
  }, [clusters, selectedVillage]);

  const routeExplanation = useMemo(() => {
    if (!selectedVillage) return null;
    const specialty =
      selectedVillage.dominantConcern === 'cardiovascular'
        ? 'Cardiology'
        : selectedVillage.dominantConcern === 'diabetes'
          ? 'Endocrinology'
          : selectedVillage.dominantConcern === 'respiratory'
            ? 'Pulmonology'
            : selectedVillage.dominantConcern === 'maternal'
              ? 'Obstetrics'
              : 'General Practice';
    return buildRouteExplanation(selectedVillage, clusters, specialty);
  }, [selectedVillage, clusters]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [48.1, 67.8],
      zoom: 5,
      minZoom: 4,
      maxZoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const visibleClusterIds = new Set(filteredVillages.map((v) => v.clusterId));

    if (showLinks) {
      filteredVillages.forEach((village) => {
        const cluster = clusters.find((c) => c.id === village.clusterId);
        if (!cluster) return;
        L.polyline(
          [
            [village.lat, village.lng],
            [cluster.lat, cluster.lng],
          ],
          {
            color: village.id === selectedVillage?.id ? '#059669' : '#71717a',
            weight: village.id === selectedVillage?.id ? 2.2 : 1,
            opacity: village.id === selectedVillage?.id ? 0.95 : 0.45,
            dashArray: '4 4',
          }
        ).addTo(group);
      });
    }

    clusters.forEach((cluster) => {
      if (clusterFilter !== 'all' && cluster.id !== clusterFilter) return;
      if (clusterFilter === 'all' && !visibleClusterIds.has(cluster.id) && searchQuery.trim()) return;

      const hubIcon = L.divIcon({
        className: 'medradar-hub-icon',
        html: `<div style="width:18px;height:18px;background:#09090b;border:2px solid #10b981;border-radius:4px;box-shadow:0 2px 6px rgba(9,9,11,0.35);display:flex;align-items:center;justify-content:center;color:#34d399;font-size:11px;font-weight:800;">+</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([cluster.lat, cluster.lng], { icon: hubIcon }).addTo(group);
      marker.bindTooltip(
        `${cluster.id} · ${pickLocalized(cluster.hubHospital, language)} (${cluster.medMobileUnit})`,
        { direction: 'top', offset: [0, -8] }
      );
      marker.on('click', () => {
        const firstVillage = villages.find((v) => v.clusterId === cluster.id);
        if (firstVillage) setSelectedVillageId(firstVillage.id);
      });
    });

    filteredVillages.forEach((village) => {
      const isSelected = village.id === selectedVillage?.id;
      const color = RISK_COLORS[village.riskLevel];
      const circle = L.circleMarker([village.lat, village.lng], {
        radius: isSelected ? 9 : 6,
        color: isSelected ? '#09090b' : '#ffffff',
        weight: isSelected ? 2.5 : 1.5,
        fillColor: color,
        fillOpacity: 0.92,
      }).addTo(group);

      circle.bindTooltip(
        `${village.name} (${village.id}) · Risk ${village.riskIndex}/100 · ${village.population.toLocaleString()} pop.`,
        { direction: 'top', offset: [0, -6] }
      );

      circle.on('click', () => {
        setSelectedVillageId(village.id);
      });
    });
  }, [filteredVillages, clusters, villages, showLinks, clusterFilter, searchQuery, selectedVillage, language, setSelectedVillageId]);

  const handleScheduleExtraMedMobile = () => {
    if (!selectedVillage || !selectedCluster) return;
    addMedMobileStop({
      unitId: selectedCluster.medMobileUnit,
      clusterId: selectedCluster.id,
      villageId: selectedVillage.id,
      dayOfWeek: 'Sat',
      timeWindow: '10:00 - 14:00',
      specialtyFocus:
        selectedVillage.dominantConcern === 'cardiovascular'
          ? 'cardiology'
          : selectedVillage.dominantConcern === 'maternal'
            ? 'maternal'
            : selectedVillage.dominantConcern === 'diabetes'
              ? 'endocrinology'
              : 'diagnostics',
      teamLead: selectedCluster.leadPhysician,
      bookedSlots: 1,
      maxSlots: 18,
      status: 'scheduled',
    });
    setScheduledToast(`${selectedCluster.medMobileUnit} -> ${selectedVillage.name}`);
    setTimeout(() => setScheduledToast(null), 3500);
  };

  const handleRunRapidLabHere = () => {
    if (!selectedVillage) return;
    const matchPatient =
      patients.find((p) => p.villageId === selectedVillage.id) ??
      patients.find((p) => p.clusterId === selectedVillage.clusterId) ??
      patients[0];
    setActivePatientId(matchPatient.id);
    setActiveModule('rapid_lab');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('map_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('map_sub')}</p>
        </div>
        <div className="text-xs font-mono tabular-nums text-zinc-500 whitespace-nowrap shrink-0">
          {filteredVillages.length} / {villages.length} {t('map_villages_shown')} · {clusters.length} {t('kpi_clusters')}
        </div>
      </div>

      {/* Controls Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            {(['all', 'critical', 'high', 'moderate', 'low'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setRiskFilter(lvl)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  riskFilter === lvl
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {t(`map_filter_${lvl}`)}
              </button>
            ))}
          </div>

          <select
            aria-label={t('map_filter_cluster')}
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">{t('map_filter_cluster')}</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {pickLocalized(c.name, language)}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowLinks((s) => !s)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              showLinks
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('map_toggle_links')}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('map_search_village')}
            className="w-full h-8 pl-8 pr-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Main Split: Leaflet Map + Selected Village Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
          <div ref={mapContainerRef} className="w-full h-[460px] lg:h-[540px]" />
          <div className="px-4 py-2.5 bg-zinc-950 text-zinc-300 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-white">
                <span className="inline-flex items-center justify-center w-4 h-4 bg-zinc-950 border border-emerald-500 text-emerald-400 text-[10px] font-bold rounded-[3px]">
                  +
                </span>
                {t('map_legend_hub')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                {t('risk_critical')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                {t('risk_high')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                {t('risk_moderate')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                {t('risk_low')}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">Leaflet · OpenStreetMap</span>
          </div>
        </div>

        {/* Right Inspector Panel */}
        <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between">
          {selectedVillage && selectedCluster ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-emerald-700 font-semibold">
                    {selectedVillage.id} · {selectedCluster.id}
                  </div>
                  <h2 className="text-xl font-bold text-zinc-950 mt-0.5">{selectedVillage.name}</h2>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {pickLocalized(selectedCluster.region, language)} · {pickLocalized(selectedCluster.name, language)}
                  </div>
                </div>
                <RiskStatusTag level={selectedVillage.riskLevel} />
              </div>

              <div className="border-t border-zinc-200 pt-4 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {t('map_population')}
                  </div>
                  <div className="font-semibold text-zinc-950 tabular-nums mt-0.5">
                    {selectedVillage.population.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {t('map_distance_hub')}
                  </div>
                  <div className="font-semibold text-zinc-950 tabular-nums mt-0.5">
                    {selectedVillage.distanceToHubKm} km
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">{t('map_risk_score')}</div>
                  <div className="font-mono font-semibold text-zinc-950 tabular-nums mt-0.5">
                    {selectedVillage.riskIndex} / 100
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">{t('map_rapid_lab_ready')}</div>
                  <div className="font-medium text-zinc-950 mt-0.5">
                    {selectedVillage.rapidLabEquipped ? t('map_rapid_lab_yes') : t('map_rapid_lab_no')}
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <Hospital className="w-3.5 h-3.5 text-emerald-600" />
                    {t('map_selected_cluster')}
                  </span>
                  <span className="font-medium text-zinc-950 text-right">
                    {pickLocalized(selectedCluster.hubHospital, language)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>{t('mm_unit')}</span>
                  <span className="font-mono font-semibold text-emerald-700">{selectedCluster.medMobileUnit}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>{t('map_next_medmobile')}</span>
                  <span className="font-mono tabular-nums font-medium text-zinc-950">
                    {selectedVillage.nextMedMobileVisit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>{t('ana_active_patients')}</span>
                  <span className="font-mono tabular-nums font-medium text-zinc-950">
                    {selectedVillage.activePatientsCount} ({selectedVillage.screenedLast30d} {t('ana_screened')})
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <div className="text-xs font-medium text-zinc-500 mb-2">
                  {pickLocalized(selectedCluster.name, language)} — 4 {t('ana_villages_count')}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {villages
                    .filter((v) => v.clusterId === selectedCluster.id)
                    .map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVillageId(v.id);
                          mapInstanceRef.current?.setView([v.lat, v.lng], 8, { animate: true });
                        }}
                        className={`px-2.5 py-1.5 text-left text-xs rounded-lg border transition-colors truncate ${
                          v.id === selectedVillage.id
                            ? 'bg-zinc-950 border-zinc-950 text-emerald-400 font-semibold'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="font-mono mr-1 opacity-70">{v.id}</span>
                        {v.name}
                      </button>
                    ))}
                </div>
              </div>
              {routeExplanation && <RouteExplanationCard explanation={routeExplanation} />}
            </div>
          ) : null}

          <div className="border-t border-zinc-200 pt-4 mt-5 space-y-2">
            {scheduledToast && (
              <div className="px-3 py-2 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
                + {scheduledToast}
              </div>
            )}
            <button
              onClick={handleRunRapidLabHere}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <FlaskConical className="w-4 h-4" />
              <span>{t('map_run_lab_here')}</span>
            </button>
            <button
              onClick={handleScheduleExtraMedMobile}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>{t('map_dispatch_medmobile')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
