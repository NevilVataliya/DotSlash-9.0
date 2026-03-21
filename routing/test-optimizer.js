import { optimizeRoute } from './services/fuelOptimizer.js';
import { fetchRoutes } from './services/valhallaService.js';

async function test() {
  const source = { lat: 21.1702, lng: 72.8311 };
  const destination = { lat: 19.0760, lng: 72.8777 };
  const valhallaResponse = await fetchRoutes([source, destination]);
  const primary = valhallaResponse.primary;
  console.log('Valhalla Primary Distance:', primary.distance);

  const optimized = await optimizeRoute(primary, 'sedan', 'clear');
  console.log('Optimized Fuel Used:', optimized.fuelMetrics.fuelUsed);
}

test();
