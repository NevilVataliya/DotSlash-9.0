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

export default function DataDashboard({ route, vehicle, show }) {
  if (!show || !route) return null;

  const usage = calculateFuelUsage(route, vehicle);
  const segments = route.segments || [];
  const elevProfile = ELEVATION_PROFILES[route.id] || [];

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
        <div className="dash-metric">
          <span className="dm-label">Total Fuel</span>
          <span className="dm-value" style={{ color: 'var(--accent-green)' }}>{usage.fuel} {usage.unit}</span>
        </div>
        <div className="dash-metric">
          <span className="dm-label">Est. Cost</span>
          <span className="dm-value" style={{ color: 'var(--accent-green)' }}>{formatCost(usage.cost)}</span>
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
              <span className="seg-dist">{seg.fuel} {usage.unit}</span>
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
