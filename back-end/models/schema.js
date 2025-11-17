// backend/models/schema.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phoneNo: { type: String, required: true, unique: true }, // This is your original field
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  upiId: { type: String, default: '' } // Add this field
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date }
}, {
  timestamps: true // <-- THIS IS THE FIX. It automatically adds 'createdAt'
});

const ExpenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  splitType: { type: String, enum: ['equal', 'custom'], required: true },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number }
  }],
  billImage: { type: String }, // For expense proof
  date: { type: Date, default: Date.now }
});

const SettlementSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  debtor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid_pending_verification', 'verified', 'rejected'],
    default: 'pending',
  },
  amount_paid: { type: Number },
  payment_proof_url: { type: String },
  paid_at: { type: Date },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Settlement = mongoose.model('Settlement', SettlementSchema);

module.exports = { User, Group, Expense, Settlement };