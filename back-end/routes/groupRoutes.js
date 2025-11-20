// backend/routes/groupRoutes.js
const express = require('express');
const router = express.Router();

const controller = require('../controllers/groupController');
const {
  getGroups,
  createGroup,
  getGroupDetails,
  addMember,
  deleteGroup
} = controller;

const { protect } = require('../middleware/authMiddleware');

// Debugging check to ensure all functions are loaded
if (!getGroups || !createGroup || !getGroupDetails || !addMember || !deleteGroup) {
  console.error("❌ Error: One or more groupController functions are undefined.");
  console.error("Loaded controller keys:", Object.keys(controller));
}

// GET all groups / Create group
router.route('/')
  .get(protect, getGroups)
  .post(protect, createGroup);

// GET group details / DELETE group
router.route('/:id')
  .get(protect, getGroupDetails)
  .delete(protect, deleteGroup);

// Add new members to group
router.route('/:id/members')
  .post(protect, addMember);

module.exports = router;