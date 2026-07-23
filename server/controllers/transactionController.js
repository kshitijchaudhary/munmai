import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import {
  FUTURE_TRANSACTION_DATE_MESSAGE,
  getTransactionDateValidationError,
} from "../utils/transactionDate.js";

const expenseCategories = new Set([
  "Rent",
  "Food",
  "Groceries",
  "Utilities",
  "Entertainment",
  "Transport",
  "Fuel",
  "Healthcare",
  "Shopping",
  "Phone & Internet",
  "Software & SaaS",
  "Office Supplies",
  "Equipment",
  "Education",
  "Marketing",
  "Travel",
  "Meals",
  "Insurance",
  "Bank Fees",
  "Taxes & Licenses",
  "Professional Services",
  "Contractors",
  "Home Office",
  "Client Gifts",
  "Other",
]);

const incomeCategories = new Set([
  "Salary",
  "Freelance",
  "Contract",
  "Marketplace",
  "Business",
  "Gift",
  "Investment",
  "Refund",
  "Other",
]);

const expenseCategoryAliases = {
  grocery: "Groceries",
  groceries: "Groceries",
  restaurant: "Meals",
  restaurants: "Meals",
  dining: "Meals",
  transport: "Transport",
  transportation: "Transport",
  transit: "Transport",
  gas: "Fuel",
  petrol: "Fuel",
  internet: "Phone & Internet",
  phone: "Phone & Internet",
  mobile: "Phone & Internet",
  software: "Software & SaaS",
  saas: "Software & SaaS",
  office: "Office Supplies",
  supplies: "Office Supplies",
  education: "Education",
  training: "Education",
  advertising: "Marketing",
  marketing: "Marketing",
  travel: "Travel",
  insurance: "Insurance",
  fees: "Bank Fees",
  bank: "Bank Fees",
  taxes: "Taxes & Licenses",
  licenses: "Taxes & Licenses",
  contractors: "Contractors",
  contractor: "Contractors",
};

const incomeCategoryAliases = {
  salary: "Salary",
  freelance: "Freelance",
  contract: "Contract",
  contractor: "Contract",
  marketplace: "Marketplace",
  business: "Business",
  gift: "Gift",
  investment: "Investment",
  refund: "Refund",
};

const normalizeText = (value) => String(value ?? "").trim();

const parseAmount = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const normalized = normalizeText(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  if (!normalized) {
    return NaN;
  }

  if (/^\(.*\)$/.test(normalized)) {
    return -Number(normalized.slice(1, -1));
  }

  return Number(normalized);
};

const parseDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const normalizeType = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "income") return "income";
  if (normalized === "expense") return "expense";

  return "";
};

const normalizeCategory = (value, type) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "Other";
  }

  const aliases = type === "expense" ? expenseCategoryAliases : incomeCategoryAliases;
  const exactSet = type === "expense" ? expenseCategories : incomeCategories;

  if (exactSet.has(normalized)) {
    return normalized;
  }

  const aliasMatch = aliases[normalized.toLowerCase()];
  return aliasMatch || "Other";
};

export const importTransactions = async (req, res) => {
  try {
    const transactions = Array.isArray(req.body.transactions)
      ? req.body.transactions
      : [];

    if (!transactions.length) {
      return res.status(400).json({
        message: "Upload at least one transaction to import",
      });
    }

    if (transactions.length > 500) {
      return res.status(400).json({
        message: "Imports are limited to 500 rows at a time",
      });
    }

    const incomeDocs = [];
    const expenseDocs = [];
    const errors = [];

    transactions.forEach((transaction, index) => {
      const type = normalizeType(transaction.type);
      const amount = parseAmount(transaction.amount);
      const date = parseDate(transaction.date);
      const dateValidationError = getTransactionDateValidationError(transaction.date, {
        allowFlexibleStrings: true,
      });
      const title = normalizeText(
        transaction.title ||
          transaction.description ||
          transaction.recipient ||
          transaction.source
      );
      const notes = normalizeText(transaction.notes);

      if (!type || !Number.isFinite(amount) || !date || !title || dateValidationError) {
        errors.push({
          row: index + 1,
          message:
            dateValidationError === FUTURE_TRANSACTION_DATE_MESSAGE
              ? dateValidationError
              : "Missing or invalid type, amount, date, or description",
        });
        return;
      }

      const normalizedAmount = Math.abs(amount);
      const category = normalizeCategory(transaction.category, type);

      if (type === "expense") {
        expenseDocs.push({
          userId: req.user.id,
          amount: normalizedAmount,
          recipient: title,
          category,
          date,
          notes,
          expenseType: "personal",
          deductible: false,
          deductiblePercent: 0,
          taxCategory: "",
          receiptUrl: "",
        });
        return;
      }

      incomeDocs.push({
        userId: req.user.id,
        amount: normalizedAmount,
        source: title,
        category,
        date,
        notes,
      });
    });

    if (!incomeDocs.length && !expenseDocs.length) {
      return res.status(400).json({
        message: "No valid rows were found in that CSV",
        errors: errors.slice(0, 10),
      });
    }

    const [importedIncomes, importedExpenses] = await Promise.all([
      incomeDocs.length ? Income.insertMany(incomeDocs) : [],
      expenseDocs.length ? Expense.insertMany(expenseDocs) : [],
    ]);

    res.status(201).json({
      importedCount: importedIncomes.length + importedExpenses.length,
      incomeCount: importedIncomes.length,
      expenseCount: importedExpenses.length,
      skippedCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
