const MAP_TILE_CACHE = 'eco-map-tiles-v1';
const MAP_SUBDOMAINS = ['a', 'b', 'c', 'd'];
const MAP_TILE_URL_TEMPLATE = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function lonToTileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom
  );
}

function buildTileUrl(zoom, x, y) {
  const subdomain = MAP_SUBDOMAINS[(x + y + zoom) % MAP_SUBDOMAINS.length];
  return MAP_TILE_URL_TEMPLATE
    .replace('{s}', subdomain)
    .replace('{z}', String(zoom))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', '');
}

function addTile(tiles, zoom, x, y, radius) {
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      tiles.add(`${zoom}:${x + dx}:${y + dy}`);
    }
  }
}

export async function prefetchTilesForRoutes(routes, options = {}) {
  if (!routes || !Object.keys(routes).length) {
    return { plannedTiles: 0, cachedTiles: 0, failedTiles: 0 };
  }

  if (!('caches' in window) || !navigator.onLine) {
    return { plannedTiles: 0, cachedTiles: 0, failedTiles: 0 };
  }

  const zooms = options.zooms || [10, 11, 12];
  const radius = options.radius ?? 1;
  const maxTiles = options.maxTiles ?? 650;

  const tileSet = new Set();

  Object.values(routes).forEach((route) => {
    const coordinates = route.coordinates || [];

    coordinates.forEach(([lat, lng]) => {
      zooms.forEach((zoom) => {
        const x = lonToTileX(lng, zoom);
        const y = latToTileY(lat, zoom);
        addTile(tileSet, zoom, x, y, radius);
      });
    });
  });

  const plannedTiles = Array.from(tileSet).slice(0, maxTiles);
  const cache = await caches.open(MAP_TILE_CACHE);

  let cachedTiles = 0;
  let failedTiles = 0;

  for (const tile of plannedTiles) {
    const [zoom, x, y] = tile.split(':').map(Number);
    const url = buildTileUrl(zoom, x, y);
    const request = new Request(url, { mode: 'no-cors' });

    const existing = await cache.match(request);
    if (existing) {
      cachedTiles += 1;
      continue;
    }

    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone());
        cachedTiles += 1;
      } else {
        failedTiles += 1;
      }
    } catch {
      failedTiles += 1;
    }
  }

  return {
    plannedTiles: plannedTiles.length,
    cachedTiles,
    failedTiles,
  };
}
