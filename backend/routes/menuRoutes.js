import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  bulkCreateMenuItems
} from "../controllers/menuController.js";

const router = express.Router();

router.route("/")
  .get(getMenuItems)
  .post(upload.single("image"), createMenuItem);

router.post("/bulk", bulkCreateMenuItems);

router.post("/bulk", bulkCreateMenuItems);

router.route("/:id")
  .get(getMenuItemById)
  .put(upload.single("image"), updateMenuItem)
  .delete(deleteMenuItem);

export default router;