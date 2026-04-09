import crypto from "crypto";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import MenuItem from "../models/MenuItem.js";
import { getIO } from "../config/socket.js";

const STAFF_ROLES = ["admin", "manager", "cashier", "kitchen", "waiter"];

const emitToStaff = (io, event, payload) => {
  STAFF_ROLES.forEach((role) => io.to(`role:${role}`).emit(event, payload));
};

const emitStockToEveryone = (io, stockUpdates) => {
  STAFF_ROLES.forEach((role) => io.to(`role:${role}`).emit("stock:updated", stockUpdates));
  io.to("public").emit("stock:updated", stockUpdates);
};

const generateNextOrderNumber = async () => {
  const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
  return lastOrder ? lastOrder.orderNumber + 1 : 1001;
};

// Secure tracking code generator
const generateTrackingCode = () => {
  // 12 bytes => 24 hex chars, unguessable
  const token = crypto.randomBytes(12).toString("hex");
  return `TRK-${token}`;
};

const hashTrackingCode = (code) => {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
};

/**
 * PUBLIC: track order by tracking code (full details)
 * GET /api/orders/track/:trackingCode
 */
export const trackOrderPublic = async (req, res, next) => {
  try {
    const trackingCode = String(req.params.trackingCode || "").trim();

    if (!trackingCode || trackingCode.length < 8) {
      res.status(400);
      throw new Error("Tracking code is required");
    }

    const trackingHash = hashTrackingCode(trackingCode);

    const order = await Order.findOne({ trackingHash }).populate("table", "number");

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Return FULL details (as you requested)
    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        status: order.status,
        billingStatus: order.billingStatus,

        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        deliveryAddress: order.deliveryAddress || "",
        paymentMethod: order.paymentMethod || "cash",

        tableNumber: order.table?.number || null,

        items: (order.items || []).map((it) => ({
          name: it.name,
          qty: it.qty,
          price: it.price,
          lineTotal: Number(((it.price || 0) * (it.qty || 0)).toFixed(2))
        })),

        subtotal: order.subtotal,
        tax: order.tax,
        discountPercent: order.discountPercent,
        discount: order.discount,
        total: order.total,

        prepStartedAt: order.prepStartedAt,
        estimatedPrepMinutes: order.estimatedPrepMinutes,
        estimatedReadyAt: order.estimatedReadyAt,

        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    let orders = await Order.find(filter)
      .populate("table")
      .sort({ createdAt: -1 });

    if (search) {
      orders = orders.filter(
        (order) =>
          String(order.orderNumber).includes(search) ||
          String(order.table?.number || "").includes(search) ||
          String(order.customerPhone || "").includes(search) ||
          String(order.customerName || "").toLowerCase().includes(String(search).toLowerCase())
      );
    }

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("table");

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const {
      tableId,
      items,
      orderType = "dine-in",
      customerName = "",
      customerPhone = "",
      deliveryAddress = "",
      paymentMethod = "cash",
      discountPercent = 0
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error("At least one order item is required");
    }

    if (!["dine-in", "delivery"].includes(orderType)) {
      res.status(400);
      throw new Error("Invalid order type");
    }

    if (orderType === "delivery" && !customerPhone) {
      res.status(400);
      throw new Error("Customer phone number is required for delivery orders");
    }

    if (orderType === "delivery" && !deliveryAddress) {
      res.status(400);
      throw new Error("Delivery address is required for delivery orders");
    }

    if (orderType === "dine-in" && !tableId) {
      res.status(400);
      throw new Error("Table ID is required for dine-in orders");
    }

    let table = null;

    if (orderType === "dine-in") {
      table = await Table.findById(tableId);

      if (!table) {
        res.status(404);
        throw new Error("Table not found");
      }

      if (table.status !== "available") {
        res.status(400);
        throw new Error("Selected table is not available");
      }
    }

    let subtotal = 0;
    const finalItems = [];
    const stockUpdates = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuId);

      if (!menuItem) {
        res.status(404);
        throw new Error(`Menu item not found: ${item.menuId}`);
      }

      if (menuItem.stock < item.qty) {
        res.status(400);
        throw new Error(`Insufficient stock for ${menuItem.name}`);
      }

      const unitPrice =
        item.price != null && !Number.isNaN(Number(item.price))
          ? Number(item.price)
          : Number(menuItem.price);

      menuItem.stock -= item.qty;
      await menuItem.save();

      finalItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        qty: item.qty,
        price: unitPrice
      });

      stockUpdates.push({
        menuId: menuItem._id.toString(),
        stock: menuItem.stock
      });

      subtotal += unitPrice * item.qty;
    }

    subtotal = Number(subtotal.toFixed(2));

    const taxRate = 0.05;
    const tax = Number((subtotal * taxRate).toFixed(2));

    let safeDiscountPercent = Number(discountPercent || 0);
    if (safeDiscountPercent < 0) safeDiscountPercent = 0;
    if (safeDiscountPercent > 100) safeDiscountPercent = 100;

    const discount = Number((subtotal * (safeDiscountPercent / 100)).toFixed(2));
    const total = Number((subtotal + tax - discount).toFixed(2));

    const orderNumber = await generateNextOrderNumber();

    // NEW: tracking code + hash
    const trackingCode = generateTrackingCode();
    const trackingHash = hashTrackingCode(trackingCode);

    const order = await Order.create({
      orderNumber,
      trackingHash,

      table: table ? table._id : null,
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod,

      items: finalItems,
      subtotal,
      tax,
      discountPercent: safeDiscountPercent,
      discount,
      total,

      status: "pending",
      billingStatus: "pending",

      prepStartedAt: null,
      estimatedPrepMinutes: null,
      estimatedReadyAt: null
    });

    if (table) {
      table.status = "reserved";
      await table.save();
    }

    const populatedOrder = await Order.findById(order._id).populate("table");

    const io = getIO();

    // IMPORTANT: do NOT send orders to public sockets
    emitToStaff(io, "order:new", populatedOrder);

    if (stockUpdates.length) {
      emitStockToEveryone(io, stockUpdates);
    }

    if (table) {
      io.emit("table:updated", table);
      io.to("public").emit("table:updated", table);
    }

    // Return trackingCode ONLY in the HTTP response (customer sees it once)
    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        ...populatedOrder.toObject(),
        trackingCode
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, estimatedPrepMinutes } = req.body;

    if (!["pending", "in-progress", "completed"].includes(status)) {
      res.status(400);
      throw new Error("Invalid order status");
    }

    const order = await Order.findById(req.params.id).populate("table");

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (status === "in-progress") {
      const prepMinutes = Number(estimatedPrepMinutes || 0);

      if (prepMinutes <= 0) {
        res.status(400);
        throw new Error("Estimated preparation time is required");
      }

      const startedAt = new Date();
      const readyAt = new Date(startedAt.getTime() + prepMinutes * 60000);

      order.prepStartedAt = startedAt;
      order.estimatedPrepMinutes = prepMinutes;
      order.estimatedReadyAt = readyAt;
    }

    if (status === "pending") {
      order.prepStartedAt = null;
      order.estimatedPrepMinutes = null;
      order.estimatedReadyAt = null;
    }

    order.status = status;
    await order.save();

    let table = null;

    if (status === "completed" && order.table?._id) {
      const activeOrders = await Order.find({
        table: order.table._id,
        _id: { $ne: order._id },
        status: { $in: ["pending", "in-progress"] }
      });

      if (activeOrders.length === 0) {
        table = await Table.findById(order.table._id);
        if (table) {
          table.status = "available";
          await table.save();
        }
      }
    }

    const updatedOrder = await Order.findById(order._id).populate("table");

    const io = getIO();
    emitToStaff(io, "order:updated", updatedOrder);

    if (table) {
      io.emit("table:updated", table);
      io.to("public").emit("table:updated", table);
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("table");

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    const stockUpdates = [];

    for (const item of order.items) {
      if (item.menuItem) {
        const menuItem = await MenuItem.findById(item.menuItem);
        if (menuItem) {
          menuItem.stock += item.qty;
          await menuItem.save();

          stockUpdates.push({
            menuId: menuItem._id.toString(),
            stock: menuItem.stock
          });
        }
      }
    }

    let table = null;

    if (order.table?._id) {
      const activeOrders = await Order.find({
        table: order.table._id,
        _id: { $ne: order._id },
        status: { $in: ["pending", "in-progress"] }
      });

      if (activeOrders.length === 0) {
        table = await Table.findById(order.table._id);
        if (table) {
          table.status = "available";
          await table.save();
        }
      }
    }

    await order.deleteOne();

    const io = getIO();
    emitToStaff(io, "order:deleted", { _id: req.params.id, orderNumber: order.orderNumber });

    if (stockUpdates.length) {
      emitStockToEveryone(io, stockUpdates);
    }

    if (table) {
      io.emit("table:updated", table);
      io.to("public").emit("table:updated", table);
    }

    res.json({
      success: true,
      message: "Order deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const updateBillingStatus = async (req, res, next) => {
  try {
    const { billingStatus } = req.body;

    if (!["pending", "completed"].includes(billingStatus)) {
      res.status(400);
      throw new Error("Invalid billing status");
    }

    const order = await Order.findById(req.params.id).populate("table");

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    order.billingStatus = billingStatus;

    // ✅ Accounting timestamp
    if (billingStatus === "completed") {
      order.billingCompletedAt = new Date();
    } else {
      order.billingCompletedAt = null;
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id).populate("table");

    const io = getIO();
    // emit only to staff if you applied the staff-only emit fix earlier
    io.emit("order:updated", updatedOrder);

    res.json({
      success: true,
      message: "Billing status updated successfully",
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};