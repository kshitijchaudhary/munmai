import { access } from "fs/promises";
import Expense from "../models/Expense.js";
import { resolveStoredFilePath } from "../utils/uploadPaths.js";

export const getReceiptFile = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      userId: req.user.id,
    }).lean();

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (!expense.receiptUrl) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    const filePath = resolveStoredFilePath(expense.receiptUrl);

    if (!filePath) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    try {
      await access(filePath);
    } catch (error) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 500).json({ message: "Receipt delivery failed" });
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Receipt delivery failed" });
  }
};
