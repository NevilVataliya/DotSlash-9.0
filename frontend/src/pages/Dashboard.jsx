import { useState, useCallback } from 'react';
import axios from 'axios';
import MapView from '../components/MapView';
import RouteInput from '../components/RouteInput';
import RouteComparison from '../components/RouteComparison';
import DataDashboard from '../components/DataDashboard';
import RidePool from '../components/RidePool';
import InstallAppButton from '../components/InstallAppButton';
import NavigationInstructions from '../components/NavigationInstructions';
import { VEHICLE_PROFILES, PREDEFINED_LOCATIONS } from '../data/demoData';
import { createRoutePlanSignature, loadLatestOfflineRoute, loadOfflineRouteBySignature, saveOfflineRoutePlan } from '../utils/offlineRouteStore';
import { createNavigationInstructions, generateOfflineRoutes } from '../utils/offlineRouting';
import { prefetchTilesForRoutes } from '../utils/offlineMapCache';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const BACKEND_URL = 'http://localhost:3001/api/route';

const ROUTE_CONFIG = {
  fuelOptimized: { id: 'fuel-optimized', label: 'Fuel Optimized', color: '#00E676', desc: 'Optimized for minimal fuel consumption & CO2 emissions' },
  fastest: { id: 'fastest', label: 'Fastest', color: '#FF5252', desc: 'Express route prioritized for minimum travel time' },
  shortest: { id: 'shortest', label: 'Shortest Distance', color: '#448AFF', desc: 'The most direct path with minimum total distance' },
  leastCo2: { id: 'least-co2', label: 'Least CO₂', color: '#7C4DFF', desc: 'Route with the lowest carbon dioxide emissions' }
};

export default function Dashboard() {
  const isOnline = useOnlineStatus();
  const { canInstall, promptInstall } = useInstallPrompt();

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
  const [routeSource, setRouteSource] = useState(null);
  const [cacheBanner, setCacheBanner] = useState('');

  const vehicle = VEHICLE_PROFILES.find(v => v.id === vehicleId) || VEHICLE_PROFILES[0];

  const enrichRoutesWithInstructions = useCallback((routeSet) => {
    if (!routeSet) return routeSet;

    const cloned = { ...routeSet };
    Object.keys(cloned).forEach((key) => {
      const route = cloned[key];
      if (!route.instructions || !route.instructions.length) {
        cloned[key] = {
          ...route,
          instructions: createNavigationInstructions(route),
        };
      }
    });
    return cloned;
  }, []);

  const transformBackendRoutes = useCallback((backendData) => {
    const transformedRoutes = {};

    Object.keys(backendData || {}).forEach((key) => {
      const route = backendData[key];
      const config = ROUTE_CONFIG[key];
      if (!config) return;

      transformedRoutes[config.id] = {
        ...route,
        id: config.id,
        label: config.label,
        description: config.desc,
        color: config.color,
        elevationGain: route.fuelMetrics?.elevationGain ?? route.elevationGain ?? 0,
        fuelUsed: route.fuelMetrics?.fuelUsed ?? route.fuelUsed ?? 0,
        cost: route.fuelMetrics?.cost ?? route.cost ?? 0,
        co2: route.fuelMetrics?.co2 ?? route.co2 ?? 0,
        unit: route.fuelMetrics?.fuelUnit ?? route.unit,
      };
    });

    return enrichRoutesWithInstructions(transformedRoutes);
  }, [enrichRoutesWithInstructions]);

  const warmOfflineMapCache = useCallback(async (routeSet) => {
    const result = await prefetchTilesForRoutes(routeSet, { zooms: [10, 11, 12], radius: 1, maxTiles: 650 });
    if (!result.plannedTiles) return;

    setCacheBanner(`Offline map pack ready (${result.cachedTiles}/${result.plannedTiles} tiles cached)`);
  }, []);

  const handlePlanRoute = useCallback(async () => {
    // Basic validation
    if (!source || !destination) {
      alert('Please select both a source and a destination.');
      return;
    }

    setIsLoading(true);
    setRoutes(null);
    setSelectedRoute(null);
    setRouteSource(null);
    setCacheBanner('');

    const signature = createRoutePlanSignature({ source, destination, stops, vehicleId });

    try {
      if (!isOnline) {
        throw new Error('offline');
      }

      const response = await axios.post(BACKEND_URL, {
        source,
        destination,
        stops,
        vehicleId,
        weather: 'clear' // Can be dynamic later
      });

      const backendData = response.data;
      const transformedRoutes = transformBackendRoutes(backendData);

      setRoutes(transformedRoutes);
      setSelectedRoute('fuel-optimized');
      setRouteSource('online');

      saveOfflineRoutePlan({
        signature,
        routes: transformedRoutes,
        selectedRoute: 'fuel-optimized',
        source,
        destination,
        stops,
        vehicleId,
      });

      warmOfflineMapCache(transformedRoutes);
    } catch (error) {
      console.error('Error planning route:', error);

      const exactCached = loadOfflineRouteBySignature(signature);
      const latestCached = loadLatestOfflineRoute();
      const cachedPlan = exactCached || latestCached;

      if (cachedPlan?.routes) {
        const cachedRoutes = enrichRoutesWithInstructions(cachedPlan.routes);
        setRoutes(cachedRoutes);
        setSelectedRoute(cachedPlan.selectedRoute || Object.keys(cachedRoutes)[0]);
        setRouteSource(exactCached ? 'offline-cache-match' : 'offline-cache-last');
        return;
      }

      const generatedRoutes = generateOfflineRoutes({ source, destination, stops, vehicleId });

      if (generatedRoutes) {
        const withInstructions = enrichRoutesWithInstructions(generatedRoutes);
        setRoutes(withInstructions);
        setSelectedRoute('fuel-optimized');
        setRouteSource('offline-generated');

        saveOfflineRoutePlan({
          signature,
          routes: withInstructions,
          selectedRoute: 'fuel-optimized',
          source,
          destination,
          stops,
          vehicleId,
        });

        return;
      }

      alert('Route planning failed and no offline route is available for this trip yet.');
    } finally {
      setIsLoading(false);
    }
  }, [source, destination, stops, vehicleId, isOnline, transformBackendRoutes, warmOfflineMapCache, enrichRoutesWithInstructions]);

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

        <InstallAppButton canInstall={canInstall} onInstall={promptInstall} />

        {!isOnline && (
          <div className="connection-banner offline">
            Offline mode active. Using cached routes, map tiles, and saved navigation instructions.
          </div>
        )}

        {routeSource && (
          <div className="connection-banner info">
            {routeSource === 'online' && 'Route fetched from live routing service and saved for offline use.'}
            {routeSource === 'offline-cache-match' && 'Using offline route pack for this exact trip.'}
            {routeSource === 'offline-cache-last' && 'Using your most recent offline route pack.'}
            {routeSource === 'offline-generated' && 'Using offline estimated route because live service is unavailable.'}
          </div>
        )}

        {cacheBanner && <div className="connection-banner success">{cacheBanner}</div>}

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

            {routes && (
              <NavigationInstructions route={activeRoute} isOnline={isOnline} />
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
