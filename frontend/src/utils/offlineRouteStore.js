const STORE_KEY = 'ecoroute.offline-route-store.v1';

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeRound(num) {
  return Number(num).toFixed(4);
}

function serializeLocation(location) {
  if (!location) return 'unknown';
  const name = (location.name || '').trim().toLowerCase();
  const lat = location.lat != null ? safeRound(location.lat) : 'na';
  const lng = location.lng != null ? safeRound(location.lng) : 'na';
  return `${name}|${lat}|${lng}`;
}

function readStore() {
  if (typeof window === 'undefined') {
    return { bySignature: {}, lastSignature: null };
  }

  const raw = localStorage.getItem(STORE_KEY);
  return safeParse(raw, { bySignature: {}, lastSignature: null });
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function createRoutePlanSignature({ source, destination, stops = [], vehicleId }) {
  return [
    `source:${serializeLocation(source)}`,
    `destination:${serializeLocation(destination)}`,
    `stops:${stops.map(serializeLocation).join('||')}`,
    `vehicle:${vehicleId || 'unknown'}`,
  ].join('__');
}

export function saveOfflineRoutePlan({ signature, routes, selectedRoute, source, destination, stops, vehicleId }) {
  if (!signature || !routes) return;

  const store = readStore();
  const entry = {
    signature,
    routes,
    selectedRoute,
    source,
    destination,
    stops,
    vehicleId,
    savedAt: Date.now(),
  };

  store.bySignature[signature] = entry;
  store.lastSignature = signature;

  const entries = Object.values(store.bySignature).sort((a, b) => b.savedAt - a.savedAt);
  const keep = entries.slice(0, 20);
  store.bySignature = keep.reduce((acc, current) => {
    acc[current.signature] = current;
    return acc;
  }, {});

  writeStore(store);
}

export function loadOfflineRouteBySignature(signature) {
  if (!signature) return null;
  const store = readStore();
  return store.bySignature[signature] || null;
}

export function loadLatestOfflineRoute() {
  const store = readStore();
  if (!store.lastSignature) return null;
  return store.bySignature[store.lastSignature] || null;
}
