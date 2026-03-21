import mongoose from "mongoose";

const poolSchema = new mongoose.Schema({
  // The active rider who scheduled the ride and created the pool
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // The original trip defining the general route/source/destination
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip",
    required: true,
  },

  // GeoJSON for the pool's starting point (driver's source) to allow $near queries for pickup matches
  origin: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  // GeoJSON for the pool's ending point (driver's destination)
  destination: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  // Time the pool ride starts
  departureTime: {
    type: Date,
    required: true,
  },

  // Capacity of the vehicle or how many pooling seats the driver is offering
  availableSeats: {
    type: Number,
    required: true,
    min: 0
  },

  // Price for a single seat in this pool
  pricePerSeat: {
    type: Number,
    required: true,
    min: 0
  },

  // Status of the pooling ride
  status: {
    type: String,
    enum: ["scheduled", "in-progress", "completed", "cancelled"],
    default: "scheduled"
  },

  // Other people who are pooling in this ride
  passengers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // The specific passenger's pickup location
    pickupLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number] // [longitude, latitude]
    },
    // The specific passenger's dropoff location
    dropoffLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number] // [longitude, latitude]
    },
    // The agreed or predicted price for this passenger
    price: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending"
    }
  }]
}, { timestamps: true });

// Create 2dsphere indexes to query pools near a specific location
// This helps to figure out whether other person can pool based on proximity to the source and destination
poolSchema.index({ origin: "2dsphere" });
poolSchema.index({ destination: "2dsphere" });

export default mongoose.model("Pool", poolSchema);
