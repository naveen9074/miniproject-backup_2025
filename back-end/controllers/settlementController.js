// backend/controllers/settlementController.js
const asyncHandler = require('express-async-handler');
const { Settlement, User } = require('../models/schema');

// @desc    Get details for a single settlement (for verification screen)
// @route   GET /api/settlements/:id
// @access  Private
const getSettlementDetails = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id)
    .populate('debtor', 'username')
    .populate('creditor', 'username');

  if (!settlement) {
    res.status(404);
    throw new Error('Settlement not found');
  }

  // Only the creditor or debtor can view this
  if (settlement.creditor._id.toString() !== req.user._id.toString() && 
      settlement.debtor._id.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to view this settlement');
  }

  res.json({ settlement });
});

// @desc    Submit payment proof for a settlement
// @route   PATCH /api/settlements/:id/pay
// @access  Private (as Debtor)
const submitPaymentProof = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id);

  if (!settlement) {
    res.status(404);
    throw new Error('Settlement not found');
  }
  if (settlement.debtor.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Only the debtor can submit payment');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('Payment proof image is required');
  }

  settlement.status = 'paid_pending_verification';
  settlement.amount_paid = req.body.amount_paid || settlement.amount;
  settlement.payment_proof_url = `/${req.file.path.replace(/\\/g, '/')}`; // Store the URL
  settlement.paid_at = Date.now();

  const updatedSettlement = await settlement.save();
  res.json(updatedSettlement);
});

// @desc    Verify or reject a payment proof
// @route   PATCH /api/settlements/:id/verify
// @access  Private (as Creditor)
const verifyPayment = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'verified' or 'rejected'
  if (!['verified', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }

  const settlement = await Settlement.findById(req.params.id);

  if (!settlement) {
    res.status(404);
    throw new Error('Settlement not found');
  }
  if (settlement.creditor.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Only the creditor can verify this payment');
  }

  settlement.status = status;
  const updatedSettlement = await settlement.save();
  res.json(updatedSettlement);
});

// @desc    Get UPI ID for a user
// @route   GET /api/users/upi/:userId
// @access  Private
const getUserUpiId = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    if (!user.upiId) {
        res.status(400);
        throw new Error('User has not set their UPI ID');
    }
    res.json({ upiId: user.upiId });
});

module.exports = {
  getSettlementDetails,
  submitPaymentProof,
  verifyPayment,
  getUserUpiId // Export the new UPI function
};