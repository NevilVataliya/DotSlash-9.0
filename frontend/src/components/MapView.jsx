import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createIcon, createStopIcon } from '../utils/mapHelpers';

const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const MAP_TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

function FitBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.coordinates && route.coordinates.length > 1) {
      const bounds = route.coordinates.map(c => [c[0], c[1]]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
    }
  }, [route, map]);
  return null;
}

function RecenterMap({ position }) {
  const map = useMap();
  const prevPos = useRef(null);
  useEffect(() => {
    if (!position) return;
    const { lat, lng } = position;
    if (!prevPos.current || prevPos.current.lat !== lat || prevPos.current.lng !== lng) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
      prevPos.current = position;
    }
  }, [position, map]);
  return null;
}

function AnimatedPolyline({ positions, color, weight, opacity, dashArray }) {
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight: weight || 4,
        opacity: opacity || 0.8,
        dashArray: dashArray || null,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  );
}

const gpsIcon = L.divIcon({
  className: '',
  html: `
    <div class="gps-marker-wrapper">
      <div class="gps-pulse-ring"></div>
      <div class="gps-dot"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20],
});

export default function MapView({ routes, selectedRoute, source, destination, stops, onSelectRoute, userPosition }) {
  const defaultCenter = [27.7, 76.5];
  const defaultZoom = 8;

  const allRoutes = routes ? Object.values(routes) : [];
  const activeRoute = selectedRoute ? routes[selectedRoute] : null;

  return (
    <div className="map-container">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url={MAP_TILE_URL}
          attribution={MAP_TILE_ATTRIBUTION}
          maxZoom={19}
        />

        {/* Non-selected routes as faded */}
        {allRoutes.map((route) => {
          if (selectedRoute && route.id !== selectedRoute) {
            return (
              <AnimatedPolyline
                key={route.id}
                positions={route.coordinates}
                color={route.color}
                weight={3}
                opacity={0.25}
                dashArray="8 8"
              />
            );
          }
          return null;
        })}

        {/* Selected route with glow */}
        {activeRoute && (
          <>
            <AnimatedPolyline
              positions={activeRoute.coordinates}
              color={activeRoute.color}
              weight={10}
              opacity={0.15}
            />
            <AnimatedPolyline
              positions={activeRoute.coordinates}
              color={activeRoute.color}
              weight={5}
              opacity={0.9}
            />
          </>
        )}

        {/* Source marker */}
        {source && (
          <Marker position={[source.lat, source.lng]} icon={createIcon('source')}>
            <Popup>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>
                <strong style={{ color: '#00E676' }}>📍 Start</strong><br />
                {source.name}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination marker */}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={createIcon('destination')}>
            <Popup>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>
                <strong style={{ color: '#FF5252' }}>🏁 Destination</strong><br />
                {destination.name}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Stop markers */}
        {stops && stops.map((stop, i) => (
          stop && (
            <Marker key={i} position={[stop.lat, stop.lng]} icon={createStopIcon(i)}>
              <Popup>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>
                  <strong style={{ color: '#FFD740' }}>📌 Stop {i + 1}</strong><br />
                  {stop.name}
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {/* Live GPS user position marker */}
        {userPosition && (
          <>
            <Marker position={[userPosition.lat, userPosition.lng]} icon={gpsIcon}>
              <Popup>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>
                  <strong style={{ color: '#448AFF' }}>📡 You are here</strong><br />
                  {userPosition.lat.toFixed(5)}, {userPosition.lng.toFixed(5)}
                </div>
              </Popup>
            </Marker>
            <RecenterMap position={userPosition} />
          </>
        )}

        {/* Fit map to route only when not tracking GPS */}
        {!userPosition && activeRoute && <FitBounds route={activeRoute} />}
      </MapContainer>
    </div>
  );
}
