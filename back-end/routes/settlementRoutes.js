// backend/routes/settlementRoutes.js
const express = require('express');
const router = express.Router();
const {
  getSettlementDetails,
  submitPaymentProof,
  verifyPayment,
} = require('../controllers/settlementController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware'); // For image uploads

// Get details for a single settlement (for verify screen)
router.route('/:id').get(protect, getSettlementDetails);

// Submit payment proof (debtor)
router.route('/:id/pay')
  .patch(protect, upload.single('paymentProof'), submitPaymentProof);

// Verify or reject payment (creditor)
router.route('/:id/verify').patch(protect, verifyPayment);

module.exports = router;