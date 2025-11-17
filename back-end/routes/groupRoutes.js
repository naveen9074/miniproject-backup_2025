// backend/routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const {
  getGroups,
  createGroup,
  getGroupDetails,
  addMember,
  deleteGroup // <-- IMPORT
} = require('../controllers/groupController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getGroups)
  .post(protect, createGroup);
  
router.route('/:id')
  .get(protect, getGroupDetails)
  .delete(protect, deleteGroup); // <-- ADD THIS LINE

router.route('/:id/members').post(protect, addMember);

module.exports = router;