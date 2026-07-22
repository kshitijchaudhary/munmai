import mongoose from "mongoose";
import Income from "../models/Income.js";

export const requireOwnedIncome = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Income record not found" });
  }

  try {
    const income = await Income.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).lean();

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    req.ownedIncome = income;
    return next();
  } catch {
    return res.status(500).json({ message: "Server Error" });
  }
};
