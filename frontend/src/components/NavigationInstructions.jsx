function formatDistance(distanceKm) {
  if (!distanceKm || Number(distanceKm) <= 0) return '';
  return `${Number(distanceKm).toFixed(1)} km`;
}

export default function NavigationInstructions({ route, isOnline }) {
  if (!route) return null;

  const instructions = route.instructions || [];
  if (!instructions.length) return null;

  return (
    <div className="panel" style={{ animationDelay: '0.15s' }}>
      <div className="section-header">
        <h3><span className="section-icon">🧭</span> Navigation</h3>
        <span className={`section-badge ${isOnline ? '' : 'offline-badge'}`}>
          {isOnline ? 'Online sync' : 'Offline mode'}
        </span>
      </div>

      <ol className="nav-steps">
        {instructions.map((instruction, index) => (
          <li key={`${instruction.type}-${index}`} className="nav-step-item">
            <div className="nav-step-index">{index + 1}</div>
            <div className="nav-step-content">
              <span>{instruction.text}</span>
              {instruction.distanceKm > 0 && (
                <span className="nav-step-distance">{formatDistance(instruction.distanceKm)}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
