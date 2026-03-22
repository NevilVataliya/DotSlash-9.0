import { Router } from "express";
import { getUserCredits, updateCreditsAfterRide } from "../controllers/credit.js";
import { verifyJWT } from "../middleware/auth.js";

const router = Router();

router.use(verifyJWT); // apply verifyJWT middleware to all routes in this router

router.route("/").get(getUserCredits);
router.route("/update-after-ride").post(updateCreditsAfterRide);

export default router;
