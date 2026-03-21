import mongoose from "mongoose";

const tripSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle"
  },

  source: {
    name: String,
    lat: Number,
    lng: Number
  },

  destination: {
    name: String,
    lat: Number,
    lng: Number
  },
  status: Boolean,
  selectedRoute: Number, // index of chosen route

}, { timestamps: true });

export const Trip =  mongoose.model("Trip", tripSchema);