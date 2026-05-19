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
