import { Router } from "express";

import { verifyJWT } from "../middleware/auth.js";
import { upload } from "../middleware/multer.js";
import { addVehicle, deleteVehicle, getVehicleById, getVehicles, updateVehicle, extractVehicleInfo } from "../controllers/vehicle.js";

const router = Router();

router.route("/addvehicle").post(addVehicle)
router.route("/getvehicles").get(verifyJWT,getVehicles)
router.route("/:id/getvehiclebyid").get(verifyJWT,getVehicleById)
router.route("/:id/deletevehicle").delete(verifyJWT,deleteVehicle)
router.route("/:id/updatevehicle").patch(verifyJWT,updateVehicle)

router.route("/extract-info").post(
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 }
  ]),
  extractVehicleInfo
);

export default router