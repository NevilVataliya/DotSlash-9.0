import { Vehicle } from "../models/Vehicle.js";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const addVehicle = asyncHandler(async (req, res) => {
  // Accept all schema fields from the request body but enforce required fields
  const body = req.body || {};

  if (!body.type) {
    throw new ApiError(400, "Type is required");
  }

  // Ensure userId comes from authenticated user
  const payload = {
    ...body,
    userId: req.user?._id,
  };

  // Prevent clients from setting internal/immutable fields
  delete payload._id;
  delete payload.createdAt;
  delete payload.updatedAt;

  const vehicle = await Vehicle.create(payload);

  return res.status(201).json(
    new ApiResponse(201, vehicle, "Vehicle added successfully")
  );
});

const getVehicles = asyncHandler(async (req, res) => {
  // Return vehicles for the authenticated user only
  const vehicles = await Vehicle.find({ userId: req.user?._id }).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, vehicles, "Vehicles fetched successfully")
  );
});

const getVehicleById = asyncHandler(async (req, res) => {
  const vehicleId = req.params.id;
  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  // Ensure owner access
  if (String(vehicle.userId) !== String(req.user?._id)) {
    throw new ApiError(403, "Forbidden");
  }

  return res.status(200).json(
    new ApiResponse(200, vehicle, "Vehicle fetched")
  );
});

const updateVehicle = asyncHandler(async (req, res) => {
  const vehicleId = req.params.id;
  const updates = req.body || {};

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  // Ensure owner access
  if (String(vehicle.userId) !== String(req.user?._id)) {
    throw new ApiError(403, "Forbidden");
  }

  // Prevent changing ownership or internal fields
  delete updates.userId;
  delete updates._id;
  delete updates.createdAt;
  delete updates.updatedAt;

  // Simple merge: shallow assign for top-level and nested replacement allowed
  Object.keys(updates).forEach((key) => {
    vehicle[key] = updates[key];
  });

  await vehicle.save();

  return res.status(200).json(
    new ApiResponse(200, vehicle, "Vehicle updated successfully")
  );
});

const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicleId = req.params.id;

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  // Ensure owner access
  if (String(vehicle.userId) !== String(req.user?._id)) {
    throw new ApiError(403, "Forbidden");
  }

  await vehicle.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, {}, "Vehicle deleted successfully")
  );
});

export {addVehicle,updateVehicle,getVehicleById,getVehicles,deleteVehicle}