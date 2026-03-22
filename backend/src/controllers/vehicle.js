import { Vehicle } from "../models/Vehicle.js";
import { GoogleGenAI } from "@google/genai";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const INVALID_PLACEHOLDER_VALUES = new Set([
  "n/a",
  "na",
  "not available",
  "unknown",
  "undefined",
  "null",
  "none",
  "-",
]);

const isMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized !== "" && !INVALID_PLACEHOLDER_VALUES.has(normalized);
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return true;
};

const sanitizeExtractedValue = (value) => {
  if (Array.isArray(value)) {
    const cleanedArray = value
      .map((item) => sanitizeExtractedValue(item))
      .filter((item) => item !== undefined);
    return cleanedArray.length ? cleanedArray : undefined;
  }

  if (value && typeof value === "object") {
    const cleanedObject = Object.entries(value).reduce((acc, [key, nestedValue]) => {
      const cleanedNestedValue = sanitizeExtractedValue(nestedValue);
      if (cleanedNestedValue !== undefined) {
        acc[key] = cleanedNestedValue;
      }
      return acc;
    }, {});

    return Object.keys(cleanedObject).length ? cleanedObject : undefined;
  }

  if (!isMeaningfulValue(value)) return undefined;
  return value;
};

const addVehicle = asyncHandler(async (req, res) => {
  // Accept all schema fields from the request body but enforce required fields
  const body = req.body || {};

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized request");
  }

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
    text: `You are an expert multimodal vehicle-information extraction system.
Analyze the provided image and/or audio deeply (visual cues, OCR text, badges/logos, body style, plate region, engine sound characteristics).

Return ONLY strict JSON (no markdown, no comments) using this schema:
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

Rules:
1) Try to populate every field, but include a field only when reasonably supported by evidence.
2) Never output placeholders like "N/A", "unknown", "null", "-", or empty strings.
3) If not identifiable with confidence, omit the field entirely.
4) Keep values normalized (fuelType lowercase, type in {car,bike,bus,truck}, year numeric).
5) parsedAudioNote.notes should summarize useful sound evidence only when audio exists.

Return valid JSON object only.`
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
     const parsedData = JSON.parse(responseText || "{}");
     const sanitizedData = sanitizeExtractedValue(parsedData) || {};
     
     return res.status(200).json(
       new ApiResponse(200, sanitizedData, "Vehicle information extracted successfully")
     );
  } catch(error) {
     console.error("Gemini Extraction Error:", error);
     throw new ApiError(500, "Failed to extract vehicle info with Gemini");
  }
});

export {addVehicle,updateVehicle,getVehicleById,getVehicles,deleteVehicle,extractVehicleInfo}