import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchRoutes } from './services/valhallaService.js';
import { optimizeRoute } from './services/fuelOptimizer.js';

import { fetchTomTomRoute } from './services/tomtomService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Routing Service is active. Use POST /api/route to calculate routes.');
});

app.post('/api/route', async (req, res) => {
  const { source, destination, stops = [], vehicleId = 'sedan', weather = 'clear' } = req.body;

  if (!source || !destination) {
    return res.status(400).json({ error: 'Source and Destination are required' });
  }

  try {
    const locations = [source, ...stops, destination];

    console.log('--- Initiating Multi-Engine Routing ---');

    // 1. Fetch from Valhalla (or Mock)
    console.log('Engine 1: Fetching Valhalla/Mock routes...');
    const valhallaResponse = await fetchRoutes(locations);
    const valhallaCandidates = [valhallaResponse.primary, ...valhallaResponse.alternates];

    // 2. Fetch from TomTom (Fastest & Shortest)
    console.log('Engine 2: Fetching TomTom real-time routes...');
    let tomTomCandidates = [];
    try {
      const ttFastest = await fetchTomTomRoute(locations, 'fastest');
      const ttShortest = await fetchTomTomRoute(locations, 'shortest');
      tomTomCandidates = [ttFastest, ttShortest];
      console.log('--- [SUCCESS] TomTom routes retrieved via provided API Key. ---');
    } catch (e) {
      console.error('--- [ERROR] TomTom Routing failed, relying on Valhalla/Mock only. ---');
    }

    // 3. Combine and Optimize all candidates
    console.log('Optimizing all candidates for fuel usage...');
    const allCandidates = [...valhallaCandidates, ...tomTomCandidates];
    const optimizedRoutes = await Promise.all(
      allCandidates.map(route => optimizeRoute(route, vehicleId, weather))
    );

    // 4. Select the winners for each category
    // Lowest Time (Fastest)
    const fastest = [...optimizedRoutes].sort((a, b) => a.duration - b.duration)[0];

    // Lowest Distance (Shortest)
    const shortest = [...optimizedRoutes].sort((a, b) => a.distance - b.distance)[0];

    // Lowest Fuel Usage (Fuel Optimized)
    const fuelOptimized = [...optimizedRoutes].sort((a, b) =>
      parseFloat(a.fuelMetrics.fuelUsed) - parseFloat(b.fuelMetrics.fuelUsed)
    )[0];

    // Lowest CO2 Emissions (Least CO2)
    const leastCo2 = [...optimizedRoutes].sort((a, b) =>
      parseFloat(a.fuelMetrics.co2) - parseFloat(b.fuelMetrics.co2)
    )[0];

    // Calculate CO2 Savings for each route vs the worst performer
    const maxCo2 = Math.max(...optimizedRoutes.map(r => parseFloat(r.fuelMetrics.co2)));
    fuelOptimized.fuelMetrics.co2Savings = (maxCo2 - parseFloat(fuelOptimized.fuelMetrics.co2)).toFixed(2);
    leastCo2.fuelMetrics.co2Savings = (maxCo2 - parseFloat(leastCo2.fuelMetrics.co2)).toFixed(2);

    console.log(`SUCCESS: Best routes selected. (Fastest Source: ${fastest.source})`);

    res.json({
      fastest: { ...fastest, label: 'Fastest' },
      shortest: { ...shortest, label: 'Shortest' },
      fuelOptimized: { ...fuelOptimized, label: 'Fuel Optimized' },
      leastCo2: { ...leastCo2, label: 'Least CO₂' }
    });

  } catch (error) {
    console.error('Routing Error:', error.message);
    res.status(500).json({ error: error.message || 'Internal Routing Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Routing service successfully started.`);
  console.log(`Endpoint: http://localhost:${PORT}/api/route`);
  console.log('--- Ready for requests ---');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port.`);
  } else {
    console.error('Server failed to start:', err.message);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  process.exit(1);
});
