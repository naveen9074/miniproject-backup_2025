// backend/utils/calculateSettlement.js
const { Expense, Settlement, Group } = require('../models/schema');

function userIdString(u) {
  if (!u) return null;
  if (typeof u === 'string') return u;
  if (u._id) return u._id.toString();
  return (u.user && u.user._id) ? u.user._id.toString() : (u.user ? u.user.toString() : null);
}

/**
 * Compute Balances
 * - CREDITS: Users who contributed (paid) money get positive balance.
 * - DEBITS: Users who are part of the split (consumers) get negative balance.
 */
function computeBalances(expenses, members) {
  const balances = new Map();

  // 1. Initialize all members with 0.00
  members.forEach(member => {
    const id = member._id.toString();
    balances.set(id, { id, username: member.username, balance: 0 });
  });

  expenses.forEach(expense => {
    const totalAmount = Number(expense.amount) || 0;
    
    // --- STEP 1: ADD CREDITS (Who Paid) ---
    if (expense.contributions && expense.contributions.length > 0) {
      expense.contributions.forEach(c => {
        const uid = userIdString(c.user);
        const paidAmt = Number(c.amount) || 0;
        if (uid && balances.has(uid)) {
          balances.get(uid).balance += paidAmt;
        }
      });
    } else if (expense.paidBy) {
       // Fallback for legacy data (single payer)
       const payerId = userIdString(expense.paidBy);
       if (payerId && balances.has(payerId)) {
         balances.get(payerId).balance += totalAmount;
       }
    }

    // --- STEP 2: SUBTRACT DEBITS (Who Consumed) ---
    // If custom splits are defined
    if (expense.splitType === 'custom' && Array.isArray(expense.splits) && expense.splits.length > 0) {
      expense.splits.forEach(s => {
        const uid = userIdString(s.user);
        const shareAmt = Number(s.amount) || 0;
        if (uid && balances.has(uid)) {
           balances.get(uid).balance -= shareAmt;
        }
      });
    } else {
      // Equal split
      // Determine participants: either explicit list or ALL group members
      const participants = (Array.isArray(expense.splits) && expense.splits.length > 0)
        ? expense.splits.map(s => userIdString(s.user))
        : members.map(m => m._id.toString());
      
      // Filter to ensure participants verify against group members
      const validParticipants = participants.filter(p => p && balances.has(p));
      
      if (validParticipants.length > 0) {
        const share = totalAmount / validParticipants.length;
        validParticipants.forEach(uid => {
          balances.get(uid).balance -= share;
        });
      }
    }
  });

  // Rounding pass to fix floating point errors
  for (const [key, val] of balances) {
    val.balance = Math.round(val.balance * 100) / 100;
  }

  return balances;
}

function computeSettlementPairsFromBalances(balancesMap) {
  const arr = Array.from(balancesMap.values()).map(u => ({ ...u }));

  // Separate into debtors (negative balance) and creditors (positive balance)
  // Sort by magnitude (largest debts/credits first) to minimize number of transactions
  const creditors = arr.filter(u => u.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const debtors = arr.filter(u => u.balance < -0.01).sort((a, b) => a.balance - b.balance); // Most negative first

  const pairs = [];
  let i = 0; // creditor index
  let j = 0; // debtor index

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    
    // The amount to settle is the minimum of what the creditor is owed and what the debtor owes
    // debt.balance is negative, so we negate it
    const amount = Math.min(credit.balance, -debt.balance);

    if (amount > 0.009) { // Ignore micro-pennies
      pairs.push({
        from: { id: debt.id, username: debt.username },
        to: { id: credit.id, username: credit.username },
        amount: Number(amount.toFixed(2))
      });
    }

    // Adjust remaining balances
    credit.balance -= amount;
    debt.balance += amount; // bringing it closer to 0

    // Move indices if settled
    if (credit.balance < 0.01) i++;
    if (debt.balance > -0.01) j++;
  }

  return pairs;
}

const calculateAndSaveSettlements = async (groupId) => {
  const group = await Group.findById(groupId).populate('members', 'username');
  if (!group) return;

  // Fetch expenses with populated references
  const expenses = await Expense.find({ group: groupId })
    .populate('contributions.user', 'username')
    .populate('splits.user', 'username');

  // 1. Compute theoretical balances from expenses
  const balances = computeBalances(expenses, group.members);

  // 2. Account for verified settlements (money actually changed hands)
  // We verify only 'completed' settlements reduce the debt. 
  const completedPayments = await Settlement.find({
    group: groupId,
    status: 'completed'
  });

  completedPayments.forEach(p => {
    const debtorId = p.debtor.toString();
    const creditorId = p.creditor.toString();
    const amountPaid = Number(p.paidAmount || p.amount || 0);
    
    // Debtor paid -> balance increases (less negative)
    if (balances.has(debtorId)) balances.get(debtorId).balance += amountPaid;
    // Creditor received -> balance decreases (less positive/owed)
    if (balances.has(creditorId)) balances.get(creditorId).balance -= amountPaid;
  });
  
  // Round again after payments
  for (const [key, val] of balances) {
    val.balance = Math.round(val.balance * 100) / 100;
  }

  // 3. Compute required future settlements
  const pairs = computeSettlementPairsFromBalances(balances);

  // 4. Transactional Update of Settlements
  // We identify existing pending settlements to update vs create new ones
  const existingPending = await Settlement.find({
    group: groupId,
    status: 'pending',
    expenseId: null // General settlements only
  });
  
  const processedIds = new Set();

  for (const p of pairs) {
    // Look for an existing pending match to update (IDEMPOTENCY)
    const match = existingPending.find(s => 
      s.debtor.toString() === p.from.id && 
      s.creditor.toString() === p.to.id
    );

    if (match) {
      match.amount = p.amount; // Update amount if changed
      await match.save();
      processedIds.add(match._id.toString());
    } else {
      // Create new
      const newSettlement = await Settlement.create({
        group: groupId,
        debtor: p.from.id,
        creditor: p.to.id,
        amount: p.amount,
        status: 'pending',
        expenseId: null
      });
      processedIds.add(newSettlement._id.toString());
    }
  }

  // Cleanup: Delete pending settlements that are no longer needed (e.g., balances changed)
  for (const s of existingPending) {
    if (!processedIds.has(s._id.toString())) {
      await Settlement.findByIdAndDelete(s._id);
    }
  }
};

module.exports = {
  computeBalances,
  computeSettlementPairsFromBalances,
  calculateAndSaveSettlements
};