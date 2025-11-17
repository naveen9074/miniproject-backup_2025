// backend/controllers/groupController.js
const asyncHandler = require('express-async-handler');
const { Group, User, Expense, Settlement } = require('../models/schema');
const { calculateAndSaveSettlements } = require('../utils/calculateSettlement');

// Helper function to clean phone numbers
const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/\D/g, ''); 
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
};

// ... (getGroups function is the same) ...
const getGroups = asyncHandler(async (req, res) => {
  const groups = await Group.find({ members: req.user._id });
  res.json(groups);
});

// --- UPDATED createGroup FUNCTION ---
// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
const createGroup = asyncHandler(async (req, res) => {
  const { name, phoneNumbers, dueDate } = req.body;
  
  if (!name) {
    res.status(400);
    throw new Error('Please provide a group name');
  }

  const memberIds = [req.user._id]; // Start with the creator
  const unresolvedPhoneNumbers = [];

  // Find users for all the provided phone numbers
  if (phoneNumbers && phoneNumbers.length > 0) {
    for (const phone of phoneNumbers) {
      const normalizedPhone = normalizePhone(phone);
      const user = await User.findOne({ phoneNo: normalizedPhone });

      if (user) {
        // Add user if found and not already in list
        if (!memberIds.some(id => id.equals(user._id))) {
          memberIds.push(user._id);
        }
      } else {
        unresolvedPhoneNumbers.push(phone);
      }
    }
  }

  // Create the group
  const group = new Group({
    name,
    createdBy: req.user._id,
    members: memberIds,
    dueDate: dueDate || null, // Add the dueDate (or null if not provided)
  });
  const createdGroup = await group.save();

  // Add this group to each member's 'groups' array
  await User.updateMany(
    { _id: { $in: memberIds } },
    { $push: { groups: createdGroup._id } }
  );

  let message = 'Group created successfully';
  if (unresolvedPhoneNumbers.length > 0) {
    message = `Group created, but these numbers couldn't be added (user not found): ${unresolvedPhoneNumbers.join(', ')}`;
  }

  res.status(201).json({ message, group: createdGroup });
});
// --- END OF UPDATE ---


// ... (getGroupDetails function is the same) ...
const getGroupDetails = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id)
    .populate('members', 'username')
    .populate('createdBy', 'username'); 
  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }
  if (!group.members.some(m => m._id.equals(req.user._id))) {
    res.status(401);
    throw new Error('Not authorized to view this group');
  }
  const expenses = await Expense.find({ group: req.params.id }).populate('paidBy', 'username');
  const settlements = await Settlement.find({ group: req.params.id })
    .populate('debtor', 'username')
    .populate('creditor', 'username');

  const settlementsWithFlags = settlements.map(s => {
    const settlementJSON = s.toObject(); 
    settlementJSON.isCurrentUserDebtor = s.debtor._id.equals(req.user._id);
    settlementJSON.isCurrentUserCreditor = s.creditor._id.equals(req.user._id);
    return settlementJSON;
  });
  
  res.json({ 
    group, 
    expenses, 
    settlements: settlementsWithFlags 
  });
});

// ... (addMember function is the same) ...
const addMember = asyncHandler(async (req, res) => {
  const { id } = req.params; 
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    res.status(400);
    throw new Error('Phone number is required');
  }
  const normalizedPhone = normalizePhone(phoneNumber);
  const userToAdd = await User.findOne({ phoneNo: normalizedPhone }); 
  if (!userToAdd) {
    res.status(404);
    throw new Error('User not found with this phone number. Please ask them to register.');
  }
  const group = await Group.findById(id); 
  if (group) {
    if (group.members.includes(userToAdd._id)) {
      res.status(400);
      throw new Error('User is already in this group');
    }
    group.members.push(userToAdd._id);
    await group.save();
    userToAdd.groups.push(group._id);
    await userToAdd.save();
    res.status(200).json({ message: 'Member added successfully' });
  } else {
    res.status(404);
    throw new Error('Group not found');
  }
});

// ... (deleteGroup function is the same) ...
const deleteGroup = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }
  if (group.createdBy.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized. Only the group creator can delete it.');
  }
  await Expense.deleteMany({ group: req.params.id });
  await Settlement.deleteMany({ group: req.params.id });
  await User.updateMany(
    { _id: { $in: group.members } },
    { $pull: { groups: group._id } }
  );
  await group.deleteOne();
  res.json({ message: 'Group and all associated data deleted' });
});


module.exports = {
  getGroups,
  createGroup,
  getGroupDetails,
  addMember,
  deleteGroup
};