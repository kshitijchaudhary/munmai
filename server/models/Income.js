import mongoose from 'mongoose';

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
      min: [0, 'Amount cannot be negative'],
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
  },
  {
    timestamps: true,
  }
);

incomeSchema.index({ userId: 1, date: -1 });

const Income = mongoose.model('Income', incomeSchema);
export default Income;