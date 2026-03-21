import { Router } from "express";

import { verifyJWT } from "../middleware/auth.js";
import { addTrip, getUserTrips, removeTrip, updateTripStatus } from "../controllers/trip.js";

const router = Router()

router.route("/addtrip").post(verifyJWT,addTrip)
router.route("/removetrip").delete(verifyJWT,removeTrip)
router.route("/:id/updatetripstatus").patch(verifyJWT,updateTripStatus)
router.route("/gettrips").get(verifyJWT,getUserTrips)

export default router