import { useState, useRef, useEffect } from 'react';
import { PREDEFINED_LOCATIONS } from '../data/demoData';

function LocationInput({ value, onChange, onSelect, placeholder, dotClass, showConnector }) {
  const [query, setQuery] = useState(value ? value.name : '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    onChange(null); // reset selected
    if (q.length > 0) {
      const filtered = PREDEFINED_LOCATIONS.filter(loc =>
        loc.name.toLowerCase().includes(q.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }

  function handleSelect(loc) {
    setQuery(loc.name);
    onSelect(loc);
    setShowSuggestions(false);
  }

  function handleFocus() {
    if (query.length > 0) {
      const filtered = PREDEFINED_LOCATIONS.filter(loc =>
        loc.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions(PREDEFINED_LOCATIONS);
      setShowSuggestions(true);
    }
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 200);
  }

  return (
    <div className="input-row" style={{ position: 'relative' }}>
      <span className={`input-dot ${dotClass}`}></span>
      <input
        ref={inputRef}
        className={`route-input${value ? ' has-value' : ''}`}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((loc, i) => (
            <div key={i} className="suggestion-item" onMouseDown={() => handleSelect(loc)}>
              <span className="loc-icon">📍</span>
              {loc.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RouteInput({
  source, setSource,
  destination, setDestination,
  stops, setStops,
  vehicleId, setVehicleId,
  vehicles,
  onPlanRoute,
  isLoading,
}) {
  function addStop() {
    setStops([...stops, null]);
  }

  function removeStop(index) {
    setStops(stops.filter((_, i) => i !== index));
  }

  function updateStop(index, loc) {
    const newStops = [...stops];
    newStops[index] = loc;
    setStops(newStops);
  }

  const canPlan = source && destination;

  return (
    <div className="panel">
      {/* Brand */}
      <div className="brand">
        <div className="brand-icon">🛣️</div>
        <div>
          <h1>EcoRoute</h1>
          <p>Fuel-Optimized Route Planner</p>
        </div>
      </div>

      {/* Route Inputs */}
      <div className="route-input-group">
        <LocationInput
          value={source}
          onChange={() => {}}
          onSelect={setSource}
          placeholder="Enter starting point"
          dotClass="source"
        />

        {stops.map((stop, i) => (
          <div key={i} className="input-row">
            <span className="input-dot stop"></span>
            <LocationInput
              value={stop}
              onChange={() => {}}
              onSelect={(loc) => updateStop(i, loc)}
              placeholder={`Stop ${i + 1}`}
              dotClass="stop"
            />
            <button className="remove-stop-btn" onClick={() => removeStop(i)} title="Remove stop">
              ✕
            </button>
          </div>
        ))}

        <LocationInput
          value={destination}
          onChange={() => {}}
          onSelect={setDestination}
          placeholder="Enter destination"
          dotClass="destination"
        />

        <button className="add-stop-btn" onClick={addStop}>
          <span>+</span> Add stop
        </button>
      </div>

      {/* Vehicle Selector */}
      <div className="section-header" style={{ marginTop: 'var(--sp-lg)' }}>
        <h3><span className="section-icon">🚗</span> Vehicle Type</h3>
      </div>
      <div className="vehicle-selector">
        {vehicles.map(v => (
          <div
            key={v.id}
            className={`vehicle-option${vehicleId === v.id ? ' active' : ''}`}
            onClick={() => setVehicleId(v.id)}
          >
            <span className="v-icon">{v.icon}</span>
            <span className="v-name">{v.name}</span>
          </div>
        ))}
      </div>

      {/* Plan Route Button */}
      <button
        className="plan-route-btn"
        onClick={onPlanRoute}
        disabled={!canPlan || isLoading}
      >
        {isLoading ? (
          <>
            <div className="spinner"></div>
            Calculating...
          </>
        ) : (
          <>
            🗺️ Plan Route
          </>
        )}
      </button>
    </div>
  );
}
