import { unlink } from "fs/promises";
import Expense from "../models/Expense.js";
import { validateMoneyAmount } from "../utils/moneyAmount.js";
import { resolveStoredFilePath } from "../utils/uploadPaths.js";
import { getTransactionDateValidationError } from "../utils/transactionDate.js";

const allowedExpenseTypes = new Set(["personal", "business", "mixed"]);

const parseBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
};

const normalizeExpenseType = (value) =>
  allowedExpenseTypes.has(value) ? value : "personal";

const buildReceiptUrl = (file) => (file ? `/uploads/${file.filename}` : "");

const normalizeExpensePayload = ({ amount, body, receiptUrl }) => {
  const expenseType = normalizeExpenseType(body.expenseType);
  const deductibleRequested = parseBoolean(body.deductible);
  const deductible = expenseType === "personal" ? false : deductibleRequested;
  const defaultDeductiblePercent = expenseType === "mixed" ? 50 : 100;

  let deductiblePercent = deductible ? Number(body.deductiblePercent) : 0;

  if (!Number.isFinite(deductiblePercent) || deductiblePercent <= 0) {
    deductiblePercent = deductible ? defaultDeductiblePercent : 0;
  }

  deductiblePercent = Math.min(Math.max(deductiblePercent, 0), 100);

  return {
    amount,
    recipient: String(body.recipient || "").trim(),
    category: String(body.category || "Other").trim() || "Other",
    expenseType,
    deductible,
    deductiblePercent,
    taxCategory: deductible ? String(body.taxCategory || "").trim() : "",
    date: body.date ? new Date(body.date) : new Date(),
    notes: String(body.notes || "").trim(),
    receiptUrl,
  };
};

const validateExpensePayload = (payload, dateInput) => {
  if (!payload.recipient || !payload.category) {
    return "Amount, recipient, and category are required";
  }

  const dateValidationError = getTransactionDateValidationError(dateInput);

  if (dateValidationError) {
    return dateValidationError;
  }

  if (Number.isNaN(payload.date.getTime())) {
    return "Please provide a valid date";
  }

  if (payload.deductible && !payload.taxCategory) {
    return "Select a tax category for deductible expenses";
  }

  return "";
};

const applyExpensePayload = (expense, payload) => {
  expense.amount = payload.amount;
  expense.recipient = payload.recipient;
  expense.category = payload.category;
  expense.expenseType = payload.expenseType;
  expense.taxCategory = payload.taxCategory;
  expense.deductible = payload.deductible;
  expense.deductiblePercent = payload.deductiblePercent;
  expense.date = payload.date;
  expense.notes = payload.notes;
  expense.receiptUrl = payload.receiptUrl;
};

const deleteStoredReceiptFile = async (fileUrl) => {
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

    console.warn("Failed to delete stored receipt file", {
      fileUrl,
      error: error?.message,
    });
    return false;
  }
};

const cleanupUploadedReceipt = async (file) => {
  if (!file?.filename) {
    return;
  }

  await deleteStoredReceiptFile(buildReceiptUrl(file));
};

const findUserExpenseById = (expenseId, userId) =>
  Expense.findOne({
    _id: expenseId,
    userId,
  });

// @desc    Add new expense
// @route   POST /api/expenses
export const addExpense = async (req, res) => {
  const uploadedReceiptUrl = buildReceiptUrl(req.file);

  try {
    const amountValidation = validateMoneyAmount(req.body.amount, {
      allowMultipartString: Boolean(req.is("multipart/form-data")),
    });

    if (!amountValidation.valid) {
      await cleanupUploadedReceipt(req.file);
      return res.status(400).json({ message: amountValidation.error });
    }

    const expensePayload = normalizeExpensePayload({
      amount: amountValidation.amount,
      body: req.body,
      receiptUrl: uploadedReceiptUrl,
    });
    const validationError = validateExpensePayload(expensePayload, req.body.date);

    if (validationError) {
      await cleanupUploadedReceipt(req.file);
      return res.status(400).json({ message: validationError });
    }

    const expense = await Expense.create({
      userId: req.user.id,
      ...expensePayload,
    });

    return res.status(201).json(expense);
  } catch (error) {
    await cleanupUploadedReceipt(req.file);
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get all expenses for logged in user
// @route   GET /api/expenses
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
    return res.status(200).json(expenses);
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
export const updateExpense = async (req, res) => {
  const uploadedReceiptUrl = buildReceiptUrl(req.file);

  try {
    const expense = await findUserExpenseById(req.params.id, req.user.id);

    if (!expense) {
      await cleanupUploadedReceipt(req.file);
      return res.status(404).json({ message: "Expense not found" });
    }

    const existingReceiptUrl = expense.receiptUrl || "";
    const nextReceiptUrl = uploadedReceiptUrl || existingReceiptUrl;
    const amountValidation = validateMoneyAmount(req.body.amount, {
      allowMultipartString: Boolean(req.is("multipart/form-data")),
    });

    if (!amountValidation.valid) {
      await cleanupUploadedReceipt(req.file);
      return res.status(400).json({ message: amountValidation.error });
    }

    const expensePayload = normalizeExpensePayload({
      amount: amountValidation.amount,
      body: req.body,
      receiptUrl: nextReceiptUrl,
    });
    const validationError = validateExpensePayload(expensePayload, req.body.date);

    if (validationError) {
      await cleanupUploadedReceipt(req.file);
      return res.status(400).json({ message: validationError });
    }

    applyExpensePayload(expense, expensePayload);

    const updatedExpense = await expense.save();

    if (uploadedReceiptUrl && existingReceiptUrl && existingReceiptUrl !== uploadedReceiptUrl) {
      await deleteStoredReceiptFile(existingReceiptUrl);
    }

    return res.status(200).json(updatedExpense);
  } catch (error) {
    await cleanupUploadedReceipt(req.file);
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete expense and receipt file if exists
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req, res) => {
  try {
    const expense = await findUserExpenseById(req.params.id, req.user.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await expense.deleteOne();

    if (expense.receiptUrl) {
      await deleteStoredReceiptFile(expense.receiptUrl);
    }

    return res.status(200).json({
      id: req.params.id,
      message: "Expense removed",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};
