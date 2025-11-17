// backend/routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const { addExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware'); // Make sure this is here

router.route('/')
  .post(protect, upload.single('billImage'), addExpense); // Make sure this is here

module.exports = router;