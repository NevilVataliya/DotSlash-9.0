import { VEHICLE_PROFILES } from '../data/demoData';

const EARTH_RADIUS_KM = 6371;

const ROUTE_CONFIG = {
  fuelOptimized: {
    id: 'fuel-optimized',
    label: 'Fuel Optimized',
    desc: 'Offline estimate optimized for lower fuel burn',
    color: '#00E676',
    distanceMultiplier: 1,
    durationMultiplier: 1,
    fuelMultiplier: 0.9,
    co2Multiplier: 0.88,
    elevationMultiplier: 0.9,
  },
  fastest: {
    id: 'fastest',
    label: 'Fastest',
    desc: 'Offline estimate optimized for shorter travel time',
    color: '#FF5252',
    distanceMultiplier: 1.06,
    durationMultiplier: 0.86,
    fuelMultiplier: 1.12,
    co2Multiplier: 1.1,
    elevationMultiplier: 1,
  },
  shortest: {
    id: 'shortest',
    label: 'Shortest Distance',
    desc: 'Offline estimate optimized for direct distance',
    color: '#448AFF',
    distanceMultiplier: 0.95,
    durationMultiplier: 1.05,
    fuelMultiplier: 1,
    co2Multiplier: 1,
    elevationMultiplier: 1.05,
  },
  leastCo2: {
    id: 'least-co2',
    label: 'Least CO₂',
    desc: 'Offline estimate optimized for low CO₂ emissions',
    color: '#7C4DFF',
    distanceMultiplier: 1.02,
    durationMultiplier: 1.02,
    fuelMultiplier: 0.92,
    co2Multiplier: 0.82,
    elevationMultiplier: 0.95,
  },
};

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineKm(pointA, pointB) {
  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);

  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function getVehicle(vehicleId) {
  return VEHICLE_PROFILES.find((vehicle) => vehicle.id === vehicleId) || VEHICLE_PROFILES[0];
}

function interpolateSegment(start, end, pointsCount = 8) {
  const points = [];
  for (let index = 0; index <= pointsCount; index += 1) {
    const ratio = index / pointsCount;
    points.push([
      start.lat + (end.lat - start.lat) * ratio,
      start.lng + (end.lng - start.lng) * ratio,
    ]);
  }
  return points;
}

function buildBaseCoordinates(routePoints) {
  const coordinates = [];

  routePoints.forEach((point, index) => {
    if (index === routePoints.length - 1) return;

    const next = routePoints[index + 1];
    const interpolated = interpolateSegment(point, next, 8);

    if (index > 0) {
      interpolated.shift();
    }

    coordinates.push(...interpolated);
  });

  return coordinates;
}

function offsetCoordinates(coordinates, latOffset, lngOffset) {
  if (!coordinates.length) return coordinates;

  return coordinates.map((coordinate, index) => {
    const isEndPoint = index === 0 || index === coordinates.length - 1;
    if (isEndPoint) return coordinate;

    return [coordinate[0] + latOffset, coordinate[1] + lngOffset];
  });
}

function buildSegments(routePoints) {
  const trafficPattern = ['moderate', 'light', 'moderate', 'heavy'];
  const weatherPattern = ['clear', 'partly_cloudy', 'clear', 'windy'];

  return routePoints.slice(0, routePoints.length - 1).map((point, index) => {
    const next = routePoints[index + 1];
    return {
      from: point.name || `Point ${index + 1}`,
      to: next.name || `Point ${index + 2}`,
      dist: Number(haversineKm(point, next).toFixed(1)),
      traffic: trafficPattern[index % trafficPattern.length],
      weather: weatherPattern[index % weatherPattern.length],
      elevation: Math.max(6, 16 + (index % 4) * 11),
    };
  });
}

function createFuelMetrics(vehicle, distance, fuelMultiplier, co2Multiplier) {
  const isEv = vehicle.fuelType === 'Electric';
  const unit = isEv ? 'kWh' : 'L';
  const baseFuelUsed = (vehicle.baseFuelRate / 100) * distance;
  const fuelUsed = baseFuelUsed * fuelMultiplier;
  const cost = fuelUsed * vehicle.fuelPrice;
  const co2Factor = isEv ? 0.4 : 2.31;
  const co2 = fuelUsed * co2Factor * co2Multiplier;

  return {
    fuelUsed: Number(fuelUsed.toFixed(1)),
    cost: Number(cost.toFixed(0)),
    co2: Number(co2.toFixed(1)),
    co2Savings: Number((co2 * 0.08).toFixed(1)),
    fuelUnit: unit,
  };
}

export function createNavigationInstructions(route) {
  if (!route) return [];

  const instructions = [];
  const segments = route.segments || [];

  if (!segments.length && route.coordinates?.length) {
    const end = route.coordinates[route.coordinates.length - 1];
    instructions.push({ type: 'start', text: 'Start navigation and proceed on the highlighted route.' });
    instructions.push({ type: 'arrive', text: `Arrive near ${end[0].toFixed(4)}, ${end[1].toFixed(4)}.` });
    return instructions;
  }

  if (segments.length) {
    instructions.push({
      type: 'start',
      text: `Start from ${segments[0].from} and head towards ${segments[0].to}.`,
      distanceKm: segments[0].dist,
    });
  }

  segments.forEach((segment, index) => {
    if (index === 0) return;

    instructions.push({
      type: 'continue',
      text: `Continue to ${segment.to} via ${segment.from}.`,
      distanceKm: segment.dist,
    });
  });

  if (segments.length) {
    const last = segments[segments.length - 1];
    instructions.push({
      type: 'arrive',
      text: `You have arrived at ${last.to}.`,
      distanceKm: 0,
    });
  }

  return instructions;
}

export function generateOfflineRoutes({ source, destination, stops = [], vehicleId }) {
  const points = [source, ...stops.filter(Boolean), destination].filter(Boolean);

  if (points.length < 2) {
    return null;
  }

  const vehicle = getVehicle(vehicleId);
  const baseSegments = buildSegments(points);
  const baseCoordinates = buildBaseCoordinates(points);
  const baseDistance = baseSegments.reduce((sum, segment) => sum + segment.dist, 0);

  const routes = {};

  Object.values(ROUTE_CONFIG).forEach((config, index) => {
    const distance = Number((baseDistance * config.distanceMultiplier).toFixed(1));
    const avgSpeed = 60;
    const duration = Math.max(1, Math.round((distance / avgSpeed) * 60 * config.durationMultiplier));
    const elevationGain = Math.round(baseSegments.reduce((sum, segment) => sum + segment.elevation, 0) * config.elevationMultiplier);

    const latOffset = index === 1 ? 0.01 : index === 2 ? -0.01 : index === 3 ? 0.005 : 0;
    const lngOffset = index === 1 ? 0.012 : index === 2 ? -0.008 : index === 3 ? 0.01 : 0;

    const route = {
      id: config.id,
      label: config.label,
      description: `${config.desc}.`,
      color: config.color,
      distance,
      duration,
      fuelMultiplier: config.fuelMultiplier,
      co2Multiplier: config.co2Multiplier,
      elevationGain,
      coordinates: offsetCoordinates(baseCoordinates, latOffset, lngOffset),
      segments: baseSegments,
      fuelMetrics: createFuelMetrics(vehicle, distance, config.fuelMultiplier, config.co2Multiplier),
    };

    route.instructions = createNavigationInstructions(route);
    routes[config.id] = route;
  });

  return routes;
}
