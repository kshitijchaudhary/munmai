import mongoose from 'mongoose';

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
      enum: [
        'Rent',
        'Food',
        'Utilities',
        'Entertainment',
        'Transport',
        'Healthcare',
        'Shopping',
        'Other',
      ],
      default: 'Other',
    },
    date: {
      type: Date,
      default: Date.now,
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
  },
  { timestamps: true }
);

expenseSchema.index({ userId: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;