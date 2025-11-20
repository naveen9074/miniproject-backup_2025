// backend/controllers/settlementController.js
const asyncHandler = require('express-async-handler');
const fs = require('fs');
const crypto = require('crypto'); // Built-in Node module
const { Settlement, Notification, User } = require('../models/schema');
const { calculateAndSaveSettlements } = require('../utils/calculateSettlement');

// Helper to calculate file hash
const getFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

// ... (keep getSettlementDetails) ...
const getSettlementDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const settlement = await Settlement.findById(id)
    .populate('debtor', 'username')
    .populate('creditor', 'username')
    .populate('group', 'name');
  if (!settlement) { res.status(404); throw new Error('Settlement not found'); }
  res.json(settlement);
});

// -------------------------------------------
// SUBMIT PAYMENT PROOF (With Integrity Check & Notification)
// -------------------------------------------
const submitPaymentProof = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  
  const settlement = await Settlement.findById(id);
  if (!settlement) { res.status(404); throw new Error('Settlement not found'); }

  if (settlement.debtor.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Only the debtor can submit proof');
  }

  let paymentProofUrl = '';
  let fileHash = '';

  if (req.file) {
    paymentProofUrl = `/${req.file.path.replace(/\\/g, '/')}`;
    // Calculate hash for authenticity
    try {
      fileHash = await getFileHash(req.file.path);
    } catch (error) {
      console.error("Hash error:", error);
    }
  }

  settlement.status = 'paid_pending_verification';
  settlement.paymentProof = paymentProofUrl;
  settlement.proofHash = fileHash; // Store hash
  settlement.paidAt = new Date();
  settlement.paidAmount = parseFloat(amount);

  await settlement.save();

  // NOTIFY CREDITOR
  await Notification.create({
    user: settlement.creditor,
    type: 'payment',
    message: `${req.user.username} marked a debt of ₹${amount} as paid. Please verify.`,
    relatedId: settlement._id
  });

  res.status(200).json({ message: 'Proof submitted', settlement });
});

// -------------------------------------------
// VERIFY PAYMENT (With Notification)
// -------------------------------------------
const verifyPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'accept' or 'reject'

  const settlement = await Settlement.findById(id);
  if (!settlement) { res.status(404); throw new Error('Settlement not found'); }

  if (settlement.creditor.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Only the creditor can verify');
  }

  if (action === 'accept') {
    settlement.status = 'completed';
    settlement.verifiedAt = new Date();
    await settlement.save();

    // Recalculate group balances
    if (settlement.group) {
      await calculateAndSaveSettlements(settlement.group);
    }

    // NOTIFY DEBTOR
    await Notification.create({
      user: settlement.debtor,
      type: 'info',
      message: `Payment of ₹${settlement.paidAmount} accepted by ${req.user.username}.`,
      relatedId: settlement._id
    });

    res.json({ message: 'Payment verified', settlement });

  } else if (action === 'reject') {
    settlement.status = 'rejected'; // Explicit rejected status
    await settlement.save();

    // NOTIFY DEBTOR
    await Notification.create({
      user: settlement.debtor,
      type: 'reminder',
      message: `Payment of ₹${settlement.paidAmount} REJECTED by ${req.user.username}. Please check details.`,
      relatedId: settlement._id
    });

    res.json({ message: 'Payment rejected', settlement });
  } else {
    res.status(400); throw new Error('Invalid action');
  }
});

module.exports = { getSettlementDetails, submitPaymentProof, verifyPayment };