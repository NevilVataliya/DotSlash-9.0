# Ideaotic — DotSlash 9.0 Project

Ideaotic is a multi-service sustainable mobility platform built for **DotSlash 9.0**. It combines intelligent route planning, fuel/CO₂ optimization, ride pooling, and eco-credit tracking into one unified system.

## What This Project Solves

- Generates and compares routes by speed, distance, fuel efficiency, and emissions.
- Helps users choose greener travel options with transparent fuel/CO₂ metrics.
- Supports ride pooling on top of the same mobility network.
- Works with online APIs and includes offline-first behavior in the frontend.
## 🚀 Live Demo

**Try it now:** [https://dot-slash-9-0-qviv.vercel.app/](https://dot-slash-9-0-qviv.vercel.app/)

See the platform in action with route planning, eco-credits, and ride pooling features.
## System Architecture

The platform is split into four primary modules:

1. **Frontend (`frontend/`)**
   - React + Vite + Leaflet PWA
   - Route planning UI, live navigation, map visualization
   - Ride pool, user profile, and eco-dashboard features

2. **Backend API (`backend/`)**
   - Node.js + Express + MongoDB (Mongoose)
   - Authentication, user/vehicle/trip management
   - Pool and eco-credit business APIs

3. **Routing Orchestrator (`routing/`)**
   - Node.js + Express service for route intelligence
   - Integrates Valhalla + TomTom + optimization logic
   - Returns route candidates such as fastest, shortest, fuel-optimized, and least-CO₂

4. **FASTSim Emissions Service (`fastsim/`)**
   - Python FastAPI service for emissions-oriented route evaluation
   - Multi-route eco analysis and health endpoints

## Repository Structure

```text
Ideaotic/
├── backend/      # Core API, auth, data models, business controllers
├── frontend/     # React web app + PWA client
├── routing/      # Route aggregation and optimization service
├── fastsim/      # Python FastAPI eco/emissions service
└── package.json  # Root-level shared dependencies
```

## Core Features

- **Multi-route comparison** (fastest, shortest, fuel-optimized, low-carbon)
- **Live + fallback routing strategy** using multiple providers
- **Ride pooling workflow** (driver ready, passenger request, status tracking)
- **Eco credit tracking** based on greener travel behavior
- **PWA + offline support** (service worker, cached map tiles, offline route storage)

## Technology Stack

- **Frontend:** React 19, Vite, React Router, Leaflet
- **Backend:** Node.js, Express, Mongoose, JWT, Multer
- **Routing:** Express, Axios, custom fuel/CO₂ optimizer
- **Emissions Service:** FastAPI, Uvicorn, NumPy, Requests/HTTPX
- **Data Store:** MongoDB

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.11+
- MongoDB instance

## Environment Variables

Create local `.env` files for each service as needed.

### Backend (`backend/.env`)

```env
PORT=5000
HOST=0.0.0.0
SERVER_PUBLIC_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5173

MONGO_URI=mongodb://localhost:27017

ACCESS_TOKEN_SECRET=replace_me
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=replace_me
REFRESH_TOKEN_EXPIRY=7d

GEMINI_API_KEY=replace_me
```

### Routing (`routing/.env`)

```env
PORT=3001
HOST=0.0.0.0
ROUTING_PUBLIC_URL=http://localhost:3001

TOMTOM_API_KEY=replace_me
TOMTOM_TRAFFIC_BASE_URL=https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
TOMTOM_ROUTING_BASE_URL=https://api.tomtom.com/routing/1

VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de/route

OPENWEATHER_API_KEY=replace_me
OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5/weather

OPEN_TOPO_DATA_API_KEY=replace_me
OPEN_TOPO_BASE_URL=https://api.opentopodata.org/v1/srtm90m

ROUTING_API_URL=http://localhost:3001/api/route
```

### FASTSim (`fastsim/.env`)

```env
NODE_ROUTE_API_URL=http://localhost:3001/api/route
OPENWEATHER_API_KEY=replace_me
TOMTOM_API_KEY=replace_me
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=/api/v1
VITE_API_BASE_URL=/api/v1
VITE_ROUTING_API_URL=/api/route

VITE_GEOCODING_BASE_URL=https://nominatim.openstreetmap.org

VITE_MAP_TILE_URL=https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
VITE_MAP_TILE_ATTRIBUTION=&copy; OpenStreetMap &copy; CARTO

VITE_FUEL_API_URL=https://fuel.indianapi.in/live_fuel_price?fuel_type=petrol&location_type=state
VITE_API_KEY_FUEL=replace_me
```

## Local Development Setup

Install dependencies:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Routing
cd ../routing
npm install

# FASTSim
cd ../fastsim
pip install -r requirements.txt
```

Run all services in separate terminals:

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd routing
npm run dev

# Terminal 3
cd fastsim
python -m uvicorn server:app --reload

# Terminal 4
cd frontend
npm run dev
```

Default local endpoints:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Routing API: `http://localhost:3001`
- FASTSim API: `http://localhost:8000`

## Service Commands

### Backend

```bash
cd backend
npm run dev
node src/server.js
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

### Routing

```bash
cd routing
npm run dev
npm start
node test-api.js
node test-optimizer.js
node final-verify.js
```

### FASTSim

```bash
cd fastsim
python -m uvicorn server:app --host 127.0.0.1 --port 8000
python -m pytest tests/
python test_multiple_routes.py
python test_summary.py
```

## API Surface (High-Level)

- `backend` routes under `/api/v1`:
  - `/users`, `/vehicles`, `/trips`, `/pools`, `/credits`
- `routing` route endpoint:
  - `POST /api/route`
- `fastsim` endpoints:
  - `POST /api/get-eco-routes`
  - `GET /health`

## Deployment Notes

- Keep API keys and secrets server-side
- Configure CORS and public URLs explicitly per environment.
- Ensure MongoDB connectivity before launching backend APIs.
- For production, prefer process managers and containerization (not yet included in this repo).

## Project Status

This is the DotSlash 9.0 implementation snapshot and is functional for local development and demo workflows.

## Acknowledgement

Built as a collaborative DotSlash 9.0 project focused on greener mobility, route intelligence, and practical eco-optimization.
