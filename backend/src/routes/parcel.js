import { Router } from "express";
import {
  createParcel,
  searchAvailableRiders,
  acceptParcel,
  pickupParcel,
  dropParcel,
  parcelStatus
} from "../controllers/parcel.js";
import { verifyJWT } from "../middleware/auth.js";


const router = Router();

// Owner routes
router.route("/create").post(verifyJWT,createParcel);
router.route("/:parcelId/riders").get(verifyJWT,searchAvailableRiders);
router.route("/:parcelId/status").get(verifyJWT,parcelStatus);

// Rider routes
router.route("/accept").post(verifyJWT,acceptParcel);
router.route("/pickup").post(verifyJWT,pickupParcel);
router.route("/drop").post(verifyJWT,dropParcel);

export default router;
