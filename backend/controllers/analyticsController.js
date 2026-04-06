import Order from "../models/Order.js";
import Feedback from "../models/Feedback.js";

export const getDashboardStats = async (req, res, next) => {
  try {
    const completedOrders = await Order.find({ status: "completed" }).populate("table");
    const allOrders = await Order.find().populate("table");

    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = completedOrders.length
      ? totalRevenue / completedOrders.length
      : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = allOrders.filter(
      (order) => new Date(order.createdAt) >= today
    );

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        todayOrders: todayOrders.length,
        pendingOrders: allOrders.filter((o) => o.status === "pending").length,
        inProgressOrders: allOrders.filter((o) => o.status === "in-progress").length,
        completedOrders: allOrders.filter((o) => o.status === "completed").length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesAnalytics = async (req, res, next) => {
  try {
    const completedOrders = await Order.find({ status: "completed" });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = completedOrders.filter(
        (order) =>
          new Date(order.createdAt) >= date &&
          new Date(order.createdAt) < nextDate
      );

      const revenue = dayOrders.reduce((sum, order) => sum + order.total, 0);

      last7Days.push({
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        revenue
      });
    }

    const topSellingMap = {};
    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        topSellingMap[item.name] = (topSellingMap[item.name] || 0) + item.qty;
      });
    });

    const topSellingItems = Object.entries(topSellingMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const feedbacks = await Feedback.find();
    const avgRating = feedbacks.length
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
      : 0;

    res.json({
      success: true,
      data: {
        salesLast7Days: last7Days,
        topSellingItems,
        feedbackCount: feedbacks.length,
        avgRating: Number(avgRating.toFixed(1))
      }
    });
  } catch (error) {
    next(error);
  }
};