import axios from 'axios';
import polyline from '@mapbox/polyline';

const VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || 'https://valhalla1.openstreetmap.de/route';

/**
 * Fetch routes from Valhalla
 * @param {Array} locations - Array of {lat, lon}
 * @param {String} costing - 'auto', 'bicycle', 'pedestrian'
 * @returns {Promise<Object>} - Fastest, Shortest, and Alternative routes
 */
export async function fetchRoutes(locations, costing = 'auto') {
  try {
    const requestBody = {
      locations: locations.map(loc => ({
        lat: loc.lat,
        lon: loc.lng || loc.lon,
        type: 'break'
      })),
      costing: costing,
      directions_options: { units: 'kilometers' },
      alternates: 2
    };

    const response = await axios.get(VALHALLA_BASE_URL, {
      params: {
        json: JSON.stringify(requestBody)
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('--- [SUCCESS] Valhalla API response received. Using real map data. ---');
    const trip = response.data.trip;
    
    // Process primary route
    const primaryRoute = { ...processRoute(trip), source: 'Valhalla API' };
    
    // Process alternates if available
    const alternates = (trip.alternates || []).map(alt => ({ ...processRoute(alt), source: 'Valhalla API' }));
    
    return {
      primary: primaryRoute,
      alternates: alternates,
      dataSource: 'Valhalla API'
    };
  } catch (error) {
    console.error(`--- [FALLBACK] Valhalla API Error: ${error.message}. Using MOCK mapping data. ---`);
    return getMockRoutes(locations);
  }
}

function getMockRoutes(locations) {
  console.log('Generating high-fidelity mock route coordinates...');
  // Generate a mock route that connects the locations
  const coords = locations.map(l => [l.lat, l.lng || l.lon]);
  
  // Total distance estimation (Haversine-ish)
  let totalDist = 0;
  for(let i=1; i<coords.length; i++) {
    const d = Math.sqrt(Math.pow(coords[i][0]-coords[i-1][0], 2) + Math.pow(coords[i][1]-coords[i-1][1], 2)) * 111;
    totalDist += d;
  }

  const primary = {
    distance: totalDist,
    duration: (totalDist / 60) * 60, // ~60km/h avg
    coordinates: generateInterpolatedCoordinates(coords),
    summary: { length: totalDist, time: totalDist * 60 },
    source: 'Mock Data'
  };

  // Create two alternates with slightly different distances/times
  const alt1 = {
    ...primary,
    distance: totalDist * 1.1,
    duration: primary.duration * 0.9, // Faster but longer
    coordinates: generateInterpolatedCoordinates(coords, 0.01),
    source: 'Mock Data'
  };

  const alt2 = {
    ...primary,
    distance: totalDist * 0.95,
    duration: primary.duration * 1.2, // Shorter but slower
    coordinates: generateInterpolatedCoordinates(coords, -0.01),
    source: 'Mock Data'
  };

  return { primary, alternates: [alt1, alt2], dataSource: 'Mock Data' };
}

function generateInterpolatedCoordinates(points, jitter = 0) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const steps = 10;
    for (let j = 0; j <= steps; j++) {
      const lat = start[0] + (end[0] - start[0]) * (j / steps) + (Math.random() - 0.5) * jitter;
      const lon = start[1] + (end[1] - start[1]) * (j / steps) + (Math.random() - 0.5) * jitter;
      result.push([lat, lon]);
    }
  }
  return result;
}

function processRoute(routeData) {
  const coordinates = [];
  let distance = 0;
  let duration = 0;

  routeData.legs.forEach(leg => {
    distance += leg.summary.length;
    duration += leg.summary.time;
    
    // Valhalla uses 6-decimal precision by default. 
    // @mapbox/polyline uses 5 by default, so we specify 6.
    const decoded = polyline.decode(leg.shape, 6);
    coordinates.push(...decoded);
  });

  return {
    distance, // km
    duration: duration / 60, // minutes
    coordinates,
    summary: routeData.summary
  };
}
