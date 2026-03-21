import { Router } from "express";
import {
  createParcel,
  searchAvailableRiders,
  acceptParcel,
  pickupParcel,
  dropParcel,
  parcelStatus
} from "../controllers/parcel.js";

const router = Router();

// Owner routes
router.route("/create").post(createParcel);
router.route("/:parcelId/riders").get(searchAvailableRiders);
router.route("/:parcelId/status").get(parcelStatus);

// Rider routes
router.route("/accept").post(acceptParcel);
router.route("/pickup").post(pickupParcel);
router.route("/drop").post(dropParcel);

export default router;
