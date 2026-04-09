import express from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  updateBillingStatus,
  trackOrderPublic
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/track/:trackingCode", trackOrderPublic);

router.route("/")
  .get(getOrders)
  .post(createOrder);

router.route("/:id")
  .get(getOrderById)
  .delete(deleteOrder);

router.route("/:id/status")
  .patch(updateOrderStatus);

router.route("/:id/billing-status")
  .patch(updateBillingStatus);

export default router;