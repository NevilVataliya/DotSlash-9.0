// Demo route data for Delhi → Jaipur with stops

export const VEHICLE_PROFILES = [
  {
    id: 'sedan',
    name: 'Sedan',
    icon: '🚗',
    fuelType: 'Petrol',
    baseFuelRate: 7.5, // L/100km
    tankCapacity: 45,
    fuelPrice: 104.21, // ₹ per liter
  },
  {
    id: 'suv',
    name: 'SUV',
    icon: '🚙',
    fuelType: 'Diesel',
    baseFuelRate: 9.8,
    tankCapacity: 60,
    fuelPrice: 90.76,
  },
  {
    id: 'truck',
    name: 'Truck',
    icon: '🚛',
    fuelType: 'Diesel',
    baseFuelRate: 22.0,
    tankCapacity: 200,
    fuelPrice: 90.76,
  },
  {
    id: 'ev',
    name: 'Electric',
    icon: '⚡',
    fuelType: 'Electric',
    baseFuelRate: 15.5, // kWh/100km
    tankCapacity: 75, // kWh
    fuelPrice: 8.0, // ₹ per kWh
  },
  {
    id: 'hatchback',
    name: 'Hatchback',
    icon: '🚘',
    fuelType: 'Petrol',
    baseFuelRate: 5.8,
    tankCapacity: 35,
    fuelPrice: 104.21,
  },
];

export const PREDEFINED_LOCATIONS = [
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
  { name: 'Manesar', lat: 28.3590, lng: 76.9340 },
  { name: 'Neemrana', lat: 27.9881, lng: 76.3844 },
  { name: 'Behror', lat: 27.8879, lng: 76.2890 },
  { name: 'Shahpura', lat: 27.3930, lng: 75.9600 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Kotputli', lat: 27.7042, lng: 76.1988 },
  { name: 'Dharuhera', lat: 28.2070, lng: 76.7960 },
  { name: 'Rewari', lat: 28.1970, lng: 76.6190 },
  { name: 'Alwar', lat: 27.5530, lng: 76.6346 },
];

// Three simulated routes: Fuel-Optimized, Shortest, Fastest
export const DEMO_ROUTES = {
  fuelOptimized: {
    id: 'fuel-optimized',
    label: 'Fuel Optimized',
    description: 'Avoids steep elevation, uses flatter terrain & highway cruise speed',
    color: '#00E676',
    distance: 281,
    duration: 315, // minutes
    fuelMultiplier: 0.82, // 18% savings
    co2Multiplier: 0.82,
    elevationGain: 120,
    coordinates: [
      [28.6139, 77.2090], // Delhi
      [28.5500, 77.1500],
      [28.4595, 77.0266], // Gurugram
      [28.3590, 76.9340], // Manesar
      [28.2070, 76.7960], // Dharuhera
      [27.9881, 76.3844], // Neemrana
      [27.8879, 76.2890], // Behror
      [27.7042, 76.1988], // Kotputli
      [27.3930, 75.9600], // Shahpura
      [27.1500, 75.8800],
      [26.9124, 75.7873], // Jaipur
    ],
    segments: [
      { from: 'New Delhi', to: 'Gurugram', dist: 30, traffic: 'heavy', weather: 'clear', elevation: -5 },
      { from: 'Gurugram', to: 'Manesar', dist: 15, traffic: 'moderate', weather: 'clear', elevation: 10 },
      { from: 'Manesar', to: 'Dharuhera', dist: 22, traffic: 'light', weather: 'clear', elevation: 15 },
      { from: 'Dharuhera', to: 'Neemrana', dist: 45, traffic: 'light', weather: 'partly_cloudy', elevation: 30 },
      { from: 'Neemrana', to: 'Behror', dist: 18, traffic: 'light', weather: 'partly_cloudy', elevation: 5 },
      { from: 'Behror', to: 'Kotputli', dist: 25, traffic: 'light', weather: 'clear', elevation: 10 },
      { from: 'Kotputli', to: 'Shahpura', dist: 45, traffic: 'light', weather: 'clear', elevation: 20 },
      { from: 'Shahpura', to: 'Jaipur', dist: 81, traffic: 'moderate', weather: 'clear', elevation: 35 },
    ],
  },
  shortest: {
    id: 'shortest',
    label: 'Shortest Distance',
    description: 'Minimum distance route through state highways',
    color: '#448AFF',
    distance: 265,
    duration: 330,
    fuelMultiplier: 1.0,
    co2Multiplier: 1.0,
    elevationGain: 280,
    coordinates: [
      [28.6139, 77.2090],
      [28.5000, 77.1000],
      [28.3200, 76.8500],
      [28.1970, 76.6190], // Rewari
      [27.8000, 76.4500],
      [27.5530, 76.6346], // Alwar
      [27.2000, 76.2000],
      [26.9124, 75.7873], // Jaipur
    ],
    segments: [
      { from: 'New Delhi', to: 'Rewari', dist: 82, traffic: 'moderate', weather: 'clear', elevation: -10 },
      { from: 'Rewari', to: 'Alwar', dist: 78, traffic: 'moderate', weather: 'windy', elevation: 140 },
      { from: 'Alwar', to: 'Jaipur', dist: 105, traffic: 'moderate', weather: 'partly_cloudy', elevation: 150 },
    ],
  },
  fastest: {
    id: 'fastest',
    label: 'Fastest',
    description: 'Expressway route, higher speed but more fuel',
    color: '#FF5252',
    distance: 310,
    duration: 270,
    fuelMultiplier: 1.15,
    co2Multiplier: 1.18,
    elevationGain: 190,
    coordinates: [
      [28.6139, 77.2090],
      [28.5800, 77.0800],
      [28.4800, 76.9500],
      [28.3000, 76.7500],
      [28.0500, 76.5000],
      [27.7500, 76.3000],
      [27.4500, 76.0500],
      [27.1500, 75.8500],
      [26.9124, 75.7873],
    ],
    segments: [
      { from: 'New Delhi', to: 'Manesar', dist: 45, traffic: 'heavy', weather: 'clear', elevation: 5 },
      { from: 'Manesar', to: 'Neemrana', dist: 85, traffic: 'light', weather: 'partly_cloudy', elevation: 55 },
      { from: 'Neemrana', to: 'Shahpura', dist: 95, traffic: 'light', weather: 'clear', elevation: 60 },
      { from: 'Shahpura', to: 'Jaipur', dist: 85, traffic: 'moderate', weather: 'clear', elevation: 70 },
    ],
  },
};

export const WEATHER_DATA = {
  clear: { icon: '☀️', label: 'Clear', temp: 32, wind: 8, rain: 0, fuelImpact: 1.0 },
  partly_cloudy: { icon: '⛅', label: 'Partly Cloudy', temp: 29, wind: 14, rain: 10, fuelImpact: 1.02 },
  windy: { icon: '💨', label: 'Windy', temp: 27, wind: 28, rain: 5, fuelImpact: 1.08 },
  rainy: { icon: '🌧️', label: 'Rainy', temp: 24, wind: 18, rain: 75, fuelImpact: 1.12 },
};

export const TRAFFIC_LEVELS = {
  light: { color: '#00E676', label: 'Light', delay: 0, fuelImpact: 1.0 },
  moderate: { color: '#FFD740', label: 'Moderate', delay: 8, fuelImpact: 1.08 },
  heavy: { color: '#FF5252', label: 'Heavy', delay: 22, fuelImpact: 1.25 },
};

// Elevation profile points (distance km, elevation m)
export const ELEVATION_PROFILES = {
  'fuel-optimized': [
    { d: 0, e: 216 }, { d: 30, e: 211 }, { d: 45, e: 221 },
    { d: 67, e: 236 }, { d: 112, e: 266 }, { d: 130, e: 271 },
    { d: 155, e: 281 }, { d: 200, e: 301 }, { d: 281, e: 336 },
  ],
  shortest: [
    { d: 0, e: 216 }, { d: 82, e: 206 }, { d: 120, e: 300 },
    { d: 160, e: 346 }, { d: 200, e: 410 }, { d: 265, e: 496 },
  ],
  fastest: [
    { d: 0, e: 216 }, { d: 45, e: 221 }, { d: 100, e: 260 },
    { d: 180, e: 320 }, { d: 240, e: 370 }, { d: 310, e: 406 },
  ],
};

export function calculateFuelUsage(route, vehicle) {
  const baseFuel = (vehicle.baseFuelRate / 100) * route.distance;
  const totalFuel = baseFuel * route.fuelMultiplier;
  const cost = totalFuel * vehicle.fuelPrice;
  const co2 = vehicle.fuelType === 'Electric'
    ? totalFuel * 0.4 // kg CO2 per kWh (grid average)
    : totalFuel * 2.31; // kg CO2 per liter petrol/diesel
  return {
    fuel: totalFuel.toFixed(1),
    cost: cost.toFixed(0),
    co2: co2.toFixed(1),
    unit: vehicle.fuelType === 'Electric' ? 'kWh' : 'L',
  };
}
