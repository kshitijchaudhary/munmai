import mongoose from 'mongoose';
import {
  FUTURE_TRANSACTION_DATE_MESSAGE,
  isTransactionDateInFuture,
} from '../utils/transactionDate.js';
import {
  isCanonicalMoneyAmount,
  MONEY_AMOUNT_SCHEMA_MESSAGE,
} from '../utils/moneyAmount.js';

const incomeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please add an amount'],
      validate: {
        validator: isCanonicalMoneyAmount,
        message: MONEY_AMOUNT_SCHEMA_MESSAGE,
      },
    },
    source: {
      type: String,
      required: [true, 'Please add a source (e.g., Salary, Freelance)'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please add a category'],
      default: 'Uncategorized',
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
      validate: {
        validator: (value) => !isTransactionDateInFuture(value),
        message: FUTURE_TRANSACTION_DATE_MESSAGE,
      },
    },
    notes: {
      type: String,
      trim: true,
      maxLength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    fileUrl: {
      type: String,
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
  {
    timestamps: true,
  }
);

incomeSchema.index({ userId: 1, date: -1 });
incomeSchema.index(
  { userId: 1, importHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      importHash: { $exists: true, $type: 'string' },
    },
  }
);

const Income = mongoose.model('Income', incomeSchema);
export default Income;
