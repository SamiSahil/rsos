import bcrypt from "bcryptjs";
import streamifier from "streamifier";
import Staff from "../models/Staff.js";
import cloudinary from "../config/cloudinary.js";

const uploadBufferToCloudinary = (buffer, folder = "restaurantos/staff-nid") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1000, height: 700, crop: "limit" },
          { quality: "auto", fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const sanitizeStaffFields = (body) => {
  const monthlySalary = Math.max(0, Number(body.monthlySalary || 0));
  const workingDays = Math.max(1, Number(body.workingDays || 30));

  return {
    monthlySalary,
    workingDays
  };
};

const toDateOnlyString = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const countMonthlyAttendance = (staff) => {
  const joinDate = staff.joinDate ? new Date(staff.joinDate) : new Date();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthly = (staff.attendance || []).filter((entry) => {
    const d = new Date(entry.date);
    return (
      d.getMonth() === month &&
      d.getFullYear() === year &&
      d >= new Date(joinDate.toISOString().slice(0, 10))
    );
  });

  return {
    presentDays: monthly.filter((e) => e.status === "active").length,
    absentDays: monthly.filter((e) => e.status === "inactive").length,
    leaveDays: monthly.filter((e) => e.status === "on-leave").length
  };
};

export const getStaffList = async (req, res, next) => {
  try {
    const staff = await Staff.find().select("-password").sort({ createdAt: -1 });

    const enriched = staff.map((person) => {
      const counts = countMonthlyAttendance(person);
      return {
        ...person.toObject(),
        ...counts
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id).select("-password");

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const counts = countMonthlyAttendance(staff);

    res.json({
      success: true,
      data: {
        ...staff.toObject(),
        ...counts
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      address,
      nidNumber,
      role,
      status,
      joinDate,
      leaveStartDate,
      leaveEndDate
    } = req.body;

    if (!fullName || !email || !phone || !password || !address) {
      res.status(400);
      throw new Error("Full name, email, phone, password, and address are required");
    }

    const existing = await Staff.findOne({ email });
    if (existing) {
      res.status(400);
      throw new Error("A staff member with this email already exists");
    }

    let nidImageUrl = "";
    let nidImagePublicId = "";

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      nidImageUrl = uploaded.secure_url;
      nidImagePublicId = uploaded.public_id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const safeFields = sanitizeStaffFields(req.body);

    const staff = await Staff.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      address,
      nidNumber,
      nidImageUrl,
      nidImagePublicId,
      role: role || "waiter",
      status: status || "active",
      monthlySalary: safeFields.monthlySalary,
      workingDays: safeFields.workingDays,
      joinDate: joinDate || new Date(),
      attendance: [],
      leaveStartDate: leaveStartDate || null,
      leaveEndDate: leaveEndDate || null
    });

    const safeStaff = await Staff.findById(staff._id).select("-password");
    const counts = countMonthlyAttendance(safeStaff);

    res.status(201).json({
      success: true,
      message: "Staff created successfully",
      data: {
        ...safeStaff.toObject(),
        ...counts
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    let nidImageUrl = staff.nidImageUrl;
    let nidImagePublicId = staff.nidImagePublicId;

    if (req.file) {
      if (staff.nidImagePublicId) {
        await cloudinary.uploader.destroy(staff.nidImagePublicId);
      }

      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      nidImageUrl = uploaded.secure_url;
      nidImagePublicId = uploaded.public_id;
    }

    if (req.body.password && req.body.password.trim()) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    } else {
      delete req.body.password;
    }

    const safeFields = sanitizeStaffFields(req.body);

    const updated = await Staff.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        monthlySalary: safeFields.monthlySalary,
        workingDays: safeFields.workingDays,
        nidImageUrl,
        nidImagePublicId
      },
      { new: true, runValidators: true }
    ).select("-password");

    const counts = countMonthlyAttendance(updated);

    res.json({
      success: true,
      message: "Staff updated successfully",
      data: {
        ...updated.toObject(),
        ...counts
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaffAttendance = async (req, res, next) => {
  try {
    const { status, date } = req.body;

    if (!["active", "inactive", "on-leave"].includes(status)) {
      res.status(400);
      throw new Error("Invalid attendance status");
    }

    const targetDate = toDateOnlyString(date);

    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const existingIndex = (staff.attendance || []).findIndex((entry) => entry.date === targetDate);

    if (existingIndex >= 0) {
      staff.attendance[existingIndex].status = status;
    } else {
      staff.attendance.push({
        date: targetDate,
        status
      });
    }

    // Keep current overall status aligned with latest quick update
    staff.status = status;

    await staff.save();

    const safeStaff = await Staff.findById(staff._id).select("-password");
    const counts = countMonthlyAttendance(safeStaff);

    res.json({
      success: true,
      message: "Attendance updated successfully",
      data: {
        ...safeStaff.toObject(),
        ...counts
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    if (staff.nidImagePublicId) {
      await cloudinary.uploader.destroy(staff.nidImagePublicId);
    }

    await staff.deleteOne();

    res.json({
      success: true,
      message: "Staff deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};