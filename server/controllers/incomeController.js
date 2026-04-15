import Income from "../models/Income.js";

const normalizeIncomePayload = (body = {}, fallbackDate = new Date()) => ({
  amount: Number(body.amount),
  source: String(body.source || "").trim(),
  category: String(body.category || "Uncategorized").trim() || "Uncategorized",
  date: body.date ? new Date(body.date) : fallbackDate,
  notes: String(body.notes || "").trim(),
});

const validateIncomePayload = (payload) => {
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return "Amount must be greater than 0";
  }

  if (!payload.source || !payload.category) {
    return "Source and category are required";
  }

  if (Number.isNaN(payload.date.getTime())) {
    return "Please provide a valid date";
  }

  return "";
};

const applyIncomePayload = (income, payload) => {
  income.amount = payload.amount;
  income.source = payload.source;
  income.category = payload.category;
  income.date = payload.date;
  income.notes = payload.notes;
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
    const incomePayload = normalizeIncomePayload(req.body);
    const validationError = validateIncomePayload(incomePayload);

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
  try {
    const income = await findUserIncomeById(req.params.id, req.user.id);

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    const incomePayload = normalizeIncomePayload(req.body, income.date);
    const validationError = validateIncomePayload(incomePayload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    applyIncomePayload(income, incomePayload);

    const updatedIncome = await income.save();

    return res.status(200).json(updatedIncome);
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete income record
// @route   DELETE /api/income/:id
export const deleteIncome = async (req, res) => {
  try {
    const income = await findUserIncomeById(req.params.id, req.user.id);

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    await income.deleteOne();

    return res.status(200).json({
      id: req.params.id,
      message: "Income removed",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};
