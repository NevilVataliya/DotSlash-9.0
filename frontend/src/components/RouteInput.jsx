import { useState, useRef, useEffect } from 'react';
import { PREDEFINED_LOCATIONS } from '../data/demoData';

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
      // Only search if user typed > 2 chars and it's not simply matching the currently selected value
      if (query.length > 2 && (!value || query !== value.name)) {
        setIsLoading(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          const apiSuggestions = data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            coordinates: [parseFloat(item.lon), parseFloat(item.lat)] // [lng, lat] format
          }));
          
          // Also include any local predefined matches
          const localMatch = PREDEFINED_LOCATIONS.filter(loc =>
            loc.name.toLowerCase().includes(query.toLowerCase())
          );
          
          setSuggestions([...localMatch, ...apiSuggestions]);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Geocoding failed", error);
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
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        const locName = data.display_name || "Current Location";
        const loc = { name: locName, lat: latitude, lng: longitude, coordinates: [longitude, latitude] };
        setQuery(locName);
        onSelect(loc);
      } catch (error) {
        const loc = { name: "Current Location", lat: latitude, lng: longitude, coordinates: [longitude, latitude] };
        setQuery("Current Location");
        onSelect(loc);
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

  const handleExtractInfo = async () => {
    if (!imageFile && !audioFile) return;
    setIsExtracting(true);
    try {
      const formData = new FormData();
      if (imageFile) formData.append('image', imageFile);
      if (audioFile) formData.append('audio', audioFile);

      const res = await fetch('http://localhost:5000/api/v1/vehicles/extract-info', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        body: formData,
        credentials: 'omit' // use omit if jwt in header, include if using cookies. Assuming cookies are set via credentials: true in cors but checking both.
      });
      const result = await res.json();
      
      if (result.statusCode === 200 || result.success) {
        const data = result.data;
        setExtractedData(data);
        alert(`Extracted: ${data.make} ${data.model} (${data.year || 'Unknown year'})`);
        
        // Now save to DB
        // ensure type is set to match schema requirement ("car", "bike", "bus", "truck")
        let vType = data.type;
        if (!vType && vehicleId === 'motorcycle') vType = 'bike';
        else if (!vType) vType = 'car';
        
        const saveRes = await fetch('http://localhost:5000/api/v1/vehicles/addvehicle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
            },
            body: JSON.stringify({ ...data, type: vType })
        });
        const saveResult = await saveRes.json();
        if(saveResult.statusCode === 201 || saveResult.success) {
            console.log("Saved vehicle to DB successfully");
        }
      } else {
        alert('Extraction failed: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error during extraction');
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
            <strong>Extracted:</strong> {extractedData.make} {extractedData.model} ({extractedData.year})<br />
            <strong>Fuel Type:</strong> {extractedData.fuelType}
          </div>
        )}
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
