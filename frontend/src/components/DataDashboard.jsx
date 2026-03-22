import { useEffect, useState } from 'react';
import { WEATHER_DATA, TRAFFIC_LEVELS, ELEVATION_PROFILES, calculateFuelUsage } from '../data/demoData';
import { formatCost } from '../utils/mapHelpers';

function ElevationChart({ profile }) {
  if (!profile || profile.length < 2) return null;

  const maxD = profile[profile.length - 1].d;
  const minE = Math.min(...profile.map(p => p.e));
  const maxE = Math.max(...profile.map(p => p.e));
  const rangeE = maxE - minE || 1;

  const width = 200;
  const height = 55;
  const padX = 0;
  const padY = 4;

  const points = profile.map(p => ({
    x: padX + (p.d / maxD) * (width - 2 * padX),
    y: height - padY - ((p.e - minE) / rangeE) * (height - 2 * padY),
  }));

  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = lineD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="elevation-chart">
      <svg className="elevation-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E676" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00E676" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path className="elevation-area" d={areaD} />
        <path className="elevation-line" d={lineD} />
      </svg>
      <div className="elevation-labels">
        <span>{minE}m</span>
        <span>{maxE}m</span>
      </div>
    </div>
  );
}

export default function DataDashboard({ route, vehicle, show, source }) {
  const [liveFuelPrice, setLiveFuelPrice] = useState(null);
  const [matchedStateName, setMatchedStateName] = useState(null);

  useEffect(() => {
    async function fetchLiveFuelPrice() {
      try {
        const apiKey = import.meta.env.VITE_API_KEY_FUEL || "YOUR_API_KEY";
          
        const res = await fetch("https://fuel.indianapi.in/live_fuel_price?fuel_type=petrol&location_type=state", {
          headers: { "x-api-key": apiKey }
        });
        const data = await res.json();  
        console.log("Fuel API data:", data);
        
        // The API returns: [{ state: "Rajasthan", price: "108.83", change: "0.00" }, ...]
        if (Array.isArray(data) && data.length > 0) {
          
          // Nominatim gives source.name like: "MG Road, Pink City, Jaipur, Rajasthan, 302001, India"
          // Split by comma into segments and try to match EACH segment against the API state list
          const addressSegments = source?.name 
            ? source.name.split(',').map(s => s.trim().toLowerCase()) 
            : ['delhi'];
          
          let matchedState = null;

          // Loop through each segment of the address to find the state
          for (const segment of addressSegments) {
            matchedState = data.find(d => {
              const apiState = d.state.toLowerCase();
              return apiState === segment || segment.includes(apiState) || apiState.includes(segment);
            });
            if (matchedState) break; // Stop at first match
          }

          // Fallback to Delhi or first entry if no match found
          if (!matchedState) {
            matchedState = data.find(d => d.state.toLowerCase() === 'delhi' || d.state.toLowerCase() === 'new delhi') || data[0];
          }

          console.log("Matched state:", matchedState.state, "Price:", matchedState.price);
          setLiveFuelPrice(parseFloat(matchedState.price));
          setMatchedStateName(matchedState.state);
        } else if (data && data.price) {
          setLiveFuelPrice(parseFloat(data.price));
        }
      } catch (error) {
        console.error("Failed to fetch live fuel price:", error);
      }
    }
    
    // Re-fetch when source changes (different city = different price)
    if (show && route) {
      fetchLiveFuelPrice();
    }
  }, [show, route, source]);

  if (!show || !route) return null;

  const usage = calculateFuelUsage(route, vehicle);
  const segments = route.segments || [];
  const elevProfile = ELEVATION_PROFILES[route.id] || [];
  
  // Calculate total live cost globally using the live API price if available
  const totalCostDisplay = liveFuelPrice 
    ? `₹${(parseFloat(usage.fuel) * liveFuelPrice).toFixed(2)}` 
    : formatCost(usage.cost);

  // Aggregate weather along route
  const weatherSummary = {};
  segments.forEach(seg => {
    const w = seg.weather;
    if (!weatherSummary[w]) weatherSummary[w] = 0;
    weatherSummary[w] += seg.dist;
  });

  // Aggregate traffic
  const trafficSummary = {};
  segments.forEach(seg => {
    const t = seg.traffic;
    if (!trafficSummary[t]) trafficSummary[t] = 0;
    trafficSummary[t] += seg.dist;
  });

  // Fuel breakdown per segment (approximate)
  const basePer100 = vehicle.baseFuelRate || 7.5;
  const segmentFuel = segments.map(seg => {
    const weatherImpact = WEATHER_DATA[seg.weather]?.fuelImpact || 1;
    const trafficImpact = TRAFFIC_LEVELS[seg.traffic]?.fuelImpact || 1;
    const multiplier = route.fuelMultiplier || 1.0;
    const fuel = (basePer100 / 100) * seg.dist * weatherImpact * trafficImpact * multiplier;
    return { ...seg, fuel: fuel.toFixed(1) };
  });

  return (
    <div className="dashboard">
      {/* Weather Card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="dash-icon">🌤️</span>
          <h4>Weather</h4>
        </div>
        {Object.entries(weatherSummary).map(([key, dist]) => {
          const w = WEATHER_DATA[key];
          return (
            <div className="dash-metric" key={key}>
              <span className="dm-label">{w?.icon} {w?.label}</span>
              <span className="dm-value">{dist} km</span>
            </div>
          );
        })}
        <div className="dash-metric" style={{ marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
          <span className="dm-label">Avg Temp</span>
          <span className="dm-value">
            {Math.round(
              Object.entries(weatherSummary).reduce((sum, [key, dist]) => {
                return sum + (WEATHER_DATA[key]?.temp || 30) * dist;
              }, 0) / route.distance
            )}°C
          </span>
        </div>
        <div className="dash-metric">
          <span className="dm-label">Avg Wind</span>
          <span className="dm-value">
            {Math.round(
              Object.entries(weatherSummary).reduce((sum, [key, dist]) => {
                return sum + (WEATHER_DATA[key]?.wind || 10) * dist;
              }, 0) / route.distance
            )} km/h
          </span>
        </div>
      </div>

      {/* Traffic Card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="dash-icon">🚦</span>
          <h4>Traffic</h4>
        </div>
        {Object.entries(trafficSummary).map(([key, dist]) => {
          const t = TRAFFIC_LEVELS[key];
          return (
            <div className="dash-metric" key={key}>
              <span className="dm-label">
                <span className="traffic-indicator" style={{ background: t?.color }}></span>
                {t?.label}
              </span>
              <span className="dm-value">{dist} km</span>
            </div>
          );
        })}
        <div className="dash-metric" style={{ marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
          <span className="dm-label">Est. Delay</span>
          <span className="dm-value">
            +{Object.entries(trafficSummary).reduce((sum, [key]) => {
              return sum + (TRAFFIC_LEVELS[key]?.delay || 0);
            }, 0)} min
          </span>
        </div>
      </div>

      {/* Elevation Card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="dash-icon">⛰️</span>
          <h4>Elevation</h4>
        </div>
        <div className="dash-metric">
          <span className="dm-label">Total Gain</span>
          <span className="dm-value">↑{route.elevationGain}m</span>
        </div>
        <ElevationChart profile={elevProfile} />
      </div>

      {/* Fuel Card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="dash-icon">⛽</span>
          <h4>Fuel</h4>
        </div>
        {matchedStateName && liveFuelPrice && (
          <div className="dash-metric" style={{ backgroundColor: 'rgba(0, 230, 118, 0.08)', borderRadius: '4px', padding: '4px 8px', marginBottom: '4px' }}>
            <span className="dm-label">📍 {matchedStateName} (Petrol)</span>
            <span className="dm-value" style={{ color: '#00E676' }}>₹{liveFuelPrice}/L</span>
          </div>
        )}
        <div className="dash-metric">
          <span className="dm-label">Total Fuel</span>
          <span className="dm-value" style={{ color: 'var(--accent-green)' }}>{usage.fuel} {usage.unit}</span>
        </div>
        <div className="dash-metric">
          <span className="dm-label">Est. Cost</span>
          <span className="dm-value" style={{ color: 'var(--accent-green)' }}>{totalCostDisplay}</span>
        </div>
        <div className="dash-metric">
          <span className="dm-label">CO₂ Emission</span>
          <span className="dm-value">{usage.co2} kg</span>
        </div>
        {usage.co2Savings > 0 && (
          <div className="dash-metric">
            <span className="dm-label">CO₂ Savings</span>
            <span className="dm-value" style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
              -{usage.co2Savings} kg
            </span>
          </div>
        )}
        <div className="segment-list">
          {segmentFuel.slice(0, 4).map((seg, i) => (
            <div className="segment-item" key={i}>
              <span className="seg-weather">{WEATHER_DATA[seg.weather]?.icon}</span>
              <span className="seg-from-to">{seg.from} → {seg.to}</span>
              <span className="seg-dist">
                {liveFuelPrice ? `₹${(seg.fuel * liveFuelPrice).toFixed(1)}` : `${seg.fuel} ${usage.unit}`}
              </span>
            </div>
          ))}
          {segmentFuel.length > 4 && (
            <div className="segment-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
              +{segmentFuel.length - 4} more segments
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
