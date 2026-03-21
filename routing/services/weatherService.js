import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OWM_API_KEY = process.env.OPENWEATHER_API_KEY || 'YOUR_OPENWEATHER_API_KEY_PLACEHOLDER';
const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * Fetch real-time weather for a coordinate
 * @param {Number} lat 
 * @param {Number} lon 
 * @returns {Promise<Object>} - Weather condition and fuel multiplier
 */
export async function getWeatherData(lat, lon) {
  if (OWM_API_KEY === 'YOUR_OPENWEATHER_API_KEY_PLACEHOLDER') {
    return {
      condition: 'clear',
      temp: 25,
      windSpeed: 5,
      fuelMultiplier: 1.0,
      isDemo: true
    };
  }

  try {
    const response = await axios.get(OWM_BASE_URL, {
      params: {
        lat: lat,
        lon: lon,
        appid: OWM_API_KEY,
        units: 'metric'
      }
    });

    const weather = response.data;
    const condition = weather.weather[0].main.toLowerCase();
    const windSpeed = weather.wind.speed; // m/s
    
    // Calculate multiplier based on condition and wind
    let multiplier = 1.0;
    
    if (condition.includes('rain') || condition.includes('drizzle')) multiplier = 1.12;
    if (condition.includes('storm')) multiplier = 1.25;
    if (condition.includes('snow')) multiplier = 1.30;
    if (windSpeed > 10) multiplier += (windSpeed - 10) * 0.01; // 1% extra per m/s over 10

    return {
      condition: condition,
      temp: weather.main.temp,
      windSpeed: windSpeed,
      fuelMultiplier: parseFloat(multiplier.toFixed(2)),
      isDemo: false
    };
  } catch (error) {
    console.error('OpenWeatherMap API Error:', error.message);
    return {
      condition: 'clear',
      temp: 20,
      windSpeed: 0,
      fuelMultiplier: 1.0,
      isDemo: true
    };
  }
}
