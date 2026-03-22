import { useState, useRef, useEffect } from 'react';
import { PREDEFINED_LOCATIONS } from '../data/demoData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const GEOCODING_BASE_URL = (import.meta.env.VITE_GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return { success: false, message: 'Invalid JSON response from server' };
    }
  }

  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {
      success: false,
      message: raw?.startsWith('<!DOCTYPE')
        ? 'Server returned HTML instead of JSON. Check API URL and backend error logs.'
        : (raw || 'Unexpected server response'),
    };
  }
}

function LocationInput({ value, onChange, onSelect, placeholder, dotClass, showConnector }) {
  const [query, setQuery] = useState(value ? value.name : '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  // Debounced API Search for locations (Geocoding)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const localMatch = PREDEFINED_LOCATIONS.filter(loc =>
        loc.name.toLowerCase().includes(query.toLowerCase())
      );

      // Only search if user typed > 2 chars and it's not simply matching the currently selected value
      if (query.length > 2 && (!value || query !== value.name)) {
        if (!navigator.onLine) {
          setSuggestions(localMatch);
          setShowSuggestions(true);
          return;
        }

        setIsLoading(true);
        try {
          const res = await fetch(`${GEOCODING_BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          const apiSuggestions = data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            coordinates: [parseFloat(item.lon), parseFloat(item.lat)] // [lng, lat] format
          }));

          setSuggestions([...localMatch, ...apiSuggestions]);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Geocoding failed", error);
          setSuggestions(localMatch);
          setShowSuggestions(true);
        } finally {
          setIsLoading(false);
        }
      } else if (query.length === 0) {
        setSuggestions(PREDEFINED_LOCATIONS);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query, value]);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    onChange(null); // reset actual selected object when typing new text
  }

  function handleSelect(loc) {
    setQuery(loc.name);
    onSelect(loc);
    setShowSuggestions(false);
  }

  function handleFocus() {
    if (query.length === 0) {
      setSuggestions(PREDEFINED_LOCATIONS);
      setShowSuggestions(true);
    } else if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 200);
  }

  // Fetch Current location using HTML5 Geolocation API
  function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setQuery("Locating...");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const fallback = { name: "Current Location", lat: latitude, lng: longitude, coordinates: [longitude, latitude] };

      try {
        if (!navigator.onLine) {
          setQuery(fallback.name);
          onSelect(fallback);
          return;
        }

        const res = await fetch(`${GEOCODING_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        const locName = data.display_name || fallback.name;
        const loc = { name: locName, lat: latitude, lng: longitude, coordinates: [longitude, latitude] };
        setQuery(locName);
        onSelect(loc);
      } catch (error) {
        setQuery(fallback.name);
        onSelect(fallback);
      }
    }, (err) => {
      console.error(err);
      alert("Unable to retrieve your location");
      setQuery("");
    });
  }

  return (
    <div className="input-row" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
      <span className={`input-dot ${dotClass}`}></span>
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          className={`route-input${value ? ' has-value' : ''}`}
          style={{ paddingRight: '40px', width: '100%' }}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {/* Geolocation Button */}
        <button 
          onClick={handleUseCurrentLocation}
          title="Use Current Location"
          style={{
            position: 'absolute',
            right: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: 'var(--accent, #448AFF)',
            padding: '4px'
          }}
        >
          📍
        </button>
      </div>
      
      {showSuggestions && (
        <div className="suggestions-dropdown" style={{ zIndex: 1000, position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1d24', border: '1px solid #333', borderRadius: '4px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
          {isLoading && <div style={{ padding: '8px', color: '#888', fontSize: '14px' }}>Searching...</div>}
          {!isLoading && suggestions.length === 0 && query.length > 2 && (
            <div style={{ padding: '8px', color: '#888', fontSize: '14px' }}>No results found</div>
          )}
          {suggestions.map((loc, i) => (
            <div 
              key={i} 
              className="suggestion-item" 
              onMouseDown={() => handleSelect(loc)}
              style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #333', display: 'flex', alignItems: 'flex-start', fontSize: '14px' }}
            >
              <span className="loc-icon" style={{ marginRight: '8px' }}>🏢</span>
              <span style={{ wordBreak: 'break-word', color: '#ececec' }}>{loc.name}</span>
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
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [showExtractedPopup, setShowExtractedPopup] = useState(false);

  const hasMeaningfulValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized !== '' && !['n/a', 'na', 'not available', 'unknown', 'undefined', 'null', 'none', '-'].includes(normalized);
    }
    if (typeof value === 'number') return Number.isFinite(value);
    return true;
  };

  function getExtractedTitle(data) {
    if (!data) return 'Vehicle details extracted';

    const make = hasMeaningfulValue(data.make) ? data.make : '';
    const model = hasMeaningfulValue(data.model) ? data.model : '';
    const type = hasMeaningfulValue(data.type) ? data.type : '';
    const year = hasMeaningfulValue(data.year) ? ` (${data.year})` : '';

    const makeModel = `${make} ${model}`.trim();
    if (makeModel) return `${makeModel}${year}`;
    if (type) return `${type.toUpperCase()}${year}`;
    if (data.parsedAudioNote?.notes) return 'Audio details extracted';

    return 'Vehicle details extracted';
  }

  const handleExtractInfo = async () => {
    if (!imageFile && !audioFile) return;
    setIsExtracting(true);
    try {
      const formData = new FormData();
      if (imageFile) formData.append('image', imageFile);
      if (audioFile) formData.append('audio', audioFile);

      const res = await fetch(`${API_BASE_URL}/vehicles/extract-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        body: formData,
        credentials: 'omit' // use omit if jwt in header, include if using cookies. Assuming cookies are set via credentials: true in cors but checking both.
      });
      const result = await parseApiResponse(res);

      if (!res.ok) {
        alert('Extraction failed: ' + (result.message || `HTTP ${res.status}`));
        return;
      }

      if (result.statusCode === 200 || result.success) {
        const data = result.data;
        setExtractedData(data);
        setShowExtractedPopup(true);

        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
          console.log('Vehicle extracted without sign-in. Skipping save.');
          return;
        }

        // Now save to DB
        // ensure type is set to match schema requirement ("car", "bike", "bus", "truck")
        let vType = data.type;
        if (!vType && vehicleId === 'motorcycle') vType = 'bike';
        else if (!vType) vType = 'car';

        const saveRes = await fetch(`${API_BASE_URL}/vehicles/addvehicle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ ...data, type: vType })
        });
        const saveResult = await parseApiResponse(saveRes);

        if (!saveRes.ok) {
          alert('Saving vehicle failed: ' + (saveResult.message || `HTTP ${saveRes.status}`));
          return;
        }

        if (saveResult.statusCode === 201 || saveResult.success) {
          console.log("Saved vehicle to DB successfully");
        }
      } else {
        alert('Extraction failed: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      if (err?.name === 'TypeError' || String(err?.message || '').includes('Failed to fetch')) {
        alert('Extraction service is unreachable. Make sure frontend dev server (5173) and backend server (5000) are running, then refresh and try again.');
      } else {
        alert('Error during extraction: ' + (err?.message || 'Unknown error'));
      }
    } finally {
      setIsExtracting(false);
    }
  };

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
          onChange={() => { }}
          onSelect={setSource}
          placeholder="Enter starting point"
          dotClass="source"
        />

        {stops.map((stop, i) => (
          <div key={i} className="input-row">
            <span className="input-dot stop"></span>
            <LocationInput
              value={stop}
              onChange={() => { }}
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
          onChange={() => { }}
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

      {/* AI Extraction Section */}
      <div className="section-header" style={{ marginTop: 'var(--sp-md)' }}>
        <h3><span className="section-icon">✨</span> AI Vehicle Info</h3>
      </div>
      <div className="ai-extraction-section" style={{ padding: 'var(--sp-md)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vehicle Image</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Engine Audio (Optional)</label>
          <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem' }} />
        </div>
        <button
          onClick={handleExtractInfo}
          disabled={(!imageFile && !audioFile) || isExtracting}
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: isExtracting ? 'rgba(255,255,255,0.1)' : 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: (!imageFile && !audioFile) || isExtracting ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {isExtracting ? '⏳ Analyzing media...' : 'Extract Info & Save'}
        </button>
        {extractedData && (
          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', borderRadius: '4px', fontSize: '0.85rem' }}>
            <strong>Extracted:</strong> {getExtractedTitle(extractedData)}<br />
            {hasMeaningfulValue(extractedData.fuelType) && <><strong>Fuel Type:</strong> {extractedData.fuelType}</>}
          </div>
        )}
      </div>

      {showExtractedPopup && extractedData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 5000,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: 'min(540px, 95vw)',
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>✨ Extraction Result</h3>
              <button
                className="remove-stop-btn"
                onClick={() => setShowExtractedPopup(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {getExtractedTitle(extractedData)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem' }}>
              {hasMeaningfulValue(extractedData.type) && <div><strong>Type:</strong> {extractedData.type}</div>}
              {hasMeaningfulValue(extractedData.fuelType) && <div><strong>Fuel:</strong> {extractedData.fuelType}</div>}
              {hasMeaningfulValue(extractedData.make) && <div><strong>Make:</strong> {extractedData.make}</div>}
              {hasMeaningfulValue(extractedData.model) && <div><strong>Model:</strong> {extractedData.model}</div>}
              {hasMeaningfulValue(extractedData.year) && <div><strong>Year:</strong> {extractedData.year}</div>}
              {hasMeaningfulValue(extractedData.mileage) && <div><strong>Mileage:</strong> {extractedData.mileage}</div>}
              {hasMeaningfulValue(extractedData.registrationNumber) && (
                <div style={{ gridColumn: '1 / -1' }}><strong>Registration:</strong> {extractedData.registrationNumber}</div>
              )}
              {hasMeaningfulValue(extractedData.engine?.type) && <div style={{ gridColumn: '1 / -1' }}><strong>Engine:</strong> {extractedData.engine.type}</div>}
              {hasMeaningfulValue(extractedData.engine?.transmission) && <div><strong>Transmission:</strong> {extractedData.engine.transmission}</div>}
              {hasMeaningfulValue(extractedData.engine?.displacementCc) && <div><strong>Displacement:</strong> {extractedData.engine.displacementCc} cc</div>}
              {hasMeaningfulValue(extractedData.dimensions?.fuelTankCapacityL) && <div><strong>Fuel Tank:</strong> {extractedData.dimensions.fuelTankCapacityL} L</div>}
              {hasMeaningfulValue(extractedData.parsedAudioNote?.ageYears) && <div><strong>Age:</strong> {extractedData.parsedAudioNote.ageYears} years</div>}
              {hasMeaningfulValue(extractedData.parsedAudioNote?.notes) && (
                <div style={{ gridColumn: '1 / -1' }}><strong>Audio Notes:</strong> {extractedData.parsedAudioNote.notes}</div>
              )}
            </div>

            <div style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              You can extract details without signing in. Saving to your vehicle list requires sign-in.
            </div>
          </div>
        </div>
      )}

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
