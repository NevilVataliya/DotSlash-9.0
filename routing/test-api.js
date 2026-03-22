import axios from 'axios';

const ROUTING_API_URL = process.env.ROUTING_API_URL;

if (!ROUTING_API_URL) {
  throw new Error('ROUTING_API_URL is not set. Configure it in your environment before running this script.');
}

const data = {
  source: { lat: 21.1702, lng: 72.8311 }, // Surat, India
  destination: { lat: 19.0760, lng: 72.8777 }, // Mumbai, India
  stops: [],
  vehicleId: 'sedan',
  weather: 'clear'
};

console.log(`Sending request to ${ROUTING_API_URL}...`);
axios.post(ROUTING_API_URL, data)
  .then(response => {
    console.log('SUCCESS: API response received.');
    console.log(`--- FASTEST ROUTE SUMMARY (Source: ${response.data.fastest.source}) ---`);
    console.log(`Distance: ${response.data.fastest.distance.toFixed(1)} km`);
    console.log(`Time: ${Math.round(response.data.fastest.duration)} mins`);
    console.log(`Fuel Used: ${response.data.fastest.fuelMetrics.fuelUsed} ${response.data.fastest.fuelMetrics.fuelUnit}`);
    console.log('--- FULL RESPONSE (PREVIEW) ---');
    const preview = JSON.stringify(response.data, null, 2);
    console.log(preview.length > 1000 ? preview.substring(0, 1000) + '...' : preview);
    process.exit(0);
  })
  .catch(error => {
    console.error('API Error:', error.message || error);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('The request was made but no response was received. Is the server running?');
    }
    process.exit(1);
  });
