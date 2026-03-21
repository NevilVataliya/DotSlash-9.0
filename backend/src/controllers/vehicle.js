import { Vehicle } from "../models/Vehicle.js";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const addVehicle = asyncHandler(async (req, res) => {
  const { type, fuelType, mileage, avgSpeed, fuelConsumptionRate } = req.body;

  if (!type || !fuelType) {
    throw new ApiError(400, "Type and fuelType are required");
  }

  const vehicle = await Vehicle.create({
    type,
    fuelType,
    mileage,
    avgSpeed,
    fuelConsumptionRate
  });

  return res.status(201).json(
    new ApiResponse(201, vehicle, "Vehicle added successfully")
  );
});

const getVehicles = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find().sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, vehicles, "Vehicles fetched successfully")
  );
});

const getVehicleById = asyncHandler(async (req, res) => {
  const vehicleId  = (req.params.id);
  console.log(req.params.id)
  console.log(vehicleId)
  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  return res.status(200).json(
    new ApiResponse(200, vehicle, "Vehicle fetched")
  );
});

const updateVehicle = asyncHandler(async (req, res) => {
  const  vehicleId  = req.params.id;
  const updates = req.body;

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  Object.keys(updates).forEach((key) => {
    vehicle[key] = updates[key];
  });

  await vehicle.save();

  return res.status(200).json(
    new ApiResponse(200, vehicle, "Vehicle updated successfully")
  );
});

const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicleId  = req.params.id;

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  await vehicle.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, {}, "Vehicle deleted successfully")
  );
});

export {addVehicle,updateVehicle,getVehicleById,getVehicles,deleteVehicle}