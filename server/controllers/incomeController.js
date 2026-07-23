import { access, unlink } from "fs/promises";
import mongoose from "mongoose";
import Income from "../models/Income.js";
import { resolveStoredFilePath } from "../utils/uploadPaths.js";
import {
  getSafeStoredUploadExtension,
  getStoredUploadMimeType,
} from "../utils/uploadTypes.js";
import { validateMoneyAmount } from "../utils/moneyAmount.js";
import { getTransactionDateValidationError } from "../utils/transactionDate.js";

const buildFileUrl = (file) => (file ? `/uploads/${file.filename}` : "");

const deleteStoredProofFile = async (fileUrl) => {
  const filePath = resolveStoredFilePath(fileUrl);

  if (!filePath) {
    return false;
  }

  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    console.warn("Failed to delete stored income proof", {
      fileUrl,
      error: error?.message,
    });
    return false;
  }
};

const cleanupUploadedProof = async (file) => {
  if (file?.filename) {
    await deleteStoredProofFile(buildFileUrl(file));
  }
};

const normalizeIncomePayload = (
  body = {},
  amount,
  fallbackDate = new Date(),
) => ({
  amount,
  source: String(body.source || "").trim(),
  category: String(body.category || "Uncategorized").trim() || "Uncategorized",
  date: body.date ? new Date(body.date) : fallbackDate,
  notes: String(body.notes || "").trim(),
});

const validateIncomePayload = (payload, dateInput) => {
  if (!payload.source || !payload.category) {
    return "Source and category are required";
  }

  const dateValidationError = getTransactionDateValidationError(dateInput);

  if (dateValidationError) {
    return dateValidationError;
  }

  if (Number.isNaN(payload.date.getTime())) {
    return "Please provide a valid date";
  }

  return "";
};

const findUserIncomeById = (incomeId, userId) =>
  Income.findOne({
    _id: incomeId,
    userId,
  });

// @desc    Add new income
// @route   POST /api/income
export const addIncome = async (req, res) => {
  try {
    const amountValidation = validateMoneyAmount(req.body.amount);

    if (!amountValidation.valid) {
      return res.status(400).json({ message: amountValidation.error });
    }

    const incomePayload = normalizeIncomePayload(
      req.body,
      amountValidation.amount,
    );
    const validationError = validateIncomePayload(incomePayload, req.body.date);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const income = await Income.create({
      userId: req.user.id,
      ...incomePayload,
    });

    return res.status(201).json(income);
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get all income for logged in user
// @route   GET /api/income
export const getIncomes = async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.user.id }).sort({ date: -1 });
    return res.status(200).json(incomes);
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update income
// @route   PUT /api/income/:id
export const updateIncome = async (req, res) => {
  const uploadedFileUrl = buildFileUrl(req.file);
  let databaseUpdated = false;

  try {
    const amountValidation = validateMoneyAmount(req.body.amount, {
      allowMultipartString: Boolean(req.is("multipart/form-data")),
    });

    if (!amountValidation.valid) {
      await cleanupUploadedProof(req.file);
      return res.status(400).json({ message: amountValidation.error });
    }

    const incomePayload = normalizeIncomePayload(
      req.body,
      amountValidation.amount,
      req.ownedIncome?.date || new Date(),
    );
    const validationError = validateIncomePayload(incomePayload, req.body.date);

    if (validationError) {
      await cleanupUploadedProof(req.file);
      return res.status(400).json({ message: validationError });
    }

    const update = { ...incomePayload };

    if (!req.body.date) {
      delete update.date;
    }

    if (uploadedFileUrl) {
      update.fileUrl = uploadedFileUrl;
    }

    const previousIncome = await Income.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: update },
      { returnDocument: "before", runValidators: true },
    );

    if (!previousIncome) {
      await cleanupUploadedProof(req.file);
      return res.status(404).json({ message: "Income record not found" });
    }

    databaseUpdated = true;

    if (
      uploadedFileUrl &&
      previousIncome.fileUrl &&
      previousIncome.fileUrl !== uploadedFileUrl
    ) {
      await deleteStoredProofFile(previousIncome.fileUrl);
    }

    const updatedIncome = await findUserIncomeById(req.params.id, req.user.id);

    if (!updatedIncome) {
      return res.status(404).json({ message: "Income record not found" });
    }

    return res.status(200).json(updatedIncome);
  } catch (error) {
    if (!databaseUpdated) {
      await cleanupUploadedProof(req.file);
    }
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Stream proof of income for the logged in owner
// @route   GET /api/income/:id/proof
export const getIncomeProofFile = async (req, res) => {
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

    if (!income.fileUrl) {
      return res.status(404).json({ message: "Proof of income not found" });
    }

    const filePath = resolveStoredFilePath(income.fileUrl);
    const contentType = getStoredUploadMimeType(income.fileUrl);
    const extension = getSafeStoredUploadExtension(income.fileUrl);

    if (!filePath || !contentType || !extension) {
      return res.status(404).json({ message: "Proof of income not found" });
    }

    try {
      await access(filePath);
    } catch {
      return res.status(404).json({ message: "Proof of income not found" });
    }

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="income-proof${extension}"`,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    });

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 500).json({
          message: "Proof of income delivery failed",
        });
      }
    });
  } catch (error) {
    if (error?.name === "CastError") {
      return res.status(404).json({ message: "Income record not found" });
    }

    return res.status(500).json({ message: "Proof of income delivery failed" });
  }
};

// @desc    Delete income record
// @route   DELETE /api/income/:id
export const deleteIncome = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Income record not found" });
    }

    const income = await Income.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    if (income.fileUrl) {
      await deleteStoredProofFile(income.fileUrl);
    }

    return res.status(200).json({
      id: req.params.id,
      message: "Income removed",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};
