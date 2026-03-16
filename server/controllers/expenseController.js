import Expense from '../models/Expense.js';
import fs from 'fs';
import path from 'path';

// MUST have the word 'export' here
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

// MUST have the word 'export' here
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// MUST have the word 'export' here
export const deleteExpense = async (req, res) => {
    try {
      const expense = await Expense.findOne({ _id: req.params.id, userId: req.user.id });
      if (!expense) return res.status(404).json({ message: 'Expense not found' });
  
      if (expense.receiptUrl) {
        const filePath = path.join(process.cwd(), expense.receiptUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
  
      await expense.deleteOne();
      res.status(200).json({ id: req.params.id, message: 'Expense removed' });
    } catch (error) {
      res.status(500).json({ message: 'Server Error' });
    }
};