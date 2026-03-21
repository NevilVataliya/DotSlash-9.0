import Parcel from "../models/Parcel.js";
import Pool from "../models/Pool.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Owner creates a new parcel request
const createParcel = asyncHandler(async (req, res) => {
  const { 
    ownerId, // In real app: req.user._id
    weight, 
    size, 
    pickupLat, 
    pickupLng, 
    dropoffLat, 
    dropoffLng 
  } = req.body;

  if (!ownerId || !weight || !size || !pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new ApiError(400, "All fields are required to create a parcel request.");
  }

  const parcel = await Parcel.create({
    ownerId,
    weight,
    size,
    pickupLocation: {
      type: 'Point',
      coordinates: [pickupLng, pickupLat]
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: [dropoffLng, dropoffLat]
    },
    status: "pending"
    // deliveryPrice is calculated automatically by the pre-save hook in the schema
  });

  return res.status(201).json(
    new ApiResponse(201, parcel, "Parcel request created successfully.")
  );
});

// 2. Owner searches for available riders (via active Pools/Trips)
const searchAvailableRiders = asyncHandler(async (req, res) => {
  const { parcelId } = req.params;

  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw new ApiError(404, "Parcel not found.");
  }

  // We find active pools/riders who are scheduled to go near the parcel's pickup location
  // Max deviation distance in meters (e.g., 5000 = 5km).
  const maxDistanceMeters = 5000;

  const pickupLng = parcel.pickupLocation.coordinates[0];
  const pickupLat = parcel.pickupLocation.coordinates[1];

  const availableRiders = await Pool.find({
    status: "scheduled",
    origin: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [pickupLng, pickupLat]
        },
        $maxDistance: maxDistanceMeters
      }
    }
  }).populate('driverId', 'username email fullName');

  // In a complete production system, we would also verify if the pool's destination
  // is near the parcel's dropoffLocation.

  return res.status(200).json(
    new ApiResponse(200, availableRiders, "Available riders retrieved successfully.")
  );
});

// 3. Rider accepts a parcel request
const acceptParcel = asyncHandler(async (req, res) => {
  const { parcelId, riderId, tripId } = req.body;

  if (!parcelId || !riderId) {
    throw new ApiError(400, "Parcel ID and Rider ID are required.");
  }

  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw new ApiError(404, "Parcel not found.");
  }

  if (parcel.status !== "pending") {
    throw new ApiError(400, "Parcel is no longer pending.");
  }

  parcel.status = "accepted";
  parcel.riderId = riderId;
  
  if (tripId) {
    parcel.tripId = tripId;
  }

  await parcel.save();

  return res.status(200).json(
    new ApiResponse(200, parcel, "Parcel accepted by rider successfully.")
  );
});

// 4. Rider picks up the parcel
const pickupParcel = asyncHandler(async (req, res) => {
  const { parcelId, riderId } = req.body;

  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw new ApiError(404, "Parcel not found.");
  }

  // Check if this rider owns the accepted parcel
  if (parcel.riderId?.toString() !== riderId) {
    throw new ApiError(403, "You are not assigned to this parcel.");
  }

  if (parcel.status !== "accepted") {
    throw new ApiError(400, `Cannot pick up parcel with status: ${parcel.status}.`);
  }

  parcel.status = "picked_up";
  await parcel.save();

  return res.status(200).json(
    new ApiResponse(200, parcel, "Parcel picked up successfully. In transit.")
  );
});

// 5. Rider drops off the parcel
const dropParcel = asyncHandler(async (req, res) => {
  const { parcelId, riderId } = req.body;

  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw new ApiError(404, "Parcel not found.");
  }

  if (parcel.riderId?.toString() !== riderId) {
    throw new ApiError(403, "You are not assigned to this parcel.");
  }

  if (parcel.status !== "picked_up" && parcel.status !== "in_transit") {
    throw new ApiError(400, `Cannot drop off parcel with status: ${parcel.status}. Needs to be picked up first.`);
  }

  // Completing the delivery
  parcel.status = "delivered";
  await parcel.save();

  return res.status(200).json(
    new ApiResponse(200, parcel, "Parcel delivered successfully.")
  );
});

// 6. Check parcel status (by Owner or Rider)
const parcelStatus = asyncHandler(async (req, res) => {
  const { parcelId } = req.params;

  const parcel = await Parcel.findById(parcelId).populate('riderId', 'username fullName email');
  if (!parcel) {
    throw new ApiError(404, "Parcel not found.");
  }

  return res.status(200).json(
    new ApiResponse(200, parcel, "Parcel status retrieved.")
  );
});

export {
  createParcel,
  searchAvailableRiders,
  acceptParcel,
  pickupParcel,
  dropParcel,
  parcelStatus
};
