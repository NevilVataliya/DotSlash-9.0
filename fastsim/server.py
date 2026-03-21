from __future__ import annotations

import logging
import math
import os
from typing import Any, Dict, List, Optional, Tuple

import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --- Optional FASTSim import ------------------------------------------------
FASTSIM_AVAILABLE = False
vehicle: Any = None
cycle: Any = None
simdrive: Any = None

try:
    import fastsim as _fastsim_mod
    try:
        from fastsim import vehicle as _vehicle, cycle as _cycle, simdrive as _simdrive
        vehicle = _vehicle
        cycle = _cycle
        simdrive = _simdrive
    except ImportError:
        # FASTSim v3+ has a different module layout
        class _VehicleCompat:
            Vehicle = _fastsim_mod.Vehicle
        class _CycleCompat:
            Cycle = _fastsim_mod.Cycle
        class _SimDriveClassicCompat:
            def __init__(self, cyc_obj: Any, veh_obj: Any) -> None:
                self._sim = _fastsim_mod.SimDrive(veh_obj, cyc_obj)
                self.mpgge = 0.0
            def sim_drive(self) -> None:
                self._sim.walk()
                df = self._sim.to_dataframe()
                dist_col = "veh.history.dist_meters"
                fuel_cols = [c for c in df.columns if "energy_fuel_joules" in c]
                fuel_col = fuel_cols[0] if fuel_cols else None
                if dist_col in df.columns and fuel_col:
                    distance_m = float(df.select(dist_col).to_series()[-1])
                    fuel_joules = float(df.select(fuel_col).to_series()[-1])
                    miles = distance_m * 0.000621371
                    gge = fuel_joules / 120_000_000 if fuel_joules > 0 else 0.0
                    self.mpgge = miles / gge if gge > 0 else 0.0
        class _SimdriveCompat:
            SimDriveClassic = _SimDriveClassicCompat
        vehicle = _VehicleCompat
        cycle = _CycleCompat
        simdrive = _SimdriveCompat
    FASTSIM_AVAILABLE = True
except ImportError:
    pass  # FASTSIM_AVAILABLE stays False — physics fallback will be used

# Load environment variables from .env file
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info(f"FASTSim available: {FASTSIM_AVAILABLE}")


app = FastAPI(title="GreenTech Logistics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VehicleProfile(BaseModel):
    """Vehicle profile data matching the backend Vehicle.js schema."""
    type: str = Field(default="car", description="car / bike / bus / truck")
    fuel_type: str = Field(default="petrol", description="petrol / diesel / electric / gas / hybrid")
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    # Dimensions & weight
    kerb_weight_kg: Optional[float] = Field(default=None, description="dimensions.kerbWeightKg")
    frontal_area_m2: Optional[float] = Field(default=None, description="dimensions.frontalAreaM2")
    fuel_tank_capacity_l: Optional[float] = None
    # Engine
    displacement_cc: Optional[float] = Field(default=None, description="engine.displacementCc")
    horsepower_ps: Optional[float] = None
    max_torque_nm: Optional[float] = None
    top_speed_kmph: Optional[float] = None
    claimed_mileage_kmpl: Optional[float] = None
    transmission: Optional[str] = None
    # Commercial (truck / bus)
    payload_kg: Optional[float] = Field(default=None, description="commercial.payloadKg")
    gross_vehicle_weight_kg: Optional[float] = Field(default=None, description="commercial.grossVehicleWeightKg")
    # EV specific
    battery_capacity_kwh: Optional[float] = None
    motor_power_kw: Optional[float] = None
    estimated_range_km: Optional[float] = None
    # Aerodynamics
    drag_coef: Optional[float] = None
    # From voice / image parsed data
    co2_g_per_km: Optional[float] = Field(default=None, description="voiceNotes.parsed.co2GPerKm")
    odometer_km: Optional[float] = None


# --- Default constants by vehicle type ---------------------------------------------------

_DEFAULT_MASS_KG: Dict[str, float] = {"car": 1400.0, "bike": 180.0, "bus": 12000.0, "truck": 7500.0}
_DEFAULT_DRAG_COEF: Dict[str, float] = {"car": 0.30, "bike": 0.70, "bus": 0.60, "truck": 0.65}
_DEFAULT_FRONTAL_AREA: Dict[str, float] = {"car": 2.2, "bike": 0.6, "bus": 7.5, "truck": 6.5}

# kg CO2 per litre (or per kg for CNG)
_CO2_FACTOR: Dict[str, float] = {
    "petrol": 2.31,
    "diesel": 2.68,
    "gas": 1.88,        # CNG per kg
    "electric": 0.0,    # tank-to-wheel = 0
    "hybrid": 2.31 * 0.7,  # blended factor
}


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    cargo_weight_kg: float = Field(ge=0)
    include_all_routes: bool = False
    vehicle_profile: Optional[VehicleProfile] = None


class Settings(BaseModel):
    node_route_api_url: Optional[str] = os.getenv("NODE_ROUTE_API_URL")
    valhalla_url: str = os.getenv("VALHALLA_URL", "https://valhalla1.openstreetmap.de/route")
    openweather_url: str = os.getenv("OPENWEATHER_URL", "https://api.openweathermap.org/data/2.5/weather")
    openweather_api_key: Optional[str] = os.getenv("OPENWEATHER_API_KEY")
    opentopo_url: str = os.getenv("OPENTOPO_URL", "https://api.opentopodata.org/v1/srtm90m")
    tomtom_api_key: Optional[str] = os.getenv("TOMTOM_API_KEY")
    tomtom_url_template: str = os.getenv(
        "TOMTOM_URL_TEMPLATE",
        "https://api.tomtom.com/routing/1/calculateRoute/{start_lat},{start_lon}:{end_lat},{end_lon}/json",
    )
    route_source: str = os.getenv("ROUTE_SOURCE", "valhalla")
    request_timeout_s: float = float(os.getenv("REQUEST_TIMEOUT_S", "4.0"))
    openweather_units: str = "metric"
    max_elevation_points: int = int(os.getenv("MAX_ELEVATION_POINTS", "60"))
    valhalla_alternates: int = int(os.getenv("VALHALLA_ALTERNATES", "5"))


SETTINGS = Settings()


def _validate_coordinates(req: RouteRequest) -> None:
    if not (-90 <= req.start_lat <= 90 and -90 <= req.end_lat <= 90):
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
    if not (-180 <= req.start_lon <= 180 and -180 <= req.end_lon <= 180):
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")


async def _http_get_json(client: httpx.AsyncClient, url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()


async def _http_post_json(client: httpx.AsyncClient, url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    response = await client.post(url, json=payload)
    response.raise_for_status()
    return response.json()


def _decode_polyline(encoded: str) -> List[Tuple[float, float]]:
    coordinates: List[Tuple[float, float]] = []
    index = 0
    lat = 0
    lon = 0

    while index < len(encoded):
        shift = 0
        result = 0
        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        shift = 0
        result = 0
        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlon = ~(result >> 1) if (result & 1) else (result >> 1)
        lon += dlon

        coordinates.append((lat / 1e5, lon / 1e5))

    return coordinates


def _fallback_routes(req: RouteRequest) -> List[Dict[str, Any]]:
    start = (req.start_lat, req.start_lon)
    end = (req.end_lat, req.end_lon)
    return [
        {
            "type": "Fastest",
            "distance_km": 22.5,
            "duration_s": 2400,
            "polyline": "",
            "coordinates": [start, end],
            "traffic_penalty": 1.08,
        },
        {
            "type": "Shortest",
            "distance_km": 18.2,
            "duration_s": 2300,
            "polyline": "",
            "coordinates": [start, end],
            "traffic_penalty": 1.12,
        },
        {
            "type": "Eco-Saver",
            "distance_km": 24.1,
            "duration_s": 2600,
            "polyline": "",
            "coordinates": [start, end],
            "traffic_penalty": 0.98,
        },
    ]


def _coerce_coordinates(raw_coordinates: Any, req: RouteRequest) -> List[Tuple[float, float]]:
    if not isinstance(raw_coordinates, list) or not raw_coordinates:
        return [(req.start_lat, req.start_lon), (req.end_lat, req.end_lon)]

    normalized: List[Tuple[float, float]] = []
    for point in raw_coordinates:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            normalized.append((float(point[0]), float(point[1])))
        elif isinstance(point, dict):
            lat = point.get("lat")
            lon = point.get("lon", point.get("lng"))
            if lat is not None and lon is not None:
                normalized.append((float(lat), float(lon)))

    if not normalized:
        return [(req.start_lat, req.start_lon), (req.end_lat, req.end_lon)]
    return normalized


def _normalize_node_route_payload(payload: Dict[str, Any], req: RouteRequest) -> List[Dict[str, Any]]:
    if isinstance(payload.get("primary"), dict):
        primary = payload["primary"]
        alternates = payload.get("alternates", []) if isinstance(payload.get("alternates"), list) else []
        candidates = [primary, *alternates]
        route_labels = ["Fastest", "Shortest", "Eco-Saver"]

        normalized_routes: List[Dict[str, Any]] = []
        for idx, item in enumerate(candidates):
            polyline = item.get("polyline") or item.get("shape") or ""
            if polyline:
                coords = _decode_polyline(polyline)
            else:
                coords = _coerce_coordinates(item.get("coordinates"), req)

            duration_value = float(item.get("duration", 0.0))
            duration_s = float(item.get("duration_s", duration_value * 60.0))

            normalized_routes.append(
                {
                    "type": route_labels[idx] if idx < len(route_labels) else f"Route-{idx + 1}",
                    "distance_km": float(item.get("distance_km", item.get("distance", 0.0))),
                    "duration_s": duration_s,
                    "polyline": polyline,
                    "coordinates": coords,
                    "traffic_penalty": float(item.get("traffic_penalty", 1.0)),
                }
            )
        return normalized_routes

    if isinstance(payload.get("routes"), list) and payload["routes"]:
        normalized_routes: List[Dict[str, Any]] = []
        for item in payload["routes"]:
            polyline = item.get("polyline") or item.get("shape") or ""
            coords = _decode_polyline(polyline) if polyline else _coerce_coordinates(item.get("coordinates"), req)
            duration_value = float(item.get("duration", 0.0))
            duration_s = float(item.get("duration_s", duration_value * 60.0))
            normalized_routes.append(
                {
                    "type": item.get("type", "Route"),
                    "distance_km": float(item.get("distance_km", item.get("distance", 0.0))),
                    "duration_s": duration_s,
                    "polyline": polyline,
                    "coordinates": coords,
                    "traffic_penalty": float(item.get("traffic_penalty", 1.0)),
                }
            )
        return normalized_routes

    trip = payload.get("trip")
    if isinstance(trip, dict):
        legs = trip.get("legs", [])
        if not legs:
            return []
        primary_leg = legs[0]
        summary = primary_leg.get("summary", {})
        polyline = primary_leg.get("shape", "")
        coords = _decode_polyline(polyline) if polyline else [(req.start_lat, req.start_lon), (req.end_lat, req.end_lon)]
        distance_km = float(summary.get("length", trip.get("summary", {}).get("length", 0.0)))
        duration_s = float(summary.get("time", trip.get("summary", {}).get("time", 0.0)))
        base_route = {
            "type": "Fastest",
            "distance_km": distance_km,
            "duration_s": duration_s,
            "polyline": polyline,
            "coordinates": coords,
            "traffic_penalty": 1.0,
        }
        return [
            base_route,
            {**base_route, "type": "Shortest", "distance_km": max(distance_km * 0.94, 0.1), "traffic_penalty": 1.1},
            {**base_route, "type": "Eco-Saver", "distance_km": distance_km * 1.03, "traffic_penalty": 0.95},
        ]

    return []


async def get_weather(client: httpx.AsyncClient, lat: float, lon: float) -> float:
    if not SETTINGS.openweather_api_key:
        return 12.0

    try:
        response = await _http_get_json(
            client,
            SETTINGS.openweather_url,
            params={
                "lat": lat,
                "lon": lon,
                "appid": SETTINGS.openweather_api_key,
                "units": SETTINGS.openweather_units,
            },
        )
        return float(response.get("wind", {}).get("speed", 12.0))
    except Exception:
        return 12.0


def _build_valhalla_payload(req: RouteRequest) -> Dict[str, Any]:
    return {
        "locations": [
            {"lat": req.start_lat, "lon": req.start_lon},
            {"lat": req.end_lat, "lon": req.end_lon},
        ],
        "costing": "auto",
        "units": "kilometers",
        "alternates": max(0, SETTINGS.valhalla_alternates),
    }


def _normalize_valhalla_payload(payload: Dict[str, Any], req: RouteRequest) -> List[Dict[str, Any]]:
    route_candidates: List[Dict[str, Any]] = []

    trip = payload.get("trip")
    if isinstance(trip, dict):
        route_candidates.append(trip)

    alternates = payload.get("alternates")
    if isinstance(alternates, list):
        for alt in alternates:
            if isinstance(alt, dict):
                if isinstance(alt.get("trip"), dict):
                    route_candidates.append(alt["trip"])
                else:
                    route_candidates.append(alt)

    routes = payload.get("routes")
    if isinstance(routes, list):
        for item in routes:
            if isinstance(item, dict):
                route_candidates.append(item)

    normalized: List[Dict[str, Any]] = []
    for index, candidate in enumerate(route_candidates):
        legs = candidate.get("legs", []) if isinstance(candidate, dict) else []
        if not legs:
            continue

        leg = legs[0]
        summary = leg.get("summary", {})
        trip_summary = candidate.get("summary", {}) if isinstance(candidate, dict) else {}
        distance_km = float(summary.get("length", trip_summary.get("length", 0.0)))
        duration_s = float(summary.get("time", trip_summary.get("time", 0.0)))
        polyline = leg.get("shape", candidate.get("shape", "")) if isinstance(candidate, dict) else ""
        coords = _decode_polyline(polyline) if polyline else [(req.start_lat, req.start_lon), (req.end_lat, req.end_lon)]

        normalized.append(
            {
                "type": f"Valhalla-{index + 1}",
                "distance_km": distance_km,
                "duration_s": duration_s,
                "polyline": polyline,
                "coordinates": coords,
                "traffic_penalty": 1.0,
            }
        )

    return normalized


async def get_valhalla_routes(client: httpx.AsyncClient, req: RouteRequest) -> List[Dict[str, Any]]:
    payload = _build_valhalla_payload(req)
    logger.info(f"Valhalla request: {payload}")

    try:
        response = await _http_post_json(client, SETTINGS.valhalla_url, payload)
        logger.info(f"Valhalla response keys: {response.keys() if isinstance(response, dict) else 'Not a dict'}")

        normalized = _normalize_valhalla_payload(response, req)
        logger.info(f"Normalized {len(normalized)} routes from Valhalla")
        for i, route in enumerate(normalized):
            logger.info(f"  Route {i+1}: {route['distance_km']:.2f} km, {route['duration_s']:.0f} s")

        return normalized
    except Exception as e:
        logger.error(f"Valhalla API error: {type(e).__name__}: {str(e)}")
        raise


async def get_routes(client: httpx.AsyncClient, req: RouteRequest) -> List[Dict[str, Any]]:
    source = SETTINGS.route_source.lower()

    if source in {"valhalla", "direct", "hybrid", "node"}:
        try:
            logger.info(f"Attempting to get routes via Valhalla for ({req.start_lat}, {req.start_lon}) -> ({req.end_lat}, {req.end_lon})")
            valhalla_routes = await get_valhalla_routes(client, req)
            if valhalla_routes:
                return valhalla_routes
            else:
                logger.warning("Valhalla returned empty routes list")
        except Exception as e:
            logger.error(f"Valhalla routing failed: {type(e).__name__}: {str(e)}")
            if source in {"valhalla", "direct"}:
                raise

    if source in {"node", "hybrid"} and SETTINGS.node_route_api_url:
        try:
            logger.info(f"Attempting to get routes via Node API")
            node_payload = await _http_post_json(
                client,
                SETTINGS.node_route_api_url,
                {
                    "start_lat": req.start_lat,
                    "start_lon": req.start_lon,
                    "end_lat": req.end_lat,
                    "end_lon": req.end_lon,
                    "cargo_weight_kg": req.cargo_weight_kg,
                },
            )
            node_routes = _normalize_node_route_payload(node_payload, req)
            if node_routes:
                return node_routes
        except Exception as e:
            logger.error(f"Node API routing failed: {type(e).__name__}: {str(e)}")
            if source == "node":
                raise

    logger.warning("All routing providers failed, returning fallback routes")
    return _fallback_routes(req)


def _sample_coordinates(points: List[Tuple[float, float]], max_points: int) -> List[Tuple[float, float]]:
    if len(points) <= max_points:
        return points
    indices = np.linspace(0, len(points) - 1, max_points, dtype=int)
    return [points[index] for index in indices]


async def get_elevation_profile(client: httpx.AsyncClient, points: List[Tuple[float, float]]) -> List[float]:
    if not points:
        return []

    sampled = _sample_coordinates(points, SETTINGS.max_elevation_points)
    locations = "|".join(f"{lat},{lon}" for lat, lon in sampled)

    try:
        payload = await _http_get_json(client, SETTINGS.opentopo_url, params={"locations": locations})
        return [float(item.get("elevation", 0.0)) for item in payload.get("results", [])]
    except Exception:
        return [0.0 for _ in sampled]


async def get_tomtom_traffic_penalty(client: httpx.AsyncClient, req: RouteRequest) -> float:
    if not SETTINGS.tomtom_api_key:
        return 1.0

    try:
        route_url = SETTINGS.tomtom_url_template.format(
            start_lat=req.start_lat,
            start_lon=req.start_lon,
            end_lat=req.end_lat,
            end_lon=req.end_lon,
        )
        response = await _http_get_json(
            client,
            route_url,
            params={"traffic": "true", "key": SETTINGS.tomtom_api_key},
        )
        route_summary = response.get("routes", [{}])[0].get("summary", {})
        live_time = float(route_summary.get("travelTimeInSeconds", 0.0))
        free_flow_time = float(route_summary.get("noTrafficTravelTimeInSeconds", 0.0))
        if live_time > 0 and free_flow_time > 0:
            return max(0.8, min(1.4, live_time / free_flow_time))
    except Exception:
        pass

    return 1.0


def _build_grade_profile(distance_m: float, elevation_profile: List[float], target_length: int) -> np.ndarray:
    if len(elevation_profile) < 2 or distance_m <= 0:
        return np.zeros(target_length, dtype=float)

    delta_h = np.diff(np.array(elevation_profile, dtype=float))
    segment_distance_m = max(distance_m / max(len(elevation_profile) - 1, 1), 1.0)
    grades = np.clip(delta_h / segment_distance_m, -0.12, 0.12)
    expanded = np.interp(
        np.linspace(0, len(grades) - 1, target_length),
        np.arange(len(grades)),
        grades,
    )
    return expanded.astype(float)


def translate_tofastsim(route: Dict[str, Any]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    # This is the translation layer between route data and FASTSim cycle arrays.
    # For real Valhalla integration, replace this with polyline decoding + per-second
    # speed/grade extraction from road geometry and elevation.
    distance_km = float(route.get("distance_km", 0.1))
    traffic_penalty = float(route.get("traffic_penalty", 1.0))
    total_distance_m = max(distance_km * 1000.0, 100.0)
    duration_s = float(route.get("duration_s") or 0.0)

    if duration_s <= 0:
        base_speed_mps = 15.0
        effective_speed_mps = max(3.0, base_speed_mps / max(traffic_penalty, 0.1))
        cruise_seconds = max(60, int(np.ceil(total_distance_m / effective_speed_mps)))
    else:
        cruise_seconds = max(60, int(duration_s))
        effective_speed_mps = max(3.0, (total_distance_m / cruise_seconds) / max(traffic_penalty, 0.1))

    ramp_seconds = 12
    time_s = np.arange(0, ramp_seconds + cruise_seconds, dtype=float)

    ramp_profile = np.linspace(0.0, effective_speed_mps, ramp_seconds, endpoint=False)
    cruise_profile = np.full(cruise_seconds, effective_speed_mps, dtype=float)
    mps = np.concatenate([ramp_profile, cruise_profile])
    elevation_profile = route.get("elevation_profile", [])
    grade = _build_grade_profile(total_distance_m, elevation_profile, mps.shape[0])

    return time_s, mps, grade


def _load_heavy_vehicle(cargo_weight: float, wind_speed: float) -> Any:
    """Original hardcoded vehicle loader — used as fallback when no profile is provided."""
    try:
        veh_obj = vehicle.Vehicle.from_file("HEV_truck.csv")
    except Exception:
        veh_obj = vehicle.Vehicle.from_resource("2016_TOYOTA_Prius_Two.yaml")

    if hasattr(veh_obj, "to_pydict") and hasattr(vehicle.Vehicle, "from_pydict"):
        veh_dict = veh_obj.to_pydict()
        veh_dict["mass_kilograms"] = float(veh_dict.get("mass_kilograms", 0.0)) + float(cargo_weight)

        chassis = veh_dict.get("chassis", {}) or {}
        if "drag_coef" in chassis:
            chassis["drag_coef"] = float(chassis["drag_coef"]) * (1.0 + (wind_speed / 1000.0))
            veh_dict["chassis"] = chassis

        return vehicle.Vehicle.from_pydict(veh_dict)

    if hasattr(veh_obj, "veh_kg"):
        veh_obj.veh_kg += cargo_weight
    if hasattr(veh_obj, "drag_coef"):
        veh_obj.drag_coef *= 1.0 + (wind_speed / 1000.0)

    return veh_obj


def _build_vehicle_from_profile(
    profile: VehicleProfile,
    cargo_weight: float,
    wind_speed: float,
) -> Any:
    """Build a FASTSim vehicle object from a user-supplied VehicleProfile.

    Maps real-world vehicle attributes (kerb weight, drag coefficient, frontal area,
    engine displacement / power) onto the FASTSim vehicle parameter dict.
    Falls back to sensible per-type defaults for any missing field.
    """
    vtype = profile.type.lower()

    # --- base vehicle to clone parameter structure from ---
    try:
        base_veh = vehicle.Vehicle.from_file("HEV_truck.csv")
    except Exception:
        base_veh = vehicle.Vehicle.from_resource("2016_TOYOTA_Prius_Two.yaml")

    # 1. Resolve mass  -------------------------------------------------------
    if profile.gross_vehicle_weight_kg and profile.gross_vehicle_weight_kg > 0:
        total_mass = profile.gross_vehicle_weight_kg
    else:
        kerb = profile.kerb_weight_kg or _DEFAULT_MASS_KG.get(vtype, 1400.0)
        # Odometer degradation: ~0.5 % extra mass-equivalent per 100 k km (wear / accessories)
        degradation = 1.0
        if profile.odometer_km and profile.odometer_km > 0:
            degradation = 1.0 + min(profile.odometer_km / 100_000.0, 3.0) * 0.005
        total_mass = (kerb * degradation) + cargo_weight

    # 2. Drag coefficient  ---------------------------------------------------
    drag = profile.drag_coef if profile.drag_coef and profile.drag_coef > 0 else _DEFAULT_DRAG_COEF.get(vtype, 0.35)
    drag *= 1.0 + (wind_speed / 1000.0)  # wind adjustment (same as original)

    # 3. Frontal area  -------------------------------------------------------
    frontal = profile.frontal_area_m2 if profile.frontal_area_m2 and profile.frontal_area_m2 > 0 else _DEFAULT_FRONTAL_AREA.get(vtype, 2.2)

    # 4. Engine / motor power  ------------------------------------------------
    if profile.motor_power_kw and profile.motor_power_kw > 0:
        power_kw = profile.motor_power_kw
    elif profile.horsepower_ps and profile.horsepower_ps > 0:
        power_kw = profile.horsepower_ps * 0.7355  # PS → kW
    elif profile.displacement_cc and profile.displacement_cc > 0:
        # Rough estimate: ~0.05 kW per cc for modern engines
        power_kw = profile.displacement_cc * 0.05
    else:
        power_kw = None  # keep base vehicle default

    # 5. Apply to vehicle  ---------------------------------------------------
    if hasattr(base_veh, "to_pydict") and hasattr(vehicle.Vehicle, "from_pydict"):
        vd = base_veh.to_pydict()
        vd["mass_kilograms"] = total_mass

        chassis = vd.get("chassis", {}) or {}
        chassis["drag_coef"] = drag
        chassis["frontal_area_square_meters"] = frontal
        vd["chassis"] = chassis

        if power_kw is not None:
            # FASTSim v3+ uses nested powertrain; older uses flat fields
            pt = vd.get("powertrain", {}) or {}
            if "fc_max_kw" in pt:
                pt["fc_max_kw"] = power_kw
            elif "motor_max_kw" in pt:
                pt["motor_max_kw"] = power_kw
            vd["powertrain"] = pt

        return vehicle.Vehicle.from_pydict(vd)

    # Legacy FASTSim (flat attrs)  -------------------------------------------
    if hasattr(base_veh, "veh_kg"):
        base_veh.veh_kg = total_mass
    if hasattr(base_veh, "drag_coef"):
        base_veh.drag_coef = drag
    if hasattr(base_veh, "frontal_area_m2"):
        base_veh.frontal_area_m2 = frontal
    if power_kw is not None:
        if hasattr(base_veh, "fc_max_kw"):
            base_veh.fc_max_kw = power_kw
        elif hasattr(base_veh, "mc_max_kw"):
            base_veh.mc_max_kw = power_kw

    return base_veh


def _resolve_vehicle(
    profile: Optional[VehicleProfile],
    cargo_weight: float,
    wind_speed: float,
) -> Any:
    """Return a FASTSim vehicle, using the profile when available or the hardcoded fallback."""
    if profile is not None:
        return _build_vehicle_from_profile(profile, cargo_weight, wind_speed)
    return _load_heavy_vehicle(cargo_weight, wind_speed)


def _create_cycle(time_s: np.ndarray, mps: np.ndarray, grade: np.ndarray) -> Any:
    payload = {
        "time_s": time_s.tolist(),
        "mps": mps.tolist(),
        "grade": grade.tolist(),
    }

    if hasattr(cycle.Cycle, "from_dict"):
        return cycle.Cycle.from_dict(payload)

    return cycle.Cycle.from_pydict(
        {
            "time_seconds": payload["time_s"],
            "speed_mps": payload["mps"],
            "grade": payload["grade"],
        }
    )


def calculate_emissions(
    route: Dict[str, Any],
    cargo_weight: float,
    wind_speed: float,
    profile: Optional[VehicleProfile] = None,
) -> Dict[str, float]:
    """Run emission simulation — uses FASTSim when available, physics fallback otherwise.

    Returns a dict with keys:
      estimated_fuel_liters, estimated_co2_kg, estimated_energy_kwh (EV only), mpgge
    """
    if FASTSIM_AVAILABLE:
        return _calculate_emissions_fastsim(route, cargo_weight, wind_speed, profile)
    return _calculate_emissions_physics(route, cargo_weight, wind_speed, profile)


# ---------------------------------------------------------------------------
# A) FASTSim path  (only used when the package is installed)
# ---------------------------------------------------------------------------

def _calculate_emissions_fastsim(
    route: Dict[str, Any],
    cargo_weight: float,
    wind_speed: float,
    profile: Optional[VehicleProfile] = None,
) -> Dict[str, float]:
    try:
        veh_obj = _resolve_vehicle(profile, cargo_weight, wind_speed)

        time_s, mps, grade = translate_tofastsim(route)
        cyc_obj = _create_cycle(time_s, mps, grade)

        sim = simdrive.SimDriveClassic(cyc_obj, veh_obj)
        sim.sim_drive()

        mpgge = max(float(getattr(sim, "mpgge", 0.0)), 1e-6)
        miles = float(route["distance_km"]) * 0.621371
        gallons = miles / mpgge
        fuel_liters = gallons * 3.78541

        fuel_type = (profile.fuel_type.lower() if profile else "diesel")
        co2_factor = _CO2_FACTOR.get(fuel_type, 2.31)

        if fuel_type == "electric":
            energy_kwh = round(gallons * 33.7, 3)
            return {
                "estimated_fuel_liters": 0.0,
                "estimated_energy_kwh": energy_kwh,
                "estimated_co2_kg": 0.0,
                "mpgge": round(mpgge, 3),
            }

        co2_kg = fuel_liters * co2_factor

        if profile and profile.co2_g_per_km and profile.co2_g_per_km > 0:
            reported_co2_kg = (profile.co2_g_per_km / 1000.0) * float(route["distance_km"])
            co2_kg = (co2_kg + reported_co2_kg) / 2.0
            fuel_liters = co2_kg / co2_factor if co2_factor > 0 else fuel_liters

        return {
            "estimated_fuel_liters": round(fuel_liters, 3),
            "estimated_energy_kwh": 0.0,
            "estimated_co2_kg": round(co2_kg, 3),
            "mpgge": round(mpgge, 3),
        }
    except Exception as exc:
        raise RuntimeError(f"Emission simulation failed: {exc}") from exc


# ---------------------------------------------------------------------------
# B) Physics-based fallback  (no external simulation library needed)
# ---------------------------------------------------------------------------
# Uses fundamental vehicle dynamics:
#   F_total = F_rolling + F_aero + F_grade + F_inertia
#   E_fuel  = integral(F_total · v · dt) / η_drivetrain
# Then converts energy → fuel volume → CO2 mass.
# ---------------------------------------------------------------------------

# Physical constants & defaults
_AIR_DENSITY_KG_M3 = 1.225
_GRAVITY_M_S2 = 9.81
_ROLLING_RESISTANCE: Dict[str, float] = {
    "car": 0.010, "bike": 0.005, "bus": 0.008, "truck": 0.007,
}
# Thermal + drivetrain efficiencies  (tank → wheels)
_THERMAL_EFFICIENCY: Dict[str, float] = {
    "petrol": 0.28, "diesel": 0.35, "gas": 0.30, "hybrid": 0.38, "electric": 0.90,
}
# Energy density  (joules per litre of fuel, or joules per kWh for EV)
_ENERGY_DENSITY_J_PER_L: Dict[str, float] = {
    "petrol": 34_200_000,   # ~34.2 MJ/L
    "diesel": 38_600_000,   # ~38.6 MJ/L
    "gas": 26_800_000,      # ~26.8 MJ/L  (CNG equivalent per litre of petrol equiv.)
    "hybrid": 34_200_000,   # petrol-equivalent
    "electric": 3_600_000,  # 1 kWh = 3.6 MJ  (per kWh, not per litre)
}


def _calculate_emissions_physics(
    route: Dict[str, Any],
    cargo_weight: float,
    wind_speed: float,
    profile: Optional[VehicleProfile] = None,
) -> Dict[str, float]:
    """Compute fuel & CO2 from first-principles vehicle dynamics."""
    try:
        vtype = (profile.type.lower() if profile else "truck")
        fuel_type = (profile.fuel_type.lower() if profile else "diesel")

        # ---- resolve vehicle params ------------------------------------------
        if profile and profile.gross_vehicle_weight_kg and profile.gross_vehicle_weight_kg > 0:
            mass_kg = profile.gross_vehicle_weight_kg
        elif profile and profile.kerb_weight_kg and profile.kerb_weight_kg > 0:
            mass_kg = profile.kerb_weight_kg + cargo_weight
        else:
            mass_kg = _DEFAULT_MASS_KG.get(vtype, 1400.0) + cargo_weight

        drag_coef = (profile.drag_coef if profile and profile.drag_coef and profile.drag_coef > 0
                     else _DEFAULT_DRAG_COEF.get(vtype, 0.35))
        drag_coef *= 1.0 + (wind_speed / 1000.0)

        frontal_area = (profile.frontal_area_m2 if profile and profile.frontal_area_m2 and profile.frontal_area_m2 > 0
                        else _DEFAULT_FRONTAL_AREA.get(vtype, 2.2))

        c_rr = _ROLLING_RESISTANCE.get(vtype, 0.010)
        eta = _THERMAL_EFFICIENCY.get(fuel_type, 0.30)

        # ---- build drive cycle arrays from route data ------------------------
        time_s, mps, grade = translate_tofastsim(route)
        n = len(time_s)

        # ---- integrate forces over the cycle ---------------------------------
        total_energy_j = 0.0
        for i in range(1, n):
            dt = float(time_s[i] - time_s[i - 1])
            if dt <= 0:
                continue
            v = float(mps[i])
            v_prev = float(mps[i - 1])
            g = float(grade[i]) if i < len(grade) else 0.0

            # Forces at this timestep  (Newtons)
            f_rolling = c_rr * mass_kg * _GRAVITY_M_S2 * math.cos(math.atan(g))
            f_aero = 0.5 * _AIR_DENSITY_KG_M3 * drag_coef * frontal_area * v * v
            f_grade = mass_kg * _GRAVITY_M_S2 * math.sin(math.atan(g))
            f_inertia = mass_kg * (v - v_prev) / dt if dt > 0 else 0.0

            f_total = f_rolling + f_aero + f_grade + f_inertia
            # Only count positive traction (braking energy not recovered for ICE)
            if fuel_type != "electric":
                f_total = max(f_total, 0.0)
            # For EVs, negative means regenerative braking (~60% recovery)
            elif f_total < 0:
                f_total *= 0.4  # only 60% recovered, so 40% loss

            # Energy = Force × velocity × time
            energy_j = f_total * v * dt
            total_energy_j += energy_j

        total_energy_j = max(total_energy_j, 0.0)

        # ---- convert energy at wheels → fuel / electricity -------------------
        fuel_energy_j = total_energy_j / max(eta, 0.05)

        is_ev = fuel_type == "electric"
        if is_ev:
            energy_kwh = round(fuel_energy_j / 3_600_000.0, 3)
            return {
                "estimated_fuel_liters": 0.0,
                "estimated_energy_kwh": energy_kwh,
                "estimated_co2_kg": 0.0,
                "mpgge": round((float(route["distance_km"]) * 0.621371) / max(energy_kwh / 33.7, 1e-6), 3) if energy_kwh > 0 else 0.0,
            }

        e_density = _ENERGY_DENSITY_J_PER_L.get(fuel_type, 34_200_000)
        fuel_liters = fuel_energy_j / e_density
        co2_factor = _CO2_FACTOR.get(fuel_type, 2.31)
        co2_kg = fuel_liters * co2_factor

        # MPGge conversion: 1 GGE = 120 MJ
        gge = fuel_energy_j / 120_000_000.0
        miles = float(route["distance_km"]) * 0.621371
        mpgge = miles / gge if gge > 0 else 0.0

        # Blend with voice/image reported CO2 if available
        if profile and profile.co2_g_per_km and profile.co2_g_per_km > 0:
            reported_co2_kg = (profile.co2_g_per_km / 1000.0) * float(route["distance_km"])
            co2_kg = (co2_kg + reported_co2_kg) / 2.0
            fuel_liters = co2_kg / co2_factor if co2_factor > 0 else fuel_liters

        return {
            "estimated_fuel_liters": round(fuel_liters, 3),
            "estimated_energy_kwh": 0.0,
            "estimated_co2_kg": round(co2_kg, 3),
            "mpgge": round(mpgge, 3),
        }
    except Exception as exc:
        raise RuntimeError(f"Emission simulation failed (physics): {exc}") from exc


def _evaluate_routes(
    routes: List[Dict[str, Any]],
    cargo_weight: float,
    wind_speed: float,
    profile: Optional[VehicleProfile] = None,
) -> List[Dict[str, Any]]:
    evaluated: List[Dict[str, Any]] = []
    for index, route in enumerate(routes):
        result = calculate_emissions(
            route=route,
            cargo_weight=cargo_weight,
            wind_speed=wind_speed,
            profile=profile,
        )
        evaluated.append(
            {
                "index": index,
                "type": route.get("type", f"Route-{index + 1}"),
                "distance_km": float(route.get("distance_km", 0.0)),
                "duration_s": float(route.get("duration_s", 0.0)),
                "estimated_fuel_liters": result["estimated_fuel_liters"],
                "estimated_energy_kwh": result.get("estimated_energy_kwh", 0.0),
                "estimated_co2_kg": result["estimated_co2_kg"],
                "mpgge": result.get("mpgge", 0.0),
            }
        )
    return evaluated


def _build_business_routes(evaluated: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not evaluated:
        return []

    fastest = min(evaluated, key=lambda route: (route["duration_s"], route["distance_km"], route["estimated_co2_kg"]))
    shortest = min(evaluated, key=lambda route: (route["distance_km"], route["duration_s"], route["estimated_co2_kg"]))
    least_co2 = min(evaluated, key=lambda route: (route["estimated_co2_kg"], route["estimated_fuel_liters"], route["duration_s"]))

    def to_response(route: Dict[str, Any], label: str) -> Dict[str, Any]:
        resp = {
            "type": label,
            "distance_km": route["distance_km"],
            "estimated_fuel_liters": route["estimated_fuel_liters"],
            "estimated_co2_kg": route["estimated_co2_kg"],
            "source_type": route["type"],
        }
        if route.get("estimated_energy_kwh", 0.0) > 0:
            resp["estimated_energy_kwh"] = route["estimated_energy_kwh"]
        return resp

    return [
        to_response(fastest, "Fastest"),
        to_response(shortest, "Shortest"),
        to_response(least_co2, "Least-CO2"),
    ]


def _build_all_routes_response(evaluated: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ranked = sorted(evaluated, key=lambda route: (route["estimated_co2_kg"], route["estimated_fuel_liters"], route["duration_s"]))
    result = []
    for index, route in enumerate(ranked):
        entry: Dict[str, Any] = {
            "rank_by_co2": index + 1,
            "source_type": route["type"],
            "distance_km": route["distance_km"],
            "duration_s": route["duration_s"],
            "estimated_fuel_liters": route["estimated_fuel_liters"],
            "estimated_co2_kg": route["estimated_co2_kg"],
        }
        if route.get("estimated_energy_kwh", 0.0) > 0:
            entry["estimated_energy_kwh"] = route["estimated_energy_kwh"]
        result.append(entry)
    return result


def _vehicle_used_metadata(profile: Optional[VehicleProfile]) -> Dict[str, Any]:
    """Return metadata about the vehicle that drove the simulation."""
    if profile is None:
        return {"source": "default_hardcoded", "description": "HEV_truck.csv / 2016 Toyota Prius fallback"}
    return {
        "source": "user_profile",
        "type": profile.type,
        "fuel_type": profile.fuel_type,
        "make": profile.make,
        "model": profile.model,
        "kerb_weight_kg": profile.kerb_weight_kg,
        "frontal_area_m2": profile.frontal_area_m2,
        "horsepower_ps": profile.horsepower_ps,
        "displacement_cc": profile.displacement_cc,
        "co2_factor_used": _CO2_FACTOR.get(profile.fuel_type.lower(), 2.31),
    }


@app.post("/api/get-eco-routes")
async def get_eco_routes(req: RouteRequest) -> Dict[str, Any]:
    try:
        _validate_coordinates(req)

        async with httpx.AsyncClient(timeout=SETTINGS.request_timeout_s) as client:
            routes = await get_routes(client, req)

            if not routes:
                raise HTTPException(status_code=502, detail="Unable to fetch route data")

            wind_speed = await get_weather(client, req.start_lat, req.start_lon)
            traffic_penalty = await get_tomtom_traffic_penalty(client, req)

            for route in routes:
                route["traffic_penalty"] = float(route.get("traffic_penalty", 1.0)) * traffic_penalty
                route["elevation_profile"] = await get_elevation_profile(client, route.get("coordinates", []))

        evaluated_routes = _evaluate_routes(routes, req.cargo_weight_kg, wind_speed, req.vehicle_profile)
        response_routes = _build_business_routes(evaluated_routes)
        all_routes_response = _build_all_routes_response(evaluated_routes)

        response: Dict[str, Any] = {
            "routes": response_routes,
            "all_routes": all_routes_response,
            "total_candidates_evaluated": len(all_routes_response),
            "vehicle_used": _vehicle_used_metadata(req.vehicle_profile),
        }

        return response
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "route_source": SETTINGS.route_source,
        "node_route_api_configured": bool(SETTINGS.node_route_api_url),
        "openweather_configured": bool(SETTINGS.openweather_api_key),
        "tomtom_configured": bool(SETTINGS.tomtom_api_key),
        "vehicle_profile_support": True,
    }
