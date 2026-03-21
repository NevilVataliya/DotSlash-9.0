import requests
import json

def test_route(name, start_lat, start_lon, end_lat, end_lon):
    """Test a single route and print summary"""
    payload = {
        'start_lat': start_lat,
        'start_lon': start_lon,
        'end_lat': end_lat,
        'end_lon': end_lon,
        'cargo_weight_kg': 1200,
        'include_all_routes': True
    }

    try:
        response = requests.post('http://127.0.0.1:8000/api/get-eco-routes', json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()

            print(f"\n{'='*70}")
            print(f"Route: {name}")
            print(f"Coordinates: ({start_lat}, {start_lon}) -> ({end_lat}, {end_lon})")
            print(f"{'='*70}")

            # Print all alternates found
            if "all_routes" in data:
                print(f"\nTotal alternates from Valhalla: {len(data['all_routes'])}")
                print("\nAll Alternates (ranked by CO2):")
                for i, route in enumerate(data['all_routes'], 1):
                    print(f"  {i}. {route['source_type']}: "
                          f"{route['distance_km']:.2f} km, "
                          f"{route['duration_s']/60:.1f} min, "
                          f"{route['estimated_co2_kg']:.3f} kg CO2")

            # Print business routes
            if "routes" in data:
                print("\nBusiness Routes Selected:")
                for route in data['routes']:
                    print(f"  {route['type']:12} -> {route['source_type']:12} "
                          f"({route['distance_km']:.2f} km, {route['estimated_co2_kg']:.3f} kg CO2)")

                # Check if all business routes are the same
                sources = [r['source_type'] for r in data['routes']]
                if len(set(sources)) == 1:
                    print(f"\n  STATUS: All business routes use the SAME source ({sources[0]})")
                else:
                    print(f"\n  STATUS: Business routes use DIFFERENT sources")

            return True
        else:
            print(f"\nERROR: Status code {response.status_code}")
            return False
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        return False

# Test cases - variety of distances
test_cases = [
    ("Mumbai to Pune (150 km)", 19.0760, 72.8777, 18.5204, 73.8567),
    ("Surat to Mumbai (280 km)", 21.1702, 72.8311, 19.0760, 72.8777),
    ("Bangalore to Chennai (350 km)", 12.9716, 77.5946, 13.0827, 80.2707),
    ("Ahmedabad to Vadodara (100 km)", 23.0225, 72.5714, 22.3072, 73.1812),
    ("Delhi to Jaipur (280 km)", 28.7041, 77.1025, 26.9124, 75.7873),
]

print("="*70)
print("TESTING MULTIPLE ROUTES TO CHECK FOR DIVERSITY")
print("="*70)
print("Testing 5 different routes to see if Valhalla provides diverse alternates")
print("and whether business routes (Fastest/Shortest/Least-CO2) are different.\n")

success_count = 0
for name, start_lat, start_lon, end_lat, end_lon in test_cases:
    if test_route(name, start_lat, start_lon, end_lat, end_lon):
        success_count += 1

print(f"\n\n{'='*70}")
print(f"SUMMARY: {success_count}/{len(test_cases)} tests completed successfully")
print(f"{'='*70}")
