// models/Savings.ts
import mongoose from "mongoose";

const savingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip"
  },

  fuelSaved: Number, // liters
  co2Saved: Number, // kg

  percentageSaved: Number

}, { timestamps: true });

export const Savings =  mongoose.model("Savings", savingsSchema);