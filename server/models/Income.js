import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount'],
    min: [0, 'Amount cannot be negative']
  },
  source: {
    type: String,
    required: [true, 'Please add a source (e.g., Salary, Freelance)'],
    trim: true
  },
  category: {
    type: String,
    required: true,
    default: 'Uncategorized'
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxLength: [500, 'Notes cannot exceed 500 characters']
  },
  fileUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexing userId for faster lookups as the dataset grows
incomeSchema.index({ userId: 1, date: -1 });

const Income = mongoose.model('Income', incomeSchema);
export default Income;