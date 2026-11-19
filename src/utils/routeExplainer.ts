import { MedicalCluster, RouteExplanation, Village } from '../types/medradar';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Generates a transparent, plain-language explanation for why a cluster facility
 * route is recommended for a given village and specialty.
 * All travel times and distances are marked strictly as unconfirmed estimates.
 */
export function buildRouteExplanation(
  village: Village,
  clusters: MedicalCluster[],
  requiredSpecialty: string
): RouteExplanation {
  const assignedCluster =
    clusters.find((c) => c.id === village.clusterId) ?? clusters[0];

  const withDistances = clusters
    .map((cluster) => {
      const distKm =
        cluster.id === assignedCluster.id
          ? village.distanceToHubKm
          : Math.max(village.distanceToHubKm + 14, haversineKm(village.lat, village.lng, cluster.lat, cluster.lng));
      const supportsSpecialty = cluster.specialists.some(
        (sp) => sp.toLowerCase() === requiredSpecialty.toLowerCase()
      );
      return { cluster, distKm, supportsSpecialty };
    })
    .sort((a, b) => a.distKm - b.distKm);

  const primaryEntry =
    withDistances.find((e) => e.cluster.id === assignedCluster.id) ?? withDistances[0];

  const alternativeEntry =
    withDistances.find(
      (e) => e.cluster.id !== primaryEntry.cluster.id && e.supportsSpecialty
    ) ??
    withDistances.find((e) => e.cluster.id !== primaryEntry.cluster.id) ??
    null;

  const isClosest =
    withDistances[0]?.cluster.id === primaryEntry.cluster.id ||
    primaryEntry.distKm <= (withDistances[0]?.distKm ?? primaryEntry.distKm);

  // Conservative rural road speed estimate ~48 km/h
  const estimatedTimeMin = Math.max(15, Math.round((primaryEntry.distKm / 48) * 60));
  const altTimeMin = alternativeEntry
    ? Math.max(20, Math.round((alternativeEntry.distKm / 48) * 60))
    : null;

  const estimatedSavedMin =
    altTimeMin !== null && altTimeMin > estimatedTimeMin
      ? altTimeMin - estimatedTimeMin
      : null;

  return {
    primaryCluster: primaryEntry.cluster,
    alternativeCluster: alternativeEntry?.cluster ?? null,
    primaryDistanceKm: primaryEntry.distKm,
    alternativeDistanceKm: alternativeEntry?.distKm ?? null,
    estimatedTimeMin,
    estimatedSavedMin,
    isClosest,
    hasRequiredService: primaryEntry.supportsSpecialty,
    requiredSpecialty,
    isEstimateNotice: true,
  };
}
