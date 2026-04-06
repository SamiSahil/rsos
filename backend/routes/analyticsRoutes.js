import express from "express";
import {
  getDashboardStats,
  getSalesAnalytics
} from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/dashboard", getDashboardStats);
router.get("/sales", getSalesAnalytics);

export default router;