import mongoose from "mongoose";
import Pool from "../models/Pool.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Driver creates a new pool (ready to pool)
const userIsReadyToPool = asyncHandler(async (req, res) => {
  const { 
    tripId, 
    originLat, 
    originLng, 
    destLat, 
    destLng, 
    departureTime, 
    availableSeats, 
    pricePerSeat 
  } = req.body;

  const driverId = req.user._id;

  if (!tripId || !originLat || !originLng || !destLat || !destLng || !departureTime || !availableSeats || pricePerSeat === undefined) {
    throw new ApiError(400, "All fields are required to create a pool.");
  }

  const pool = await Pool.create({
    driverId,
    tripId,
    origin: {
      type: 'Point',
      coordinates: [originLng, originLat] 
    },
    destination: {
      type: 'Point',
      coordinates: [destLng, destLat]
    },
    departureTime,
    availableSeats,
    pricePerSeat,
    status: "scheduled"
  });

  return res.status(201).json(
    new ApiResponse(201, pool, "Pool created successfully. You are now ready to pool.")
  );
});

// 2. Passenger checks available pools
const checkAvailableForPool = asyncHandler(async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, seatsNeeded = 1 } = req.query;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new ApiError(400, "Pickup and dropoff coordinates are required.");
  }

  // Max distance to walk or deviate (in meters). Example: 5000 meters = 5 km
  const maxDistanceMeters = 5000; 

  // We find pools where the origin is near the passenger's pickup location
  // and the destination is near the passenger's dropoff location.
  // Note: For a true route matching, we would need to check if the pickup/dropoff 
  // lie ALONG the route, but matching origin/destination proximity is a good start.
  
  const availablePools = await Pool.find({
    status: "scheduled",
    availableSeats: { $gte: Number(seatsNeeded) },
    origin: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [Number(pickupLng), Number(pickupLat)]
        },
        $maxDistance: maxDistanceMeters
      }
    }
  });

  // Filter the results to also check if the driver's destination is near the passenger's dropoff
  // (Since MongoDB only allows one $near query per find, we do this second step in memory, 
  // or we could use $geoWithin for the second property).
  const calculateDistance = (coord1, coord2) => {
    // simplified equirectangular approximation or just use a geospatial library
    // For now, we will just return all pools found near origin as a baseline,
    // assuming they are heading in the same general direction.
    // In a fully robust system, you'd use Turf.js or similar to check route intersection.
    return true; 
  };

  return res.status(200).json(
    new ApiResponse(200, availablePools, "Available pools fetched successfully")
  );
});

// 3. Passenger requests to join a pool
const requestPool = asyncHandler(async (req, res) => {
  const { poolId, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;
  const passengerId = req.user._id;

  if (!poolId || !pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new ApiError(400, "Missing required fields for requesting a pool.");
  }

  const pool = await Pool.findById(poolId);
  if (!pool) {
    throw new ApiError(404, "Pool not found.");
  }

  if (pool.availableSeats < 1) {
    throw new ApiError(400, "No available seats in this pool.");
  }

  // Check if passenger already requested
  const existingPassenger = pool.passengers.find(p => p.userId.toString() === passengerId);
  if (existingPassenger) {
    throw new ApiError(400, "You have already requested this pool.");
  }

  pool.passengers.push({
    userId: passengerId,
    pickupLocation: {
      type: 'Point',
      coordinates: [pickupLng, pickupLat]
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: [dropoffLng, dropoffLat]
    },
    price: pool.pricePerSeat, // default price or calculate based on distance
    status: "pending"
  });

  await pool.save();

  return res.status(200).json(
    new ApiResponse(200, pool, "Pool request sent successfully.")
  );
});

// 4. Driver accepts a pool request
const acceptPool = asyncHandler(async (req, res) => {
  const { poolId, passengerId } = req.body;

  const pool = await Pool.findById(poolId);
  if (!pool) {
    throw new ApiError(404, "Pool not found.");
  }

  const passengerIndex = pool.passengers.findIndex(p => p.userId.toString() === passengerId);
  if (passengerIndex === -1) {
    throw new ApiError(404, "Passenger request not found in this pool.");
  }

  const passengerRequest = pool.passengers[passengerIndex];
  if (passengerRequest.status !== "pending") {
    throw new ApiError(400, "This request is already " + passengerRequest.status);
  }

  if (pool.availableSeats < 1) {
    throw new ApiError(400, "Not enough available seats to accept more passengers.");
  }

  // Update status and decrement seats
  pool.passengers[passengerIndex].status = "accepted";
  pool.availableSeats -= 1;

  await pool.save();

  return res.status(200).json(
    new ApiResponse(200, pool, "Passenger request accepted.")
  );
});

// 5. Passenger gets their pool status
const poolStatus = asyncHandler(async (req, res) => {
  const { poolId, passengerId } = req.params;

  const pool = await Pool.findById(poolId);
  if (!pool) {
    throw new ApiError(404, "Pool not found.");
  }

  const passengerRequest = pool.passengers.find(p => p.userId.toString() === passengerId.toString());
  if (!passengerRequest) {
    throw new ApiError(404, "You have not requested this pool.");
  }

  return res.status(200).json(
    new ApiResponse(200, passengerRequest, "Pool request status retrieved.")
  );
});


// 6. Get all available pools (for frontend display when not searching)
const getAllPools = asyncHandler(async (req, res) => {
  const pools = await Pool.find({ status: "scheduled", availableSeats: { $gt: 0 } })
    .populate("driverId", "fullName email username")
    .sort({ departureTime: 1 });

  return res.status(200).json(
    new ApiResponse(200, pools, "All available pools fetched successfully")
  );
});

// 7. Get driver's own pools (for "My Rides" and "Incoming Requests")
const getDriverPools = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    throw new ApiError(400, "Invalid driver ID.");
  }

  const pools = await Pool.find({ driverId })
    .populate("passengers.userId", "fullName email username")
    .sort({ departureTime: -1 });

  return res.status(200).json(
    new ApiResponse(200, pools, "Driver pools fetched successfully")
  );
});

// 8. Driver declines a pool request
const declinePool = asyncHandler(async (req, res) => {
  const { poolId, passengerId } = req.body;

  const pool = await Pool.findById(poolId);
  if (!pool) {
    throw new ApiError(404, "Pool not found.");
  }

  const passengerIndex = pool.passengers.findIndex(p => p.userId.toString() === passengerId);
  if (passengerIndex === -1) {
    throw new ApiError(404, "Passenger request not found in this pool.");
  }

  const passengerRequest = pool.passengers[passengerIndex];
  if (passengerRequest.status !== "pending") {
    throw new ApiError(400, "This request is already " + passengerRequest.status);
  }

  pool.passengers[passengerIndex].status = "rejected";
  await pool.save();

  return res.status(200).json(
    new ApiResponse(200, pool, "Passenger request declined.")
  );
});

export {
  userIsReadyToPool,
  checkAvailableForPool,
  requestPool,
  acceptPool,
  declinePool,
  poolStatus,
  getAllPools,
  getDriverPools
};
