import L from 'leaflet';

// Custom marker icons
export function createIcon(type) {
  const colors = {
    source: '#00E676',
    destination: '#FF5252',
    stop: '#FFD740',
  };
  const labels = {
    source: 'A',
    destination: 'B',
    stop: '●',
  };
  const color = colors[type] || '#448AFF';
  const label = labels[type] || '●';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px ${color}88;
      border: 2px solid #fff;
    "><span style="
      transform: rotate(45deg);
      color: #000;
      font-weight: 700;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
    ">${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export function createStopIcon(index) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: #FFD740;
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 10px #FFD74088;
      border: 2px solid #fff;
    "><span style="
      transform: rotate(45deg);
      color: #000;
      font-weight: 700;
      font-size: 11px;
      font-family: 'Inter', sans-serif;
    ">${index + 1}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

export function formatDistance(km) {
  return km >= 1000 ? `${(km / 1000).toFixed(1)} K km` : `${km} km`;
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatFuel(amount, unit) {
  return `${amount} ${unit}`;
}

export function formatCost(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}
