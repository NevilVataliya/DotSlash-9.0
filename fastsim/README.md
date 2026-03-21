## FASTSim Emissions Service

### Overview
Multi-source routing engine with CO2 emission calculation for logistics optimization. Uses **TomTom** for primary routing with real-time traffic, **Valhalla** as fallback, and **OpenTopo** for elevation data.

### Architecture
```
Request → TomTom Routing (live traffic) 
        → Fallback: Valhalla (free, OSM)
        → OpenTopo Elevation (free)
        → FASTSim Engine (CO2 calculation)
        → Response (multiple eco-routes)
```

### Configuration

#### Route Sources
- `tomtom` - TomTom only (paid, premium traffic data)
- `valhalla` - Valhalla only (free, open-source)
- `tomtom_valhalla_hybrid` - **Default**: TomTom with Valhalla fallback (recommended)

#### Environment Variables
```env
ROUTE_SOURCE=tomtom_valhalla_hybrid
TOMTOM_API_KEY=your_key_here
TOMTOM_MAX_ROUTES=3
VALHALLA_URL=https://valhalla1.openstreetmap.de/route
VALHALLA_ALTERNATES=5
OPENTOPO_URL=https://api.opentopodata.org/v1/srtm90m
OPENWEATHER_API_KEY=your_key_here
REQUEST_TIMEOUT_S=4.0
MAX_ELEVATION_POINTS=60
```

### Run

From `fastsim` folder:

```bash
# Using uvicorn directly
python -m uvicorn server:app --host 127.0.0.1 --port 8000

# With auto-reload for development
python -m uvicorn server:app --reload
```

From repo root:

```bash
cd fastsim && python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

### API Endpoints

#### Get Eco Routes
```bash
POST /api/get-eco-routes
Content-Type: application/json

{
  "start_lat": 21.1702,
  "start_lon": 72.8311,
  "end_lat": 19.0760,
  "end_lon": 72.8777,
  "cargo_weight_kg": 1200,
  "include_all_routes": true
}
```

**Response**: Multiple eco-routes ranked by CO2 emissions with:
- Distance (km)
- Duration (seconds)
- Estimated fuel (liters)
- Estimated CO2 (kg)

#### Health Check
```bash
GET /health
```

Shows configuration status and which APIs are available.

### Testing

Run test suite:
```bash
cd fastsim
python -m pytest tests/
```

Test multiple routes:
```bash
python test_multiple_routes.py
```

Test TomTom API capabilities:
```bash
python ../test_tomtom_api.py
```

### Cost Optimization Strategy

| Component | Provider | Cost | Status |
|-----------|----------|------|--------|
| Routing | TomTom | Pay-per-request | ✅ Primary |
| Fallback | Valhalla | Free | ✅ Automatic |
| Elevation | OpenTopo | Free | ✅ Always used |
| Traffic | TomTom | Included in routing | ✅ Built-in |
| Weather | OpenWeatherMap | Free tier | ✅ Optional |

**Total Cost**: Only TomTom routing charges (Valhalla backup keeps costs reasonable)

