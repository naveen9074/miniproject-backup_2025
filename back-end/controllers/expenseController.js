// backend/controllers/expenseController.js
const asyncHandler = require('express-async-handler');
const { Expense, Group, Settlement } = require('../models/schema');
const { calculateAndSaveSettlements } = require('../utils/calculateSettlement');

// -------------------------------------------
// ADD EXPENSE
// -------------------------------------------
const addExpense = asyncHandler(async (req, res) => {
  const { description, amount, group: groupId, splitType } = req.body;

  const group = await Group.findById(groupId);
  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }

  const members = group.members;
  let finalSplits = [];
  const parsedAmount = parseFloat(amount);

  if (splitType === "equal") {
    const splitAmount = parsedAmount / members.length;
    finalSplits = members.map((memberId) => ({
      user: memberId,
      amount: splitAmount,
    }));
  } else if (splitType === "custom") {
    finalSplits = JSON.parse(req.body.splits);
    const totalCustom = finalSplits.reduce(
      (acc, s) => acc + parseFloat(s.amount),
      0
    );

    if (Math.abs(totalCustom - parsedAmount) > 0.01) {
      res.status(400);
      throw new Error("Custom splits mismatch");
    }
  } else {
    res.status(400);
    throw new Error("Invalid split type");
  }

  let billImageUrl = "";
  if (req.file) {
    billImageUrl = `/${req.file.path.replace(/\\/g, "/")}`;
  }

  const expense = new Expense({
    group: groupId,
    paidBy: req.user._id,
    amount: parsedAmount,
    description,
    splitType,
    splits: finalSplits,
    billImage: billImageUrl,
  });

  const saved = await expense.save();

  // Recompute group-level settlements
  await calculateAndSaveSettlements(groupId);

  res.status(201).json(saved);
});

// -------------------------------------------
// GET EXPENSE DETAILS WITH SETTLEMENTS
// Calculate settlements ONLY for this specific expense
// -------------------------------------------
const getExpenseDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id.toString();

  const expense = await Expense.findById(id)
    .populate('paidBy', 'name email username _id')
    .populate('splits.user', 'name email username _id')
    .populate('group', 'name _id');

  if (!expense) {
    res.status(404);
    throw new Error("Expense not found");
  }

  // Calculate settlements ONLY for this specific expense
  const settlements = [];

  expense.splits.forEach((split) => {
    // Skip if the person who paid is in the split (they don't owe themselves)
    if (split.user._id.toString() === expense.paidBy._id.toString()) {
      return;
    }

    // Create a settlement for this split
    settlements.push({
      _id: `${id}-${split.user._id}`, // Pseudo ID for this expense split
      debtor: {
        _id: split.user._id,
        username: split.user.username,
        email: split.user.email,
      },
      creditor: {
        _id: expense.paidBy._id,
        username: expense.paidBy.username,
        email: expense.paidBy.email,
      },
      amount: split.amount,
      status: 'pending', // For expense-specific view, always show as pending
      isCurrentUserDebtor: currentUserId === split.user._id.toString(),
      isCurrentUserCreditor: currentUserId === expense.paidBy._id.toString(),
    });
  });

  res.status(200).json({
    expense,
    settlements,
  });
});

module.exports = { addExpense, getExpenseDetails };