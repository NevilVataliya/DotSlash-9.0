/**
 * Haversine formula — distance in meters between two lat/lng points.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Minimum perpendicular distance (meters) from a point to a route polyline.
 * routeCoordinates: array of [lat, lng] pairs.
 */
export function distanceToRoute(userLat, userLng, routeCoordinates) {
  if (!routeCoordinates || routeCoordinates.length === 0) return Infinity;
  if (routeCoordinates.length === 1) {
    return haversineDistance(userLat, userLng, routeCoordinates[0][0], routeCoordinates[0][1]);
  }

  let minDist = Infinity;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const [lat1, lng1] = routeCoordinates[i];
    const [lat2, lng2] = routeCoordinates[i + 1];

    // Project user point onto the segment [P1, P2] in approximate flat space
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const lenSq = dLat * dLat + dLng * dLng;

    let t = 0;
    if (lenSq > 0) {
      t = ((userLat - lat1) * dLat + (userLng - lng1) * dLng) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const closestLat = lat1 + t * dLat;
    const closestLng = lng1 + t * dLng;
    const d = haversineDistance(userLat, userLng, closestLat, closestLng);

    if (d < minDist) minDist = d;
  }

  return minDist;
}
