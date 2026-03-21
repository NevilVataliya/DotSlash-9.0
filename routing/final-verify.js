import axios from 'axios';

const data = {
  source: { lat: 21.1702, lng: 72.8311 },
  destination: { lat: 19.0760, lng: 72.8777 },
  stops: [],
  vehicleId: 'sedan',
  weather: 'clear'
};

async function test() {
  try {
    const start = Date.now();
    console.log('Testing connection to http://localhost:3001/api/route...');
    const response = await axios.post('http://localhost:3001/api/route', data);
    const end = Date.now();
    console.log(`SUCCESS! Response received in ${end - start}ms`);
    console.log('Routes returned:', Object.keys(response.data));
    console.log('Fuel Optimized Info:', {
      dist: response.data.fuelOptimized?.distance,
      fuel: response.data.fuelOptimized?.fuelMetrics?.fuelUsed,
      source: response.data.fuelOptimized?.fuelMetrics?.dataSource
    });
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

test();
