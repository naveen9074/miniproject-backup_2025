// backend/controllers/expenseController.js
const asyncHandler = require('express-async-handler');
const { Expense, Group } = require('../models/schema');
const { calculateAndSaveSettlements } = require('../utils/calculateSettlement');

// @desc    Add a new expense
// @route   POST /api/expenses
// @access  Private
const addExpense = asyncHandler(async (req, res) => {
  const { description, amount, group: groupId, splitType } = req.body;
  
  const group = await Group.findById(groupId);
  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }

  const members = group.members;
  let finalSplits = [];
  const parsedAmount = parseFloat(amount);

  if (splitType === 'equal') {
    // Calculate equal split
    const splitAmount = parsedAmount / members.length;
    finalSplits = members.map(memberId => ({
      user: memberId,
      amount: splitAmount,
    }));
  } else if (splitType === 'custom') {
    // --- FIX for Problem #2 ---
    // We get the custom 'splits' array from the form
    finalSplits = JSON.parse(req.body.splits);
    
    // Server-side validation
    const totalCustomSplit = finalSplits.reduce((acc, split) => acc + parseFloat(split.amount), 0);
    // Check if custom total matches the expense amount
    if (Math.abs(totalCustomSplit - parsedAmount) > 0.01) { 
      res.status(400);
      throw new Error(`Custom splits add up to ₹${totalCustomSplit.toFixed(2)}, but the total amount is ₹${parsedAmount}.`);
    }
    // --- END OF FIX ---
  } else {
    res.status(400);
    throw new Error('Invalid split type');
  }
  
  let billImageUrl = '';
  if (req.file) {
    billImageUrl = `/${req.file.path.replace(/\\/g, '/')}`;
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

  const createdExpense = await expense.save();
  
  // Recalculate settlements
  await calculateAndSaveSettlements(groupId);

  res.status(201).json(createdExpense);
});

module.exports = {
  addExpense,
};