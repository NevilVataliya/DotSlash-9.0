// Vehicle profiles, weather constants, and demo data for the routing service

export const VEHICLE_PROFILES = [
  {
    id: 'sedan',
    name: 'Sedan',
    fuelType: 'Petrol',
    baseFuelRate: 7.5, // L/100km
    tankCapacity: 45,
    fuelPrice: 104.21, // ₹ per liter
    weightFactor: 1.0,
    dragCoefficient: 0.28,
  },
  {
    id: 'suv',
    name: 'SUV',
    fuelType: 'Diesel',
    baseFuelRate: 9.8,
    tankCapacity: 60,
    fuelPrice: 90.76,
    weightFactor: 1.4,
    dragCoefficient: 0.35,
  },
  {
    id: 'truck',
    name: 'Truck',
    fuelType: 'Diesel',
    baseFuelRate: 22.0,
    tankCapacity: 200,
    fuelPrice: 90.76,
    weightFactor: 4.5,
    dragCoefficient: 0.70,
  },
  {
    id: 'ev',
    name: 'Electric',
    fuelType: 'Electric',
    baseFuelRate: 15.5, // kWh/100km
    tankCapacity: 75,
    fuelPrice: 8.0, // ₹ per kWh
    weightFactor: 1.2,
    dragCoefficient: 0.24,
  },
];

export const WEATHER_IMPACT = {
  clear: { fuelMultiplier: 1.0, description: 'No impact' },
  rain: { fuelMultiplier: 1.12, description: 'Increased rolling resistance and AC usage' },
  windy: { fuelMultiplier: 1.08, description: 'Increased aerodynamic drag' },
  hot: { fuelMultiplier: 1.05, description: 'Increased AC usage' },
};

// Demo/Fallback elevation data if API fails (elevation in meters at 10% increments of distance)
export const DEFAULT_ELEVATION_PROFILE = [
  216, 225, 240, 235, 220, 250, 280, 260, 290, 310, 336
];
