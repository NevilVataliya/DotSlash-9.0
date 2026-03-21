import mongoose from "mongoose";

const parcelSchema = new mongoose.Schema({
  // The person sending the parcel
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // The rider who accepted to deliver the parcel (optional until accepted)
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  // If the rider is fulfilling this via an active Trip 
  // (links the parcel to the specific trip route the rider is taking)
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip",
    default: null
  },

  // Details regarding the parcel
  weight: {
    type: Number, // measured in kilograms (kg)
    required: true,
    min: 0.1
  },

  size: {
    type: String,
    enum: ["small", "medium", "large", "extra-large"], 
    required: true
  },

  // Start location where the owner drops off the parcel or rider picks it up
  pickupLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: String
  },

  // End location where the rider delivers the parcel
  dropoffLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: String
  },

  // Price prediction (populated programmatically)
  deliveryPrice: {
    type: Number,
    min: 0
  },

  status: {
    type: String,
    enum: ["pending", "accepted", "picked_up", "in_transit", "delivered", "cancelled"],
    default: "pending"
  }

}, { timestamps: true });

// Create spatial indexes so riders can find parcels to pick up near their current route or start location
parcelSchema.index({ pickupLocation: "2dsphere" });
parcelSchema.index({ dropoffLocation: "2dsphere" });

// Pre-save hook to calculate an estimated delivery price based on weight
parcelSchema.pre("save", function(next) {
  // Recalculate if deliveryPrice isn't set yet, or if weight has been modified
  if (this.isNew || !this.deliveryPrice || this.isModified("weight")) {
    const basePrice = 50; // base price in arbitrary local currency
    const pricePerKg = 20; // processing rate per kg
    
    // The price is predicted using simple base + weight model. 
    // In a production app, we would also factor in the distance between pickup and dropoff.
    this.deliveryPrice = basePrice + (this.weight * pricePerKg);
  }
  // next();
});

export default mongoose.model("Parcel", parcelSchema);
