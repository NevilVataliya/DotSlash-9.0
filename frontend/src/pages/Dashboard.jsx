import { useState, useCallback } from 'react';
import axios from 'axios';
import MapView from '../components/MapView';
import RouteInput from '../components/RouteInput';
import RouteComparison from '../components/RouteComparison';
import DataDashboard from '../components/DataDashboard';
import RidePool from '../components/RidePool';
import { VEHICLE_PROFILES, PREDEFINED_LOCATIONS } from '../data/demoData';

const BACKEND_URL = 'http://localhost:3001/api/route';

const ROUTE_CONFIG = {
  fuelOptimized: { id: 'fuel-optimized', label: 'Fuel Optimized', color: '#00E676', desc: 'Optimized for minimal fuel consumption & CO2 emissions' },
  fastest: { id: 'fastest', label: 'Fastest', color: '#FF5252', desc: 'Express route prioritized for minimum travel time' },
  shortest: { id: 'shortest', label: 'Shortest Distance', color: '#448AFF', desc: 'The most direct path with minimum total distance' }
};

export default function Dashboard() {
  // Navigation state
  const [activeTab, setActiveTab] = useState('route'); // 'route' | 'pool'

  // Route input state
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [stops, setStops] = useState([]);
  const [vehicleId, setVehicleId] = useState('sedan');

  // Planning state
  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDashboard, setShowDashboard] = useState(true);

  const vehicle = VEHICLE_PROFILES.find(v => v.id === vehicleId) || VEHICLE_PROFILES[0];

  const handlePlanRoute = useCallback(async () => {
    // Basic validation
    if (!source || !destination) {
      alert('Please select both a source and a destination.');
      return;
    }

    setIsLoading(true);
    setRoutes(null);
    setSelectedRoute(null);

    try {
      const response = await axios.post(BACKEND_URL, {
        source,
        destination,
        stops,
        vehicleId,
        weather: 'clear' // Can be dynamic later
      });

      const backendData = response.data;
      const transformedRoutes = {};

      // Transform backend keys to frontend format
      Object.keys(backendData).forEach(key => {
        const route = backendData[key];
        const config = ROUTE_CONFIG[key];

        transformedRoutes[config.id] = {
          ...route,
          id: config.id,
          label: config.label,
          description: config.desc,
          color: config.color,
          // Extract specific metrics for UI
          elevationGain: route.fuelMetrics.elevationGain,
          fuelUsed: route.fuelMetrics.fuelUsed,
          cost: route.fuelMetrics.cost,
          co2: route.fuelMetrics.co2,
          unit: route.fuelMetrics.fuelUnit
        };
      });

      setRoutes(transformedRoutes);
      setSelectedRoute('fuel-optimized');
    } catch (error) {
      console.error('Error planning route:', error);
      alert('Failed to connect to the routing service. Is the backend running on port 3001?');
    } finally {
      setIsLoading(false);
    }
  }, [source, destination, stops, vehicleId]);

  const handleSelectRoute = useCallback((routeId) => {
    setSelectedRoute(routeId);
  }, []);

  const activeRoute = routes && selectedRoute ? routes[selectedRoute] : null;

  return (
    <div className="app">
      {/* Full-screen map */}
      <MapView
        routes={routes}
        selectedRoute={selectedRoute}
        source={source || (routes ? PREDEFINED_LOCATIONS[0] : null)}
        destination={destination || (routes ? PREDEFINED_LOCATIONS[6] : null)}
        stops={stops}
        onSelectRoute={handleSelectRoute}
      />

      {/* Left sidebar */}
      <div className="sidebar">
        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'route' ? 'active' : ''}`}
            onClick={() => setActiveTab('route')}
          >
            Smart Route
          </button>
          <button
            className={`nav-tab ${activeTab === 'pool' ? 'active' : ''}`}
            onClick={() => setActiveTab('pool')}
          >
            Ride Pool
          </button>
        </div>

        {activeTab === 'route' ? (
          <>
            <RouteInput
              source={source}
              setSource={setSource}
              destination={destination}
              setDestination={setDestination}
              stops={stops}
              setStops={setStops}
              vehicleId={vehicleId}
              setVehicleId={setVehicleId}
              vehicles={VEHICLE_PROFILES}
              onPlanRoute={handlePlanRoute}
              isLoading={isLoading}
            />

            {routes && (
              <RouteComparison
                routes={routes}
                selectedRoute={selectedRoute}
                onSelectRoute={handleSelectRoute}
                vehicle={vehicle}
              />
            )}
          </>
        ) : (
          <div className="panel animate-slide-in">
            <RidePool />
          </div>
        )}
      </div>

      {/* Bottom data dashboard - only show for route tab */}
      {activeTab === 'route' && (
        <>
          <DataDashboard
            route={activeRoute}
            vehicle={vehicle}
            show={showDashboard && !!routes}
          />

          {/* Dashboard toggle */}
          {routes && (
            <button
              className="dashboard-toggle"
              onClick={() => setShowDashboard(!showDashboard)}
              title={showDashboard ? 'Hide dashboard' : 'Show dashboard'}
            >
              {showDashboard ? '▼' : '▲'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
