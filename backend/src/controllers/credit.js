import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Credit } from "../models/Credit.js";

const getUserCredits = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    let credits = await Credit.findOne({ userRef: userId });

    if (!credits) {
        credits = await Credit.create({ userRef: userId, co2EmissionSaved: 0, points: 0 });
    }

    return res.status(200).json(
        new ApiResponse(200, credits, "User credits fetched successfully")
    );
});

const updateCreditsAfterRide = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { co2EmissionSaved = 0, points = 0 } = req.body;

    let credits = await Credit.findOne({ userRef: userId });

    if (!credits) {
        credits = await Credit.create({ 
            userRef: userId, 
            co2EmissionSaved: Number(co2EmissionSaved), 
            points: Number(points) 
        });
    } else {
        credits.co2EmissionSaved += Number(co2EmissionSaved);
        credits.points += Number(points);
        await credits.save();
    }

    return res.status(200).json(
        new ApiResponse(200, credits, "User credits updated successfully")
    );
});

export { getUserCredits, updateCreditsAfterRide };
