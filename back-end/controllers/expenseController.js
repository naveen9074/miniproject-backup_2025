// backend/controllers/expenseController.js
const asyncHandler = require('express-async-handler');
const { Expense, Group } = require('../models/schema');
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

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400);
    throw new Error("Invalid amount");
  }

  // Parse Contributions
  let contributions = [];
  if (req.body.contributions) {
    try {
      contributions = typeof req.body.contributions === 'string' 
        ? JSON.parse(req.body.contributions) 
        : req.body.contributions;
    } catch (e) {
      res.status(400); throw new Error("Invalid contributions format");
    }
  } else {
    contributions = [{ user: req.user._id, amount: parsedAmount }];
  }

  // Verify Contributions Sum
  const totalContributed = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  if (Math.abs(totalContributed - parsedAmount) > 0.1) {
    res.status(400);
    throw new Error(`Contributions (${totalContributed}) must equal Total (${parsedAmount})`);
  }

  // Calculate Splits
  let finalSplits = [];
  if (splitType === "equal") {
    const splitAmount = parsedAmount / group.members.length;
    finalSplits = group.members.map((memberId) => ({
      user: memberId,
      amount: splitAmount,
    }));
  } else if (splitType === "custom") {
    try {
      finalSplits = typeof req.body.splits === 'string' ? JSON.parse(req.body.splits) : req.body.splits;
      const totalCustom = finalSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
      if (Math.abs(totalCustom - parsedAmount) > 0.1) {
        res.status(400); throw new Error("Custom splits must sum to total amount");
      }
    } catch (e) {
      res.status(400); throw new Error("Invalid splits data");
    }
  }

  let billImageUrl = "";
  if (req.file) {
    billImageUrl = `/${req.file.path.replace(/\\/g, "/")}`;
  }

  if (billImageUrl && contributions.length > 0) {
      contributions[0].receiptUrl = billImageUrl;
  }

  const expense = new Expense({
    group: groupId,
    amount: parsedAmount,
    description,
    splitType,
    splits: finalSplits,
    contributions: contributions,
    billImage: billImageUrl,
    createdBy: req.user._id
  });

  const saved = await expense.save();
  await calculateAndSaveSettlements(groupId);

  res.status(201).json(saved);
});

// -------------------------------------------
// GET EXPENSE DETAILS
// -------------------------------------------
const getExpenseDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id.toString();

  const expense = await Expense.findById(id)
    .populate('contributions.user', 'name email username _id')
    .populate('splits.user', 'name email username _id')
    .populate('group', 'name _id');

  if (!expense) {
    res.status(404);
    throw new Error("Expense not found");
  }

  // Pseudo-settlements for display only
  const settlements = [];
  // Simple payer logic for display: Assume first contributor is main payer for UI simplicity 
  // (Real settlement logic is in calculateSettlement.js)
  const mainPayer = expense.contributions[0]?.user || {};

  expense.splits.forEach((split) => {
    if (split.user._id.toString() === mainPayer._id?.toString()) return;

    settlements.push({
      _id: `${id}-${split.user._id}`,
      debtor: split.user,
      creditor: mainPayer,
      amount: split.amount,
      status: 'pending',
      isCurrentUserDebtor: currentUserId === split.user._id.toString(),
      isCurrentUserCreditor: currentUserId === mainPayer._id?.toString(),
    });
  });

  res.status(200).json({ expense, settlements });
});

// -------------------------------------------
// UPDATE EXPENSE (NEW)
// -------------------------------------------
const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, amount, splitType } = req.body;

  const expense = await Expense.findById(id);
  if (!expense) {
    res.status(404);
    throw new Error("Expense not found");
  }

  if (expense.createdBy.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error("Not authorized to edit this expense");
  }

  const parsedAmount = parseFloat(amount);
  
  // Basic update logic (simplified for equal splits)
  if (splitType === 'equal' && parsedAmount) {
     const group = await Group.findById(expense.group);
     const splitAmount = parsedAmount / group.members.length;
     expense.splits = group.members.map((m) => ({ user: m, amount: splitAmount }));
  }
  
  // Update fields
  if(description) expense.description = description;
  if(amount) expense.amount = parsedAmount;
  if(splitType) expense.splitType = splitType;

  await expense.save();
  await calculateAndSaveSettlements(expense.group); // Recalculate!

  res.json(expense);
});

// -------------------------------------------
// DELETE EXPENSE (NEW)
// -------------------------------------------
const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const expense = await Expense.findById(id);

  if (!expense) {
    res.status(404);
    throw new Error("Expense not found");
  }

  if (expense.createdBy.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error("Not authorized to delete this expense");
  }

  const groupId = expense.group;
  await expense.deleteOne();

  await calculateAndSaveSettlements(groupId); // Recalculate!

  res.json({ message: "Expense removed" });
});

module.exports = { 
  addExpense, 
  getExpenseDetails, 
  updateExpense, 
  deleteExpense 
};