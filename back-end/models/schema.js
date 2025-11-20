// backend/models/schema.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phoneNo: { type: String, required: true, unique: true },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  upiId: { type: String, default: '' }
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date }
}, { timestamps: true });

const ExpenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  contributions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    receiptUrl: { type: String },
    verified: { type: Boolean, default: true } 
  }],
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  splitType: { type: String, enum: ['equal', 'custom'], required: true },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number }
  }],
  billImage: { type: String },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const SettlementSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  debtor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
  status: {
    type: String,
    enum: ['pending', 'paid_pending_verification', 'completed', 'rejected'],
    default: 'pending',
  },
  paidAmount: { type: Number, default: 0 },
  paymentProof: { type: String, default: '' },
  proofHash: { type: String }, // <--- NEW: For Integrity Check
  paidAt: { type: Date },
  verifiedAt: { type: Date },
}, { timestamps: true });

// --- NEW NOTIFICATION SCHEMA ---
const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who receives it
  type: { type: String, enum: ['payment', 'reminder', 'info'], required: true },
  message: { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId }, // ID of expense or settlement
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Settlement = mongoose.model('Settlement', SettlementSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = { User, Group, Expense, Settlement, Notification };