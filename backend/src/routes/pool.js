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

import {verifyJWT} from "../middleware/auth.js"
const router = Router();

// Route to get a demo user
router.route("/demo-user").get(getDemoUser);

// Route for driver to create a pool
router.route("/ready").post(verifyJWT,userIsReadyToPool);

// Route for passengers to search for available pools
router.route("/available").get(verifyJWT,checkAvailableForPool);

// Route to get all scheduled pools for general display
router.route("/all").get(verifyJWT,getAllPools);

// Route for driver to view their pools and incoming requests
router.route("/driver/:driverId").get(verifyJWT,getDriverPools);

// Route for passengers to request joining a pool
router.route("/request").post(verifyJWT,requestPool);

// Route for drivers to accept a passenger's request
router.route("/accept").post(verifyJWT,acceptPool);

// Route for drivers to decline a passenger's request
router.route("/decline").post(verifyJWT,declinePool);

// Route for passenger to check their request status
router.route("/:poolId/status/:passengerId").get(verifyJWT,poolStatus);

export default router;
