import { useState, useCallback } from 'react';
import MapView from './components/MapView';
import RouteInput from './components/RouteInput';
import RouteComparison from './components/RouteComparison';
import DataDashboard from './components/DataDashboard';
import { VEHICLE_PROFILES, DEMO_ROUTES, PREDEFINED_LOCATIONS } from './data/demoData';

export default function App() {
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

  const handlePlanRoute = useCallback(() => {
    setIsLoading(true);
    setRoutes(null);
    setSelectedRoute(null);

    // Simulate API delay
    setTimeout(() => {
      // Auto-set source/destination for demo if using predefined locations
      if (!source) {
        setSource(PREDEFINED_LOCATIONS[0]); // Delhi
      }
      if (!destination) {
        setDestination(PREDEFINED_LOCATIONS[6]); // Jaipur
      }

      setRoutes(DEMO_ROUTES);
      setSelectedRoute('fuel-optimized');
      setIsLoading(false);
    }, 1500);
  }, [source, destination]);

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
      </div>

      {/* Bottom data dashboard */}
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
    </div>
  );
}
