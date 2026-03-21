import {Router} from "express";
import { checkUsernameAvailability, getCurrentUser, loginUser, logoutUser, registerUser } from "../controllers/user.js";
import { verifyJWT } from "../middleware/auth.js";

const router  = Router();

router.route("/register").post(registerUser)
router.route("/login").post(loginUser)
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/check-username").get(checkUsernameAvailability);
router.route("/me").get(verifyJWT,getCurrentUser)
export default router