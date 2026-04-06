import express from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  updateBillingStatus
} from "../controllers/orderController.js";

const router = express.Router();

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