import { Router } from "express";

import { verifyJWT } from "../middleware/auth.js";
import { addVehicle, deleteVehicle, getVehicleById, getVehicles, updateVehicle } from "../controllers/vehicle.js";

const router = Router();

router.route("/addvehicle").post(verifyJWT,addVehicle)
router.route("/getvehicles").get(verifyJWT,getVehicles)
router.route("/:id/getvehiclebyid").get(verifyJWT,getVehicleById)
router.route("/:id/deletevehicle").delete(verifyJWT,deleteVehicle)
router.route("/:id/updatevehicle").patch(verifyJWT,updateVehicle)

export default router