// backend/utils/calculateSettlement.js
const { Expense, Settlement, User, Group } = require('../models/schema');

/**
 * Your original Greedy Algorithm logic.
 * This part is great, we'll keep it as a helper.
 */
function calculateDebts(expenses, members) {
  const balances = new Map();

  // Initialize balances for all members
  members.forEach(member => {
    balances.set(member._id.toString(), {
      id: member._id,
      username: member.username,
      balance: 0,
    });
  });

  // Calculate balances from expenses
  expenses.forEach(expense => {
    const totalAmount = expense.amount;
    const paidById = expense.paidBy._id.toString();
    const numMembers = expense.splits.length;
    const share = totalAmount / numMembers;

    // Add to the payer's balance
    if (balances.has(paidById)) {
      balances.get(paidById).balance += totalAmount;
    }

    // Subtract from each member's share
    expense.splits.forEach(split => {
      const memberId = split.user.toString();
      if (balances.has(memberId)) {
        balances.get(memberId).balance -= share; // Assuming equal split for now
      }
    });
  });

  const debtors = [];
  const creditors = [];

  balances.forEach(user => {
    if (user.balance < 0) {
      debtors.push({ ...user, balance: -user.balance }); // Use positive amount
    } else if (user.balance > 0) {
      creditors.push({ ...user });
    }
  });

  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  let i = 0; // creditor index
  let j = 0; // debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.balance, debtor.balance);

    transactions.push({
      from: { _id: debtor.id, username: debtor.username },
      to: { _id: creditor.id, username: creditor.username },
      amount: amount,
    });

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance < 0.01) i++; // Use a small threshold for float comparison
    if (debtor.balance < 0.01) j++;
  }

  return transactions;
}

/**
 * This is the new, main function that syncs debts with the database.
 */
const calculateAndSaveSettlements = async (groupId) => {
  const group = await Group.findById(groupId).populate('members', 'username');
  if (!group) return;

  const expenses = await Expense.find({ group: groupId })
    .populate('paidBy', 'username');

  // 1. Calculate the new, required settlements
  const transactions = calculateDebts(expenses, group.members);

  // 2. Get all existing 'pending' settlements for this group
  const existingSettlements = await Settlement.find({ 
    group: groupId, 
    status: 'pending' 
  });

  // 3. Update or create settlements
  for (const t of transactions) {
    const debtorId = t.from._id;
    const creditorId = t.to._id;
    const amount = t.amount;

    // Find if this exact debt already exists
    const existing = existingSettlements.find(
      s => s.debtor.toString() === debtorId.toString() && 
           s.creditor.toString() === creditorId.toString()
    );

    if (existing) {
      // Update the amount
      existing.amount = amount;
      await existing.save();
      // Mark it as "processed" by removing from array
      existingSettlements.splice(existingSettlements.indexOf(existing), 1);
    } else {
      // Create a new settlement document
      await Settlement.create({
        group: groupId,
        debtor: debtorId,
        creditor: creditorId,
        amount: amount,
        status: 'pending',
      });
    }
  }

  // 4. Any settlements left in 'existingSettlements' are now $0.00
  // and should be deleted (or marked 'paid')
  for (const old of existingSettlements) {
    await Settlement.findByIdAndDelete(old._id);
  }
};

module.exports = {
  calculateAndSaveSettlements,
  calculateDebts // We export both now
};