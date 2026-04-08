import express from "express";
import {
  getDashboardStats,
  getSalesAnalytics
} from "../controllers/analyticsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";


const router = express.Router();

router.get("/dashboard", protect, authorize("admin", "manager", "cashier"), getDashboardStats);
router.get("/sales", protect, authorize("admin", "manager", "cashier"), getSalesAnalytics);

export default router;