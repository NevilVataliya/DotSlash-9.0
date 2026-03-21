
import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  type: {
    type: String,
    // enum: ["car", "bike", "bus"]
  },

  fuelType: {
    type: String,
    // enum: ["petrol", "diesel", "electric"]
  },

  mileage: Number, // km per liter (or Wh/km for EV)

  // advanced (for better model)
  avgSpeed: Number,
  fuelConsumptionRate: Number, // L per km

}, { timestamps: true });

export default mongoose.model("Vehicle", vehicleSchema);