import Expense from '../models/Expense.js';

export const addExpense = async (req, res) => {
  try {
    const { amount, recipient, category, date, notes } = req.body;
    
    const expense = await Expense.create({
      userId: req.user.id,
      amount,
      recipient,
      category,
      date,
      notes,
      receiptUrl: req.file ? `/uploads/${req.file.filename}` : ''
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};