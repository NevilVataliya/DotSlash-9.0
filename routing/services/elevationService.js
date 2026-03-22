import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPEN_TOPO_API_KEY = process.env.OPEN_TOPO_DATA_API_KEY || 'YOUR_OPEN_TOPO_DATA_API_KEY_PLACEHOLDER';
// Using the SRTM 90m dataset as requested
const OPEN_TOPO_BASE_URL = process.env.OPEN_TOPO_BASE_URL || 'https://api.opentopodata.org/v1/srtm90m';

/**
 * Fetch elevation for a list of coordinates
 * @param {Array} coordinates - Array of [lat, lon]
 * @returns {Promise<Object>} - Cumulative elevation gain
 */
export async function getElevationGain(coordinates) {
  // Ensure exactly 100 sampled coordinates if the route is long
  let sampled = [];
  const maxPoints = 100;

  if (coordinates.length <= maxPoints) {
    sampled = coordinates;
  } else {
    sampled.push(coordinates[0]); // Always start point
    const step = (coordinates.length - 2) / (maxPoints - 2); 
    for (let i = 1; i < maxPoints - 1; i++) {
      sampled.push(coordinates[Math.round(i * step)]);
    }
    sampled.push(coordinates[coordinates.length - 1]); // Always end point
  }

  // Format: lat,lon|lat,lon|lat,lon
  const locations = sampled.map(c => `${c[0]},${c[1]}`).join('|');
  console.log(`[ELEVATION] Requesting ${sampled.length} points in 1 API call for route...`);

  try {
    const params = { locations: locations };
    if (OPEN_TOPO_API_KEY && OPEN_TOPO_API_KEY !== 'YOUR_OPEN_TOPO_DATA_API_KEY_PLACEHOLDER') {
      params.key = OPEN_TOPO_API_KEY;
    }

    const response = await axios.get(OPEN_TOPO_BASE_URL, { params });

    const results = response.data.results;
    let totalGain = 0;
    
    for (let i = 1; i < results.length; i++) {
      const diff = results[i].elevation - results[i - 1].elevation;
      if (diff > 0) totalGain += diff;
    }

    return {
      gain: Math.round(totalGain),
      isDemo: false,
      rawPoints: results.length
    };
  } catch (error) {
    console.error('OpenTopoData API Error:', error.message);
    return {
      gain: 150, // basic fallback
      isDemo: true
    };
  }
}
