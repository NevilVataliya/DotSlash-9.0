import mongoose from "mongoose";

const creditSchema = new mongoose.Schema({
    userRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    co2EmissionSaved: {
        type: Number,
        default: 0
    },
    points: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

export const Credit = mongoose.model("Credit", creditSchema);
