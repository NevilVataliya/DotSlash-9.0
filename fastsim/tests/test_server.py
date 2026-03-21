import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from server import (
    RouteRequest,
    VehicleProfile,
    _build_business_routes,
    _build_vehicle_from_profile,
    _normalize_node_route_payload,
    _normalize_valhalla_payload,
    _CO2_FACTOR,
    _DEFAULT_MASS_KG,
    app,
)


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.req = RouteRequest(
            start_lat=21.1702,
            start_lon=72.8311,
            end_lat=19.0760,
            end_lon=72.8777,
            cargo_weight_kg=1000,
        )

    def test_normalize_primary_alternates_shape(self):
        payload = {
            "primary": {
                "distance": 285.4,
                "duration": 300.0,
                "coordinates": [[21.1702, 72.8311], [19.0760, 72.8777]],
            },
            "alternates": [
                {"distance": 300.0, "duration": 290.0, "coordinates": [[21.1702, 72.8311], [20.1, 72.85], [19.0760, 72.8777]]},
                {"distance": 275.0, "duration": 340.0, "coordinates": [[21.1702, 72.8311], [20.0, 72.84], [19.0760, 72.8777]]},
            ],
        }
        routes = _normalize_node_route_payload(payload, self.req)
        self.assertEqual(len(routes), 3)
        self.assertEqual(routes[0]["type"], "Fastest")
        self.assertEqual(routes[1]["type"], "Shortest")
        self.assertEqual(routes[2]["type"], "Eco-Saver")
        self.assertEqual(routes[0]["duration_s"], 18000.0)

    def test_normalize_trip_shape(self):
        payload = {
            "trip": {
                "summary": {"length": 296.768, "time": 32643.8},
                "legs": [
                    {
                        "summary": {"length": 296.768, "time": 32643.8},
                        "shape": "",
                    }
                ],
            }
        }
        routes = _normalize_node_route_payload(payload, self.req)
        self.assertEqual(len(routes), 3)
        self.assertGreater(routes[0]["distance_km"], 0)

    def test_normalize_valhalla_alternates(self):
        payload = {
            "trip": {
                "summary": {"length": 300.0, "time": 30000.0},
                "legs": [{"summary": {"length": 300.0, "time": 30000.0}, "shape": ""}],
            },
            "alternates": [
                {
                    "trip": {
                        "summary": {"length": 310.0, "time": 30500.0},
                        "legs": [{"summary": {"length": 310.0, "time": 30500.0}, "shape": ""}],
                    }
                },
                {
                    "summary": {"length": 290.0, "time": 32000.0},
                    "legs": [{"summary": {"length": 290.0, "time": 32000.0}, "shape": ""}],
                },
            ],
        }
        routes = _normalize_valhalla_payload(payload, self.req)
        self.assertEqual(len(routes), 3)
        self.assertEqual(routes[0]["type"], "Valhalla-1")
        self.assertEqual(routes[1]["type"], "Valhalla-2")
        self.assertEqual(routes[2]["type"], "Valhalla-3")

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_business_routes_choose_true_metric_winners(self):
        evaluated = [
            {
                "index": 0,
                "type": "Valhalla-1",
                "distance_km": 296.768,
                "duration_s": 32643.8,
                "estimated_fuel_liters": 10.092,
                "estimated_co2_kg": 27.045,
            },
            {
                "index": 1,
                "type": "Valhalla-2",
                "distance_km": 346.683,
                "duration_s": 34000.0,
                "estimated_fuel_liters": 11.888,
                "estimated_co2_kg": 31.860,
            },
            {
                "index": 2,
                "type": "Valhalla-3",
                "distance_km": 431.098,
                "duration_s": 39000.0,
                "estimated_fuel_liters": 14.258,
                "estimated_co2_kg": 38.212,
            },
        ]

        routes = _build_business_routes(evaluated)
        self.assertEqual(routes[0]["source_type"], "Valhalla-1")
        self.assertEqual(routes[1]["source_type"], "Valhalla-1")
        self.assertEqual(routes[2]["source_type"], "Valhalla-1")
        self.assertLessEqual(routes[2]["estimated_co2_kg"], routes[0]["estimated_co2_kg"])
        self.assertLessEqual(routes[2]["estimated_co2_kg"], routes[1]["estimated_co2_kg"])

    def test_eco_routes_happy_path(self):
        payload = {
            "start_lat": 21.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 1200,
        }
        response = self.client.post("/api/get-eco-routes", json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("routes", body)
        self.assertEqual(len(body["routes"]), 3)
        labels = [route["type"] for route in body["routes"]]
        self.assertEqual(labels, ["Fastest", "Shortest", "Least-CO2"])
        self.assertTrue(all("estimated_fuel_liters" in route for route in body["routes"]))
        self.assertTrue(all("estimated_co2_kg" in route for route in body["routes"]))
        self.assertTrue(all("polyline" not in route for route in body["routes"]))
        self.assertIn("all_routes", body)
        self.assertIn("total_candidates_evaluated", body)
        self.assertEqual(body["total_candidates_evaluated"], len(body["all_routes"]))

    def test_eco_routes_include_all_candidates(self):
        payload = {
            "start_lat": 21.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 1200,
            "include_all_routes": True,
        }
        response = self.client.post("/api/get-eco-routes", json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("all_routes", body)
        self.assertIn("total_candidates_evaluated", body)
        self.assertEqual(body["total_candidates_evaluated"], len(body["all_routes"]))
        self.assertGreaterEqual(body["total_candidates_evaluated"], 1)
        self.assertTrue(all("estimated_co2_kg" in route for route in body["all_routes"]))
        self.assertTrue(all("source_type" in route for route in body["all_routes"]))

    def test_eco_routes_invalid_coordinate(self):
        payload = {
            "start_lat": 121.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 1200,
        }
        response = self.client.post("/api/get-eco-routes", json=payload)
        self.assertEqual(response.status_code, 400)

    def test_eco_routes_provider_failure_still_500(self):
        payload = {
            "start_lat": 21.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 1200,
        }
        with patch("server.get_routes", new=AsyncMock(return_value=[])):
            response = self.client.post("/api/get-eco-routes", json=payload)
            self.assertEqual(response.status_code, 502)

    # === NEW: Vehicle Profile Tests ===

    def test_eco_routes_with_diesel_truck_profile(self):
        """POST with a diesel truck VehicleProfile → response has vehicle_used metadata."""
        payload = {
            "start_lat": 21.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 1200,
            "include_all_routes": True,
            "vehicle_profile": {
                "type": "truck",
                "fuel_type": "diesel",
                "kerb_weight_kg": 5000,
                "horsepower_ps": 180,
                "displacement_cc": 3500,
                "frontal_area_m2": 6.5,
            },
        }
        response = self.client.post("/api/get-eco-routes", json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.json()

        # Must have vehicle_used metadata
        self.assertIn("vehicle_used", body)
        vu = body["vehicle_used"]
        self.assertEqual(vu["source"], "user_profile")
        self.assertEqual(vu["type"], "truck")
        self.assertEqual(vu["fuel_type"], "diesel")
        self.assertAlmostEqual(vu["co2_factor_used"], 2.68, places=2)

        # Standard response structure still valid
        self.assertIn("routes", body)
        self.assertEqual(len(body["routes"]), 3)
        self.assertTrue(all("estimated_co2_kg" in r for r in body["routes"]))
        self.assertTrue(all("estimated_fuel_liters" in r for r in body["routes"]))

    def test_eco_routes_with_ev_profile(self):
        """POST with an electric vehicle profile → fuel_liters = 0, energy_kwh present."""
        payload = {
            "start_lat": 21.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 200,
            "vehicle_profile": {
                "type": "car",
                "fuel_type": "electric",
                "kerb_weight_kg": 1800,
                "motor_power_kw": 150,
                "battery_capacity_kwh": 60,
                "frontal_area_m2": 2.3,
                "drag_coef": 0.23,
            },
        }
        response = self.client.post("/api/get-eco-routes", json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.json()

        self.assertEqual(body["vehicle_used"]["fuel_type"], "electric")
        # For EVs: estimated_fuel_liters = 0, estimated_co2_kg = 0 (tank-to-wheel)
        for route in body["routes"]:
            self.assertEqual(route["estimated_fuel_liters"], 0.0)
            self.assertEqual(route["estimated_co2_kg"], 0.0)

    def test_eco_routes_without_profile_backward_compat(self):
        """POST without vehicle_profile → still works with hardcoded vehicle, no vehicle_used = user_profile."""
        payload = {
            "start_lat": 21.1702,
            "start_lon": 72.8311,
            "end_lat": 19.0760,
            "end_lon": 72.8777,
            "cargo_weight_kg": 1200,
        }
        response = self.client.post("/api/get-eco-routes", json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.json()

        self.assertIn("vehicle_used", body)
        self.assertEqual(body["vehicle_used"]["source"], "default_hardcoded")
        self.assertIn("routes", body)
        self.assertEqual(len(body["routes"]), 3)

    def test_health_shows_vehicle_profile_support(self):
        """GET /health → vehicle_profile_support is True."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body.get("vehicle_profile_support"))


if __name__ == "__main__":
    unittest.main()

