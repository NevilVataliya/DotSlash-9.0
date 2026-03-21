import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createIcon, createStopIcon } from '../utils/mapHelpers';

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

export default function MapView({ routes, selectedRoute, source, destination, stops, onSelectRoute }) {
  const defaultCenter = [27.7, 76.5]; // Center between Delhi-Jaipur
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
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />

        {/* Render non-selected routes as faded */}
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

        {/* Render selected route on top with glow */}
        {activeRoute && (
          <>
            {/* Glow layer */}
            <AnimatedPolyline
              positions={activeRoute.coordinates}
              color={activeRoute.color}
              weight={10}
              opacity={0.15}
            />
            {/* Main line */}
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

        {activeRoute && <FitBounds route={activeRoute} />}
      </MapContainer>
    </div>
  );
}
