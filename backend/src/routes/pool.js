import { Router } from "express";
import {
  userIsReadyToPool,
  checkAvailableForPool,
  requestPool,
  acceptPool,
  poolStatus
} from "../controllers/pool.js";

const router = Router();

// Route for driver to create a pool
router.route("/ready").post(userIsReadyToPool);

// Route for passengers to search for available pools
router.route("/available").get(checkAvailableForPool);

// Route for passengers to request joining a pool
router.route("/request").post(requestPool);

// Route for drivers to accept a passenger's request
router.route("/accept").post(acceptPool);

// Route for passenger to check their request status
router.route("/:poolId/status/:passengerId").get(poolStatus);

export default router;
