import { Router } from "express";
import {
  userIsReadyToPool,
  checkAvailableForPool,
  requestPool,
  acceptPool,
  declinePool,
  poolStatus,
  getAllPools,
  getDriverPools,
  getDemoUser
} from "../controllers/pool.js";

const router = Router();

// Route to get a demo user
router.route("/demo-user").get(getDemoUser);

// Route for driver to create a pool
router.route("/ready").post(userIsReadyToPool);

// Route for passengers to search for available pools
router.route("/available").get(checkAvailableForPool);

// Route to get all scheduled pools for general display
router.route("/all").get(getAllPools);

// Route for driver to view their pools and incoming requests
router.route("/driver/:driverId").get(getDriverPools);

// Route for passengers to request joining a pool
router.route("/request").post(requestPool);

// Route for drivers to accept a passenger's request
router.route("/accept").post(acceptPool);

// Route for drivers to decline a passenger's request
router.route("/decline").post(declinePool);

// Route for passenger to check their request status
router.route("/:poolId/status/:passengerId").get(poolStatus);

export default router;
