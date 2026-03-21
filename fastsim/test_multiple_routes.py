import requests
import json
import time

def test_route(name, start_lat, start_lon, end_lat, end_lon):
    """Test a single route and return results"""
    payload = {
        'start_lat': start_lat,
        'start_lon': start_lon,
        'end_lat': end_lat,
        'end_lon': end_lon,
        'cargo_weight_kg': 1200,
        'include_all_routes': True
    }

    try:
        response = requests.post('http://127.0.0.1:8000/api/get-eco-routes', json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            return {"error": f"Status code: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def print_results(name, data):
    """Pretty print the results"""
    print(f"\n{'='*60}")
    print(f"Route: {name}")
    print(f"{'='*60}")

    if "error" in data:
        print(f"ERROR: {data['error']}")
        return

    if "all_routes" in data:
        print(f"\nTotal routes found: {data['total_candidates_evaluated']}")
        print("\nAll Routes (ranked by CO2):")
        for i, route in enumerate(data['all_routes'], 1):
            print(f"  {i}. {route['source_type']}: {route['distance_km']:.2f} km, {route['duration_s']:.0f} s, {route['estimated_co2_kg']:.3f} kg CO2")

    if "routes" in data:
        print("\nBusiness Routes:")
        for route in data['routes']:
            print(f"  {route['type']}: {route['distance_km']:.2f} km, {route['estimated_co2_kg']:.3f} kg CO2 (from {route['source_type']})")

# Test cases
test_cases = [
    ("Delhi to Mumbai (Long)", 28.7041, 77.1025, 19.0760, 72.8777),
    ("Surat to Mumbai (Medium)", 21.1702, 72.8311, 19.0760, 72.8777),
    ("Bangalore to Chennai (Medium)", 12.9716, 77.5946, 13.0827, 80.2707),
    ("Mumbai to Pune (Short)", 19.0760, 72.8777, 18.5204, 73.8567),
    ("Ahmedabad to Vadodara (Short)", 23.0225, 72.5714, 22.3072, 73.1812),
]

print("Starting route tests...")
print(f"Testing {len(test_cases)} different routes\n")

results = []
for name, start_lat, start_lon, end_lat, end_lon in test_cases:
    print(f"Testing: {name}...")
    data = test_route(name, start_lat, start_lon, end_lat, end_lon)
    results.append((name, data))
    time.sleep(1)  # Small delay between requests

# Print all results
print("\n\n" + "="*60)
print("TEST RESULTS SUMMARY")
print("="*60)

for name, data in results:
    print_results(name, data)

# Check for issues
print("\n\n" + "="*60)
print("ISSUE DETECTION")
print("="*60)

# Check if all routes give different distances
distances = []
for name, data in results:
    if "all_routes" in data and data['all_routes']:
        distances.append((name, data['all_routes'][0]['distance_km']))

print("\nDistance comparison:")
for name, dist in distances:
    print(f"  {name}: {dist:.2f} km")

# Check if we're getting the same distance for different routes
if len(set([d for _, d in distances])) < len(distances):
    print("\n⚠️  WARNING: Some routes have identical distances - possible bug!")
else:
    print("\n✅ All routes have different distances - working correctly!")

# Check if we're getting multiple alternates
print("\nAlternate routes check:")
for name, data in results:
    if "all_routes" in data:
        num_routes = len(data['all_routes'])
        print(f"  {name}: {num_routes} alternates")
        if num_routes < 2:
            print(f"    ⚠️  WARNING: Only {num_routes} route(s) found!")
