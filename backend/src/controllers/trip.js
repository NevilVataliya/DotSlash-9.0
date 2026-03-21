import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
// import { Trip } from "../models/Trip.js";
import {Trip } from "../models/Trip.js"
import { ApiResponse } from "../../utils/ApiResponse.js";

const addTrip = asyncHandler(async (req, res) => {
  const { vehicleId, source, destination } = req.body;

  if (!vehicleId || !source || !destination) {
    throw new ApiError(400, "All fields are required");
  }

  const trip = await Trip.create({
    userId: req.user._id, // from auth middleware
    vehicleId,
    source,
    destination,
    status: false, // trip not started/completed initially
    selectedRoute: null
  });

  return res.status(201).json(
    new ApiResponse(201, trip, "Trip created successfully")
  );
});

const updateTripStatus = asyncHandler(async (req, res) => {
  const tripId = req.params.id;
  const { status } = req.body; // true or false

  const trip = await Trip.findById(tripId);
    console.log(trip)
  if (!trip) {
    throw new ApiError(404, "Trip not found what");
  }

  // Optional: ensure only owner updates
  if (trip.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized");
  }

  trip.status = status;
  await trip.save();

  return res.status(200).json(
    new ApiResponse(200, trip, "Trip status updated")
  );
});

const removeTrip = asyncHandler(async (req, res) => {
  const tripId  = req.params.id;

  const trip = await Trip.findById(tripId);

  if (!trip) {
    throw new ApiError(404, "Trip not found");
  }

  if (trip.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized");
  }

  await trip.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, {}, "Trip deleted successfully")
  );
});

const getUserTrips = asyncHandler(async (req, res) => {
  const trips = await Trip.find({ userId: req.user._id })
    .populate("vehicleId")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, trips, "Trips fetched successfully")
  );
});

export {addTrip,removeTrip,updateTripStatus,getUserTrips}