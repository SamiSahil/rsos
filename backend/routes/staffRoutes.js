import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  getStaffList,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffAttendance,
  deleteStaff
} from "../controllers/staffController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, authorize("admin", "manager"), getStaffList)
  .post(protect, authorize("admin"), upload.single("nidImage"), createStaff);

router.route("/:id")
  .get(protect, authorize("admin", "manager"), getStaffById)
  .put(protect, authorize("admin"), upload.single("nidImage"), updateStaff)
  .delete(protect, authorize("admin"), deleteStaff);

router.route("/:id/attendance")
  .patch(protect, authorize("admin", "manager"), updateStaffAttendance);

export default router;