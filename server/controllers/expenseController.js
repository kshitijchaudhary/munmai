import Expense from '../models/Expense.js';
import fs from 'fs';
import path from 'path';

// @desc    Add new expense
// @route   POST /api/expenses
export const addExpense = async (req, res) => {
  try {
    const { amount, recipient, category, date, notes } = req.body;

    if (!amount || !recipient || !category) {
      return res.status(400).json({
        message: 'Amount, recipient, and category are required',
      });
    }

    const expense = await Expense.create({
      userId: req.user.id,
      amount,
      recipient,
      category,
      date: date || Date.now(),
      notes,
      receiptUrl: req.file ? `/uploads/${req.file.filename}` : '',
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all expenses for logged in user
// @route   GET /api/expenses
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
export const updateExpense = async (req, res) => {
  try {
    const { amount, recipient, category, date, notes } = req.body;

    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (!amount || !recipient || !category) {
      return res.status(400).json({
        message: 'Amount, recipient, and category are required',
      });
    }

    expense.amount = amount;
    expense.recipient = recipient;
    expense.category = category;
    expense.date = date || expense.date;
    expense.notes = notes ?? '';

    if (req.file) {
      if (expense.receiptUrl) {
        const oldFilePath = path.join(
          process.cwd(),
          expense.receiptUrl.replace(/^\/+/, '')
        );

        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      expense.receiptUrl = `/uploads/${req.file.filename}`;
    }

    const updatedExpense = await expense.save();

    res.status(200).json(updatedExpense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete expense and receipt file if exists
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.receiptUrl) {
      const filePath = path.join(
        process.cwd(),
        expense.receiptUrl.replace(/^\/+/, '')
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await expense.deleteOne();

    res.status(200).json({
      id: req.params.id,
      message: 'Expense removed',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};