import { VEHICLE_PROFILES } from '../data/configData.js';
import { getRouteTrafficMultiplier } from './tomtomService.js';
import { getWeatherData } from './weatherService.js';
import { getElevationGain } from './elevationService.js';

/**
 * Calculate refined fuel and environmental metrics for a route
 * @param {Object} route - Route from Valhalla or TomTom
 * @param {String} vehicleId 
 * @param {String} weatherOverride - Optional manual override
 * @returns {Promise<Object>} - Enriched route with live fuel metrics
 */
export async function optimizeRoute(route, vehicleId = 'sedan', weatherOverride = null) {
  const vehicle = VEHICLE_PROFILES.find(v => v.id === vehicleId) || VEHICLE_PROFILES[0];
  
  const distance = route.distance;
  const baseFuel = (vehicle.baseFuelRate / 100) * distance;

  // 1. Live Weather Factor
  // Fetch weather for the starting point
  const startPoint = route.coordinates[0];
  const weatherData = await getWeatherData(startPoint[0], startPoint[1]);
  const weatherMultiplier = weatherOverride ? 1.0 : weatherData.fuelMultiplier;

  // 2. Real-Time Traffic Factor
  const trafficMultiplier = await getRouteTrafficMultiplier(route.coordinates);

  // 3. Live Elevation Factor
  const elevationData = await getElevationGain(route.coordinates);
  const elevationGain = elevationData.gain;
  const elevationMultiplier = 1 + (elevationGain * 0.001); // 0.1% extra per meter of gain

  // 4. Vehicle Factors (Aerodynamics and Weight)
  const avgSpeed = (distance / (route.duration / 60)) || 60;
  const dragFactor = 1 + (avgSpeed > 80 ? (avgSpeed - 80) * 0.01 * vehicle.dragCoefficient : 0);
  
  const totalMultiplier = trafficMultiplier * weatherMultiplier * elevationMultiplier * dragFactor;
  const totalFuel = baseFuel * totalMultiplier;
  
  const cost = totalFuel * vehicle.fuelPrice;
  const co2 = vehicle.fuelType === 'Electric'
    ? totalFuel * 0.4 
    : totalFuel * 2.31;

  let trafficLabel = 'light';
  if (trafficMultiplier >= 1.08) trafficLabel = 'moderate';
  if (trafficMultiplier >= 1.25) trafficLabel = 'heavy';

  let weatherLabel = 'clear';
  const cond = (weatherData.condition || '').toLowerCase();
  if (cond.includes('cloud')) weatherLabel = 'partly_cloudy';
  else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('storm') || cond.includes('snow')) weatherLabel = 'rainy';
  else if (cond.includes('wind')) weatherLabel = 'windy';

  const generatedSegments = route.segments || [{
    from: 'Origin',
    to: 'Destination',
    dist: Math.round(distance),
    traffic: trafficLabel,
    weather: weatherLabel,
    elevation: Math.round(elevationGain)
  }];

  return {
    ...route,
    segments: generatedSegments,
    fuelMetrics: {
      fuelUsed: totalFuel.toFixed(2),
      fuelUnit: vehicle.fuelType === 'Electric' ? 'kWh' : 'L',
      cost: Math.round(cost),
      co2: co2.toFixed(2),
      elevationGain: Math.round(elevationGain),
      trafficImpact: trafficMultiplier.toFixed(2),
      weatherImpact: weatherMultiplier.toFixed(2),
      dataSource: {
        weather: weatherData.isDemo ? 'Demo (No Key)' : 'OpenWeatherMap',
        elevation: elevationData.isDemo ? 'Demo/Mock' : 'OpenTopoData',
        traffic: 'TomTom'
      }
    }
  };
}
