import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || 'YOUR_TOMTOM_API_KEY_PLACEHOLDER';
const TOMTOM_BASE_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';

/**
 * Fetch traffic data for a single segment
 * @param {Number} lat 
 * @param {Number} lon 
 * @returns {Promise<Object>} - Current speed and free flow speed
 */
export async function getTrafficData(lat, lon) {
  if (TOMTOM_API_KEY === 'YOUR_TOMTOM_API_KEY_PLACEHOLDER') {
    // Return random dummy traffic if no key
    const freeFlow = 80 + Math.random() * 20;
    const current = 30 + Math.random() * (freeFlow - 30);
    return {
      currentSpeed: current,
      freeFlowSpeed: freeFlow,
      confidence: 0.9,
      isDemo: true
    };
  }

  try {
    const response = await axios.get(TOMTOM_BASE_URL, {
      params: {
        key: TOMTOM_API_KEY,
        point: `${lat},${lon}`,
        unit: 'KMPH'
      }
    });

    const flowData = response.data.flowSegmentData;
    return {
      currentSpeed: flowData.currentSpeed,
      freeFlowSpeed: flowData.freeFlowSpeed,
      confidence: flowData.confidence,
      isDemo: false
    };
  } catch (error) {
    console.error('TomTom Traffic API Error:', error.message);
    // Fallback to dummy data
    return {
      currentSpeed: 60,
      freeFlowSpeed: 80,
      confidence: 0.5,
      isDemo: true
    };
  }
}

/**
 * Get aggregate traffic delay for a route
 * @param {Array} coordinates - Array of [lat, lon]
 * @returns {Promise<Number>} - Traffic multiplier (1.0 = clear, >1.0 = heavy)
 */
export async function getRouteTrafficMultiplier(coordinates) {
  // Sample a few points along the route to avoid hitting rate limits
  const sampleSize = Math.min(5, Math.floor(coordinates.length / 5));
  let totalCurrent = 0;
  let totalFree = 0;

  for (let i = 0; i < coordinates.length; i += Math.max(1, Math.floor(coordinates.length / sampleSize))) {
    try {
      const [lat, lon] = coordinates[i];
      const data = await getTrafficData(lat, lon);
      totalCurrent += data.currentSpeed;
      totalFree += data.freeFlowSpeed;
    } catch (e) { /* ignore single point errors */ }
  }

  if (totalCurrent === 0) return 1.0;
  
  const ratio = totalFree / totalCurrent;
  // Cap the multiplier to sane levels (e.g. max 2.5x fuel usage in gridlock)
  return Math.min(2.5, Math.max(1.0, ratio));
}

/**
 * Fetch routes from TomTom Routing API
 * @param {Array} locations - Array of {lat, lng}
 * @param {String} routeType - 'fastest', 'shortest', 'eco'
 * @returns {Promise<Object>} - Processed TomTom route
 */
export async function fetchTomTomRoute(locations, routeType = 'fastest') {
  if (TOMTOM_API_KEY === 'YOUR_TOMTOM_API_KEY_PLACEHOLDER') {
    throw new Error('TomTom API Key missing. Please provide a valid key.');
  }

  try {
    // Format locations for TomTom: lat,lon:lat,lon:lat,lon
    const waypoints = locations.map(l => `${l.lat},${l.lng || l.lon}`).join(':');
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${waypoints}/json`;

    const response = await axios.get(url, {
      params: {
        key: TOMTOM_API_KEY,
        traffic: true,
        routeType: routeType,
        travelMode: 'car'
      }
    });

    const route = response.data.routes[0];
    const summary = route.summary;
    
    // Convert TomTom coordinates to [lat, lon] for Leaflet
    const coordinates = route.legs.flatMap(leg => 
      leg.points.map(p => [p.latitude, p.longitude])
    );

    return {
      distance: summary.lengthInMeters / 1000, 
      duration: summary.travelTimeInSeconds / 60,
      coordinates: coordinates,
      source: 'TomTom Routing API',
      summary: summary
    };
  } catch (error) {
    console.error(`TomTom Routing API Error (${routeType}):`, error.response?.data || error.message);
    throw new Error(`Failed to fetch ${routeType} route from TomTom.`);
  }
}
