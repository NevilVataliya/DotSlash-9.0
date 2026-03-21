import { Vehicle } from "../models/Vehicle.js";
import { GoogleGenAI } from "@google/genai";

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

const extractVehicleInfo = asyncHandler(async (req, res) => {
  const files = req.files || {};
  
  if (!files.image && !files.audio) {
    throw new ApiError(400, "Please upload an image or audio file for extraction.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const parts = [];
  
  if (files.image && files.image[0]) {
    parts.push({
      inlineData: {
        data: files.image[0].buffer.toString("base64"),
        mimeType: files.image[0].mimetype,
      }
    });
  }
  
  if (files.audio && files.audio[0]) {
    parts.push({
      inlineData: {
        data: files.audio[0].buffer.toString("base64"),
        mimeType: files.audio[0].mimetype,
      }
    });
  }
  
  parts.push({
    text: `You are an expert vehicle identification AI. Return a JSON object containing vehicle extraction data from the provided image and/or audio. 
Match the following schema closely:
{
  "type": "car|bike|bus|truck",
  "make": "string",
  "model": "string",
  "year": "number",
  "registrationNumber": "string",
  "fuelType": "petrol|diesel|electric|gas|hybrid",
  "mileage": "number",
  "engine": {
    "displacementCc": "number",
    "cylinders": "number",
    "type": "string",
    "horsepowerBhpApprox": "number",
    "transmission": "string"
  },
  "dimensions": {
    "fuelTankCapacityL": "number"
  },
  "parsedAudioNote": {
    "ageYears": "number",
    "notes": "string"
  }
}
If a value is not identifiable, omit it. Do not guess unless highly confident. Ensure the response is valid JSON.`
  });
  
  try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: parts,
       config: {
         responseMimeType: "application/json",
       }
     });
     
     const responseText = typeof response.text === 'function' ? response.text() : response.text;
     const extractedData = JSON.parse(responseText || "{}");
     
     return res.status(200).json(
       new ApiResponse(200, extractedData, "Vehicle information extracted successfully")
     );
  } catch(error) {
     console.error("Gemini Extraction Error:", error);
     throw new ApiError(500, "Failed to extract vehicle info with Gemini");
  }
});

export {addVehicle,updateVehicle,getVehicleById,getVehicles,deleteVehicle,extractVehicleInfo}