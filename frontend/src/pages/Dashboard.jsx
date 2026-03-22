import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import MapView from '../components/MapView';
import RouteInput from '../components/RouteInput';
import RouteComparison from '../components/RouteComparison';
import DataDashboard from '../components/DataDashboard';
import RidePool from '../components/RidePool';
import UserProfile from '../components/UserProfile';
import InstallAppButton from '../components/InstallAppButton';
import NavigationInstructions from '../components/NavigationInstructions';
import { VEHICLE_PROFILES, PREDEFINED_LOCATIONS } from '../data/demoData';
import { distanceToRoute } from '../utils/routeUtils';
import { createRoutePlanSignature, loadLatestOfflineRoute, loadOfflineRouteBySignature, saveOfflineRoutePlan } from '../utils/offlineRouteStore';
import { createNavigationInstructions, generateOfflineRoutes } from '../utils/offlineRouting';
import { prefetchTilesForRoutes } from '../utils/offlineMapCache';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const BACKEND_URL = import.meta.env.VITE_ROUTING_API_URL || '/api/route';

// How far off-route (meters) before re-routing triggers
const REROUTE_THRESHOLD_M = 100;
// How long (ms) user must be off-route before we re-route
const REROUTE_DELAY_MS = 5000;

const ROUTE_CONFIG = {
  fuelOptimized: { id: 'fuel-optimized', label: 'Fuel Optimized', color: '#00E676', desc: 'Optimized for minimal fuel consumption & CO2 emissions' },
  fastest: { id: 'fastest', label: 'Fastest', color: '#FF5252', desc: 'Express route prioritized for minimum travel time' },
  shortest: { id: 'shortest', label: 'Shortest Distance', color: '#448AFF', desc: 'The most direct path with minimum total distance' },
  leastCo2: { id: 'least-co2', label: 'Least CO₂', color: '#7C4DFF', desc: 'Route with the lowest carbon dioxide emissions' }
};

export default function Dashboard() {
  const isOnline = useOnlineStatus();
  const { canInstall, promptInstall } = useInstallPrompt();

  const [activeTab, setActiveTab] = useState('route');

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

  // Journey / GPS state
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const watchIdRef = useRef(null);

  // Re-routing state
  const [rerouteStatus, setRerouteStatus] = useState(null); // null | 'detecting' | 'rerouting' | 'done'
  const offRouteTimerRef = useRef(null);
  const isReroutingRef = useRef(false);

  // Keep live refs to routes/selectedRoute for use inside GPS callback
  const routesRef = useRef(null);
  const selectedRouteRef = useRef(null);
  const vehicleIdRef = useRef('sedan');
  const destinationRef = useRef(null);
  const stopsRef = useRef([]);

  // Sync refs whenever state changes
  useEffect(() => { routesRef.current = routes; }, [routes]);
  useEffect(() => { selectedRouteRef.current = selectedRoute; }, [selectedRoute]);
  useEffect(() => { vehicleIdRef.current = vehicleId; }, [vehicleId]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);
  useEffect(() => { stopsRef.current = stops; }, [stops]);

  // Bottom Sheet state with improved snap points
  const SNAP_POINTS = {
    FULL: 85,      // Full expanded view
    HALF: 50,      // Half screen - default comfortable view
    PEEK: 25,      // Peek mode - shows tabs and minimal content
    MINI: 12       // Minimized - just the handle visible
  };
  
  const [sheetHeight, setSheetHeight] = useState(SNAP_POINTS.HALF);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(SNAP_POINTS.HALF);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);

  const handlePointerDown = (e) => {
    if (e.target.closest('.sidebar-handle') || e.target.closest('.nav-tabs')) {
      isDragging.current = true;
      setIsDraggingSheet(true);
      startY.current = e.clientY;
      lastY.current = e.clientY;
      lastTime.current = Date.now();
      startHeight.current = sheetHeight;
      velocity.current = 0;
      if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
    }
  };
  
  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    
    const currentY = e.clientY;
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime.current;
    
    // Calculate velocity (pixels per millisecond)
    if (deltaTime > 0) {
      velocity.current = (currentY - lastY.current) / deltaTime;
    }
    
    lastY.current = currentY;
    lastTime.current = currentTime;
    
    const deltaY = currentY - startY.current;
    const vhDelta = (deltaY / window.innerHeight) * 100;
    let newHeight = startHeight.current - vhDelta;
    
    // Clamp with rubber-band effect at edges
    if (newHeight > SNAP_POINTS.FULL) {
      const overflow = newHeight - SNAP_POINTS.FULL;
      newHeight = SNAP_POINTS.FULL + overflow * 0.2; // Rubber-band resistance
    }
    if (newHeight < SNAP_POINTS.MINI) {
      const underflow = SNAP_POINTS.MINI - newHeight;
      newHeight = SNAP_POINTS.MINI - underflow * 0.2;
    }
    
    setSheetHeight(newHeight);
  };
  
  const handlePointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingSheet(false);
    if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
    
    // Velocity threshold for flick gestures (pixels per ms)
    const VELOCITY_THRESHOLD = 0.5;
    const currentVelocity = velocity.current;
    
    let targetSnap;
    
    // Fast flick detection - let velocity override position
    if (Math.abs(currentVelocity) > VELOCITY_THRESHOLD) {
      if (currentVelocity > 0) {
        // Swiping down (closing)
        if (sheetHeight > SNAP_POINTS.HALF) targetSnap = SNAP_POINTS.HALF;
        else if (sheetHeight > SNAP_POINTS.PEEK) targetSnap = SNAP_POINTS.PEEK;
        else targetSnap = SNAP_POINTS.MINI;
      } else {
        // Swiping up (opening)
        if (sheetHeight < SNAP_POINTS.PEEK) targetSnap = SNAP_POINTS.PEEK;
        else if (sheetHeight < SNAP_POINTS.HALF) targetSnap = SNAP_POINTS.HALF;
        else targetSnap = SNAP_POINTS.FULL;
      }
    } else {
      // Slow drag - snap to nearest point
      const snapPoints = [SNAP_POINTS.MINI, SNAP_POINTS.PEEK, SNAP_POINTS.HALF, SNAP_POINTS.FULL];
      targetSnap = snapPoints.reduce((prev, curr) => 
        Math.abs(curr - sheetHeight) < Math.abs(prev - sheetHeight) ? curr : prev
      );
    }
    
    setSheetHeight(targetSnap);
  };
  
  // Quick toggle function for minimize button
  const toggleSheet = () => {
    if (sheetHeight <= SNAP_POINTS.PEEK) {
      setSheetHeight(SNAP_POINTS.HALF);
    } else {
      setSheetHeight(SNAP_POINTS.PEEK);
    }
  };
  
  // Double-tap handle to fully expand/collapse
  const lastTapTime = useRef(0);
  const handleHandleClick = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap detected
      if (sheetHeight >= SNAP_POINTS.FULL - 5) {
        setSheetHeight(SNAP_POINTS.PEEK);
      } else {
        setSheetHeight(SNAP_POINTS.FULL);
      }
    }
    lastTapTime.current = now;
  };

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

  // ──────────────────────────────────────────────
  // Dynamic re-routing
  // ──────────────────────────────────────────────
  const executeReroute = useCallback(async (lat, lng) => {
    if (isReroutingRef.current) return;
    const dest = destinationRef.current;
    if (!dest) return;

    isReroutingRef.current = true;
    setRerouteStatus('rerouting');

    const currentSource = {
      lat,
      lng,
      name: 'Current Location'
    };

    try {
      const response = await axios.post(BACKEND_URL, {
        source: currentSource,
        destination: dest,
        stops: stopsRef.current,
        vehicleId: vehicleIdRef.current,
        weather: 'clear'
      });
      const transformed = transformRoutes(response.data);
      setRoutes(transformed);
      // Keep the same route type the user had selected
      const prevSelected = selectedRouteRef.current;
      if (prevSelected && transformed[prevSelected]) {
        setSelectedRoute(prevSelected);
      } else {
        setSelectedRoute('fuel-optimized');
      }
      setRerouteStatus('done');
      // Clear "done" banner after 2.5s
      setTimeout(() => setRerouteStatus(null), 2500);
    } catch (err) {
      console.error('Re-routing failed:', err);
      setRerouteStatus(null);
    } finally {
      isReroutingRef.current = false;
    }
  }, []);

  // Called on every GPS position update during a journey
  const checkDeviation = useCallback((lat, lng) => {
    const currentRoutes = routesRef.current;
    const currentSelected = selectedRouteRef.current;
    if (!currentRoutes || !currentSelected) return;

    const activeRoute = currentRoutes[currentSelected];
    if (!activeRoute?.coordinates) return;

    const distOff = distanceToRoute(lat, lng, activeRoute.coordinates);

    if (distOff > REROUTE_THRESHOLD_M) {
      // User is off-route
      if (!offRouteTimerRef.current && !isReroutingRef.current) {
        setRerouteStatus('detecting');
        offRouteTimerRef.current = setTimeout(() => {
          offRouteTimerRef.current = null;
          executeReroute(lat, lng);
        }, REROUTE_DELAY_MS);
      }
    } else {
      // Back on route — cancel any pending re-route
      if (offRouteTimerRef.current) {
        clearTimeout(offRouteTimerRef.current);
        offRouteTimerRef.current = null;
        setRerouteStatus(null);
      }
    }
  }, [executeReroute]);

  // ──────────────────────────────────────────────
  // Journey handlers
  // ──────────────────────────────────────────────
  const handleStopJourney = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (offRouteTimerRef.current) {
      clearTimeout(offRouteTimerRef.current);
      offRouteTimerRef.current = null;
    }
    isReroutingRef.current = false;
    setIsJourneyActive(false);
    setUserPosition(null);
    setRerouteStatus(null);
  }, []);

  const handleStartJourney = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsJourneyActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserPosition({ lat, lng });
        checkDeviation(lat, lng);
      },
      (err) => {
        console.error('GPS error:', err);
        if (err.code === 1) {
          alert('Location permission denied. Please allow location access and try again.');
          handleStopJourney();
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, [checkDeviation, handleStopJourney]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (offRouteTimerRef.current) clearTimeout(offRouteTimerRef.current);
    };
  }, []);

  const activeRoute = routes && selectedRoute ? routes[selectedRoute] : null;
  const translateY = 90 - sheetHeight;

  return (
    <div className="app" style={{ '--translate-y': `${translateY}vh` }}>
      {/* Floating User Profile Widget */}
      <UserProfile />

      {/* Full-screen map */}
      <MapView
        routes={routes}
        selectedRoute={selectedRoute}
        source={source || (routes ? PREDEFINED_LOCATIONS[0] : null)}
        destination={destination || (routes ? PREDEFINED_LOCATIONS[6] : null)}
        stops={stops}
        onSelectRoute={handleSelectRoute}
        userPosition={userPosition}
      />

      {/* Left sidebar / Bottom sheet on mobile */}
      <div
        className={`sidebar ${isDraggingSheet ? 'is-dragging' : ''}`}
        style={{ '--sheet-vh': `${sheetHeight}vh` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Drag handle with visual feedback */}
        <div 
          className="sidebar-handle" 
          onClick={handleHandleClick}
          aria-label="Drag to resize panel"
        >
          <span className="handle-indicator"></span>
        </div>
        
        {/* Snap point indicators (visible during drag) */}
        {isDraggingSheet && (
          <div className="snap-indicators">
            <div className={`snap-line ${sheetHeight >= SNAP_POINTS.FULL - 3 ? 'active' : ''}`} style={{ bottom: `${SNAP_POINTS.FULL}%` }} />
            <div className={`snap-line ${Math.abs(sheetHeight - SNAP_POINTS.HALF) < 3 ? 'active' : ''}`} style={{ bottom: `${SNAP_POINTS.HALF}%` }} />
            <div className={`snap-line ${Math.abs(sheetHeight - SNAP_POINTS.PEEK) < 3 ? 'active' : ''}`} style={{ bottom: `${SNAP_POINTS.PEEK}%` }} />
          </div>
        )}
        
        <div className="nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
            <button className={`nav-tab ${activeTab === 'route' ? 'active' : ''}`} onClick={() => setActiveTab('route')}>
              Smart Route
            </button>
            <button className={`nav-tab ${activeTab === 'pool' ? 'active' : ''}`} onClick={() => setActiveTab('pool')}>
              Ride Pool
            </button>
          </div>
          <button className="minimize-btn" onClick={toggleSheet} title="Toggle Panel">
            {sheetHeight <= SNAP_POINTS.PEEK ? '▲' : '▼'}
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
              source={source} setSource={setSource}
              destination={destination} setDestination={setDestination}
              stops={stops} setStops={setStops}
              vehicleId={vehicleId} setVehicleId={setVehicleId}
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
                onStartJourney={handleStartJourney}
                onStopJourney={handleStopJourney}
                isJourneyActive={isJourneyActive}
              />
            )}

            {routes && (
              <NavigationInstructions route={activeRoute} isOnline={isOnline} />
            )}
          </>
        ) : (
          <div className="panel animate-slide-in"><RidePool /></div>
        )}
      </div>

      {/* Bottom data dashboard */}
      {activeTab === 'route' && (
        <>
          <DataDashboard route={activeRoute} vehicle={vehicle} show={showDashboard && !!routes} />
          {routes && (
            <button className="dashboard-toggle" onClick={() => setShowDashboard(!showDashboard)} title={showDashboard ? 'Hide dashboard' : 'Show dashboard'}>
              {showDashboard ? '▼' : '▲'}
            </button>
          )}
        </>
      )}

      {/* Journey active status bar */}
      {isJourneyActive && (
        <div className="journey-status-bar">
          <div className="journey-status-dot"></div>
          <span>Journey Active</span>
          {userPosition && (
            <span className="journey-coords">
              {userPosition.lat.toFixed(4)}°, {userPosition.lng.toFixed(4)}°
            </span>
          )}
          <button className="journey-status-stop" onClick={handleStopJourney}>■ Stop</button>
        </div>
      )}

      {/* Re-routing toast */}
      {rerouteStatus === 'detecting' && (
        <div className="reroute-toast reroute-detecting">
          <span className="reroute-icon">📡</span>
          <span>Off route — re-routing in 5s…</span>
        </div>
      )}
      {rerouteStatus === 'rerouting' && (
        <div className="reroute-toast reroute-active">
          <div className="reroute-spinner"></div>
          <span>Re-routing…</span>
        </div>
      )}
      {rerouteStatus === 'done' && (
        <div className="reroute-toast reroute-done">
          <span className="reroute-icon">✓</span>
          <span>Route updated</span>
        </div>
      )}
    </div>
  );
}
