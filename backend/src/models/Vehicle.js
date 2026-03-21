
import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Basic identification
  type: {
    type: String,
    enum: ["car", "bike", "bus", "truck"],
    required: true,
  },
  make: String, // e.g., Honda, Toyota
  model: String, // e.g., Activa, Corolla
  year: Number,
  registrationNumber: String,
  vin: String,

  // Fuel / powertrain
  fuelType: {
    type: String,
    enum: ["petrol", "diesel", "electric", "gas", "hybrid"],
  },
  mileage: Number, // km per litre for ICE, km per kWh or Wh/km for EV (store units in docs)
  avgSpeed: Number,
  fuelConsumptionRate: Number, // L per km (optional)

  // Engine & performance (useful for cars/bikes/trucks where applicable)
  // Use a nested subdocument schema to avoid casting issues when objects are passed
  engine: new mongoose.Schema({
    displacementCc: Number, // e.g., 123.94
    cylinders: Number, // e.g., 1
    type: String, // e.g., "4-Stroke, SI, Air-cooled, BS-VI"
    horsepowerPS: Number, // PS value (e.g., 10.78)
    horsepowerBhpApprox: Number, // bhp approximation (e.g., 10.59)
    horsepowerRpm: Number, // rpm at which hp is measured (e.g., 7500)
    maxTorqueNm: Number, // e.g., 11
    maxTorqueRpm: Number, // e.g., 6000
    transmission: String, // e.g., "5-Speed Manual"
    fuelSystem: String, // e.g., "PGM-FI"
    topSpeedKmph: Number,
    claimedMileageKmpl: Number,
  }, { _id: false }),

  // Dimensions & weight
  dimensions: {
    kerbWeightKg: Number,
    wheelbaseMm: Number,
    lengthMm: Number,
    widthMm: Number,
    heightMm: Number,
    frontalAreaM2: Number, // optional, if calculated/available
    seatHeightMm: Number,
    groundClearanceMm: Number,
    fuelTankCapacityL: Number,
  },

  // Chassis, brakes & suspension
  chassis: {
    frameType: String,
    frontBrake: String, // e.g., "240 mm Disc"
    rearBrake: String, // e.g., "130 mm Drum"
    frontSuspension: String,
    rearSuspension: String,
    tyreFront: String, // e.g., "80/100-18 Tubeless"
    tyreRear: String,
  },

  // Truck / Bus specific
  commercial: {
    seatingCapacity: Number,
    payloadKg: Number,
    grossVehicleWeightKg: Number,
    axleCount: Number,
  },

  // Electric vehicle specific
  ev: {
    batteryCapacityKWh: Number,
    estimatedRangeKm: Number,
    motorPowerKw: Number,
    chargingTimeHrs: Number,
  },

  // Media: images and voice notes. Images may have OCR/extracted fields.
  images: [
    {
      url: String,
      caption: String,
      // arbitrary extracted key/value pairs from image OCR or analysis
      extractedData: mongoose.Schema.Types.Mixed,
      uploadedAt: Date,
    },
  ],

  voiceNotes: [
    {
      url: String,
      durationSec: Number,
      transcript: String,
      // parsed metadata produced from speech-to-text / NLP
      parsed: {
        ageYears: Number, // e.g., "vehicle is 3 years old"
        co2GPerKm: Number,
        noxGPerKm: Number,
        pmGPerKm: Number,
        otherEmissions: mongoose.Schema.Types.Mixed,
        notes: String,
      },
      uploadedAt: Date,
    },
  ],

  // Owner-reported / telematics
  odometerKm: Number,
  lastServiceAt: Date,
  notes: String,

}, { timestamps: true });

// Small helper index to speed queries by user and registration number
vehicleSchema.index({ userId: 1, registrationNumber: 1 });

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);