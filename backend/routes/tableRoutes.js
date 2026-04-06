import express from "express";
import {
  getTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable
} from "../controllers/tableController.js";

const router = express.Router();

router.route("/")
  .get(getTables)
  .post(createTable);

router.route("/:id")
  .get(getTableById)
  .put(updateTable)
  .delete(deleteTable);

export default router;