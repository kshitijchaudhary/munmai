import Income from '../models/Income.js';

// @desc    Add new income
// @route   POST /api/income
export const addIncome = async (req, res) => {
  try {
    const { amount, source, category, date, notes } = req.body;

    if (!amount || !source || !category) {
      return res.status(400).json({
        message: 'Amount, source, and category are required',
      });
    }

    const income = await Income.create({
      userId: req.user.id,
      amount,
      source,
      category,
      date: date || Date.now(),
      notes,
    });

    res.status(201).json(income);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all income for logged in user
// @route   GET /api/income
export const getIncomes = async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.user.id }).sort({ date: -1 });
    res.status(200).json(incomes);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update income
// @route   PUT /api/income/:id
export const updateIncome = async (req, res) => {
  try {
    const { amount, source, category, date, notes } = req.body;

    const income = await Income.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!income) {
      return res.status(404).json({ message: 'Income record not found' });
    }

    if (!amount || !source || !category) {
      return res.status(400).json({
        message: 'Amount, source, and category are required',
      });
    }

    income.amount = amount;
    income.source = source;
    income.category = category;
    income.date = date || income.date;
    income.notes = notes ?? '';

    const updatedIncome = await income.save();

    res.status(200).json(updatedIncome);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete income record
// @route   DELETE /api/income/:id
export const deleteIncome = async (req, res) => {
  try {
    const income = await Income.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!income) {
      return res.status(404).json({ message: 'Record not found' });
    }

    await income.deleteOne();

    res.status(200).json({
      id: req.params.id,
      message: 'Income removed',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};