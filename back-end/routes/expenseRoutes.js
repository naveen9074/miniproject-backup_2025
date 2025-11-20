// backend/routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const { protect } = require("../middleware/authMiddleware");

const {
  addExpense,
  getExpenseDetails,
  updateExpense,
  deleteExpense
} = require("../controllers/expenseController");

// Debug check
if (!addExpense || !getExpenseDetails || !updateExpense || !deleteExpense) {
  console.error("❌ Error: Missing expense controller functions");
}

router.route("/")
  .post(protect, upload.single("billImage"), addExpense);

router.route("/:id")
  .get(protect, getExpenseDetails)
  .put(protect, updateExpense)
  .delete(protect, deleteExpense);

module.exports = router;