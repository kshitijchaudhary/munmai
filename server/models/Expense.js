import mongoose from 'mongoose';
import {
  FUTURE_TRANSACTION_DATE_MESSAGE,
  isTransactionDateInFuture,
} from '../utils/transactionDate.js';

const expenseCategories = [
  'Rent',
  'Food',
  'Groceries',
  'Utilities',
  'Entertainment',
  'Transport',
  'Fuel',
  'Healthcare',
  'Shopping',
  'Phone & Internet',
  'Software & SaaS',
  'Office Supplies',
  'Equipment',
  'Education',
  'Marketing',
  'Travel',
  'Meals',
  'Insurance',
  'Bank Fees',
  'Taxes & Licenses',
  'Professional Services',
  'Contractors',
  'Home Office',
  'Client Gifts',
  'Other',
];

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    recipient: {
      type: String,
      required: [true, 'Recipient/Vendor is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: expenseCategories,
      default: 'Other',
    },
    expenseType: {
      type: String,
      enum: ['personal', 'business', 'mixed'],
      default: 'personal',
    },
    taxCategory: {
      type: String,
      trim: true,
      default: '',
    },
    deductible: {
      type: Boolean,
      default: false,
    },
    deductiblePercent: {
      type: Number,
      min: [0, 'Deductible percent cannot be negative'],
      max: [100, 'Deductible percent cannot exceed 100'],
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
      validate: {
        validator: (value) => !isTransactionDateInFuture(value),
        message: FUTURE_TRANSACTION_DATE_MESSAGE,
      },
    },
    receiptUrl: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxLength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    importSource: {
      type: String,
      enum: ['pdf', 'csv'],
      trim: true,
    },
    importFileName: {
      type: String,
      trim: true,
      default: '',
    },
    importHash: {
      type: String,
      trim: true,
      index: true,
    },
    importedAt: {
      type: Date,
    },
    originalDescription: {
      type: String,
      trim: true,
      default: '',
    },
    originalRawText: {
      type: String,
      trim: true,
      default: '',
    },
    sourceRowNumber: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true }
);

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index(
  { userId: 1, importHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      importHash: { $exists: true, $type: 'string' },
    },
  }
);

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
