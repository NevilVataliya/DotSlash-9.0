import mongoose from "mongoose";

const routeSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip"
  },

  routeIndex: Number,

  distance: Number, // in km
  duration: Number, // in minutes

  trafficLevel: Number, // 0–1 scale

  stops: Number, // signals/intersections

  elevationGain: Number, // meters

  estimatedFuel: Number, // liters
  estimatedCO2: Number, // kg

  isRecommended: Boolean

}, { timestamps: true });

export default mongoose.model("Route", routeSchema);