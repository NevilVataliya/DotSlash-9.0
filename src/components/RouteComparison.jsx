import { formatDistance, formatDuration, formatFuel, formatCost } from '../utils/mapHelpers';
import { calculateFuelUsage } from '../data/demoData';

export default function RouteComparison({ routes, selectedRoute, onSelectRoute, vehicle }) {
  if (!routes) return null;

  const routeList = Object.values(routes);

  // Find the most fuel-efficient route
  const fuelValues = routeList.map(r => {
    const usage = calculateFuelUsage(r, vehicle);
    return { id: r.id, fuel: parseFloat(usage.fuel) };
  });
  const minFuel = Math.min(...fuelValues.map(f => f.fuel));
  const maxFuel = Math.max(...fuelValues.map(f => f.fuel));
  const savingsPercent = maxFuel > 0 ? Math.round((1 - minFuel / maxFuel) * 100) : 0;

  return (
    <div className="panel" style={{ animationDelay: '0.1s' }}>
      <div className="section-header">
        <h3>
          <span className="section-icon">⚡</span> Route Options
        </h3>
        <span className="section-badge">{routeList.length} routes</span>
      </div>

      <div className="route-comparison">
        {routeList.map((route) => {
          const usage = calculateFuelUsage(route, vehicle);
          const isBest = route.id === 'fuel-optimized';

          return (
            <div
              key={route.id}
              className={`route-card${selectedRoute === route.id ? ' selected' : ''}`}
              style={{ '--route-color': route.color }}
              onClick={() => onSelectRoute(route.id)}
            >
              {isBest && <div className="badge">🌿 Best</div>}

              <div className="route-card-header">
                <div className="route-dot"></div>
                <h3>{route.label}</h3>
              </div>

              <p className="route-card-desc">{route.description}</p>

              <div className="route-stats">
                <div className="stat">
                  <span className="stat-label">Distance</span>
                  <span className="stat-value">{formatDistance(route.distance)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Duration</span>
                  <span className="stat-value">{formatDuration(route.duration)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Fuel</span>
                  <span className={`stat-value${isBest ? ' highlight' : ''}`}>
                    {formatFuel(usage.fuel, usage.unit)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Cost</span>
                  <span className={`stat-value${isBest ? ' highlight' : ''}`}>
                    {formatCost(usage.cost)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">CO₂</span>
                  <span className="stat-value">{usage.co2} kg</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Elevation</span>
                  <span className="stat-value">↑{route.elevationGain}m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {savingsPercent > 0 && (
        <div className="fuel-savings">
          <span>🌿 Fuel-optimized route saves up to {savingsPercent}% fuel vs worst option</span>
        </div>
      )}
    </div>
  );
}
