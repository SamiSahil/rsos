import Feedback from "../models/Feedback.js";

export const getFeedbacks = async (req, res, next) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feedbacks.length,
      data: feedbacks
    });
  } catch (error) {
    next(error);
  }
};

export const getFeedbackById = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

export const createFeedback = async (req, res, next) => {
  try {
    const { name, rating, text } = req.body;

    const feedback = await Feedback.create({
      name,
      rating,
      text
    });

    res.status(201).json({
      success: true,
      message: "Feedback added successfully",
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

export const updateFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    const updatedFeedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: "Feedback updated successfully",
      data: updatedFeedback
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    await feedback.deleteOne();

    res.json({
      success: true,
      message: "Feedback deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};