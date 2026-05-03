import mongoose from "mongoose";
import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";
import ExpenseSplit from "../models/ExpenseSplit.js";
import Settlement from "../models/Settlement.js";
import SharedExpense from "../models/SharedExpense.js";
import User from "../models/User.js";
import { getGroupSummary as getGroupSummaryService } from "../services/groupSummaryService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const normalizeUniqueObjectIds = (values = []) => [
  ...new Set(values.map((value) => String(value))),
];

const validateUsersExist = async (userIds) => {
  const count = await User.countDocuments({ _id: { $in: userIds } });
  return count === userIds.length;
};

const generateJoinCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `MUN-${suffix}`;
};

const generateUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = generateJoinCode();
    const exists = await Group.exists({ joinCode });

    if (!exists) {
      return joinCode;
    }
  }

  throw new Error("Unable to generate group join code");
};

const findAccessibleGroup = (groupId, userId) =>
  Group.findOne({
    _id: groupId,
    members: userId,
  });

const findOwnedGroup = (groupId, userId) =>
  Group.findOne({
    _id: groupId,
    createdBy: userId,
    members: userId,
  });

const upsertActiveMembershipRecord = async ({
  groupId,
  user,
  invitedBy,
  role = "member",
  now = new Date(),
}) =>
  GroupMembership.findOneAndUpdate(
    {
      groupId,
      $or: [{ userId: user._id }, { invitedEmail: normalizeEmail(user.email) }],
    },
    {
      $set: {
        userId: user._id,
        invitedEmail: normalizeEmail(user.email),
        invitedBy,
        role,
        status: "active",
        joinedAt: now,
        respondedAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );

const createOwnerMembershipRecord = async (group, user) => {
  const now = new Date();

  return GroupMembership.create({
    groupId: group._id,
    userId: user._id,
    invitedEmail: normalizeEmail(user.email),
    invitedBy: user._id,
    role: "owner",
    status: "active",
    joinedAt: now,
    respondedAt: now,
  });
};

const extractMemberIds = (body = {}) => {
  if (Array.isArray(body.memberIds)) {
    return body.memberIds;
  }

  if (Array.isArray(body.userIds)) {
    return body.userIds;
  }

  if (body.memberId) {
    return [body.memberId];
  }

  if (body.userId) {
    return [body.userId];
  }

  if (Array.isArray(body.members)) {
    return body.members;
  }

  return [];
};

export const createGroup = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Group name is required" });
  }

  const requestedMemberIds = extractMemberIds(req.body);
  const normalizedMemberIds = normalizeUniqueObjectIds([
    ...requestedMemberIds,
    req.user.id,
  ]);

  if (!normalizedMemberIds.every(isValidObjectId)) {
    return res.status(400).json({ message: "All member IDs must be valid" });
  }

  const usersExist = await validateUsersExist(normalizedMemberIds);

  if (!usersExist) {
    return res.status(400).json({ message: "One or more group members do not exist" });
  }

  const creator = await User.findById(req.user.id).select("_id email");

  if (!creator) {
    return res.status(404).json({ message: "User not found" });
  }

  let group;

  try {
    group = await Group.create({
      name,
      createdBy: req.user.id,
      joinCode: await generateUniqueJoinCode(),
      members: normalizedMemberIds,
    });

    await createOwnerMembershipRecord(group, creator);
  } catch (error) {
    if (group?._id) {
      await Group.findByIdAndDelete(group._id);
    }

    throw error;
  }

  return res.status(201).json(group);
});

export const getGroups = asyncHandler(async (req, res) => {
  const groups = await Group.find({ members: req.user.id }).sort({ updatedAt: -1 });
  return res.status(200).json(groups);
});

export const getGroupById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await findAccessibleGroup(req.params.id, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  return res.status(200).json(group);
});

export const getGroupSummary = asyncHandler(async (req, res) => {
  try {
    const summary = await getGroupSummaryService(req.params.groupId, req.user.id);
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Server Error",
    });
  }
});

export const updateGroup = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.groupId)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const name = String(req.body?.name || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Group name is required" });
  }

  const group = await findOwnedGroup(req.params.groupId, req.user.id);

  if (!group) {
    const exists = await Group.exists({ _id: req.params.groupId });
    return res
      .status(exists ? 403 : 404)
      .json({ message: exists ? "Only the group owner can update this group" : "Group not found" });
  }

  group.name = name;
  await group.save();

  return res.status(200).json(group);
});

export const deleteGroup = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.groupId)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await findOwnedGroup(req.params.groupId, req.user.id);

  if (!group) {
    const exists = await Group.exists({ _id: req.params.groupId });
    return res
      .status(exists ? 403 : 404)
      .json({ message: exists ? "Only the group owner can delete this group" : "Group not found" });
  }

  const sharedExpenses = await SharedExpense.find({ group: group._id })
    .select("_id")
    .lean();
  const sharedExpenseIds = sharedExpenses.map((expense) => expense._id);

  await Promise.all([
    ExpenseSplit.deleteMany({ expense: { $in: sharedExpenseIds } }),
    SharedExpense.deleteMany({ group: group._id }),
    Settlement.deleteMany({ group: group._id }),
    GroupMembership.deleteMany({ groupId: group._id }),
    Group.deleteOne({ _id: group._id }),
  ]);

  return res.status(200).json({ message: "Group deleted" });
});

export const addGroupMembers = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await findAccessibleGroup(req.params.id, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (String(group.createdBy) !== String(req.user.id)) {
    return res.status(403).json({ message: "Only the group owner can add members" });
  }

  const requestedMemberIds = normalizeUniqueObjectIds(extractMemberIds(req.body));

  if (requestedMemberIds.length === 0) {
    return res.status(400).json({ message: "At least one member ID is required" });
  }

  if (!requestedMemberIds.every(isValidObjectId)) {
    return res.status(400).json({ message: "All member IDs must be valid" });
  }

  const usersExist = await validateUsersExist(requestedMemberIds);

  if (!usersExist) {
    return res.status(400).json({ message: "One or more group members do not exist" });
  }

  group.members = normalizeUniqueObjectIds([...group.members, ...requestedMemberIds]);
  await group.save();

  const addedUsers = await User.find({ _id: { $in: requestedMemberIds } })
    .select("_id email")
    .lean();
  const now = new Date();

  await Promise.all(
    addedUsers.map((user) =>
      upsertActiveMembershipRecord({
        groupId: group._id,
        user,
        invitedBy: req.user.id,
        role: String(user._id) === String(group.createdBy) ? "owner" : "member",
        now,
      }).catch(async (error) => {
        if (error?.code === 11000) {
          return upsertActiveMembershipRecord({
            groupId: group._id,
            user,
            invitedBy: req.user.id,
            role: String(user._id) === String(group.createdBy) ? "owner" : "member",
            now,
          });
        }

        throw error;
      })
    )
  );

  return res.status(200).json(group);
});

export const createGroupInvite = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (String(group.createdBy) !== String(req.user.id)) {
    return res.status(403).json({ message: "Only the group owner can create invites" });
  }

  const rawUserId = String(req.body?.userId || "").trim();
  const rawEmail = String(req.body?.email || "").trim();

  if (!rawUserId && !rawEmail) {
    return res.status(400).json({ message: "Provide userId or email" });
  }

  let invitedUser = null;
  let invitedEmail = normalizeEmail(rawEmail);

  if (rawUserId) {
    if (!isValidObjectId(rawUserId)) {
      return res.status(400).json({ message: "Invalid invited user ID" });
    }

    invitedUser = await User.findById(rawUserId).select("_id email");

    if (!invitedUser) {
      return res.status(404).json({ message: "Invited user not found" });
    }

    invitedEmail = normalizeEmail(invitedUser.email);
  } else {
    if (!isValidEmail(invitedEmail)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    invitedUser = await User.findOne({ email: invitedEmail }).select("_id email");
  }

  if (
    (invitedUser && String(invitedUser._id) === String(req.user.id)) ||
    invitedEmail === normalizeEmail(req.user.email)
  ) {
    return res.status(400).json({ message: "You cannot invite yourself" });
  }

  if (
    invitedUser &&
    group.members.some((memberId) => String(memberId) === String(invitedUser._id))
  ) {
    return res.status(409).json({ message: "User is already an active member" });
  }

  const duplicateInvite = await GroupMembership.findOne({
    groupId: group._id,
    status: "pending",
    $or: [
      { invitedEmail },
      ...(invitedUser?._id ? [{ userId: invitedUser._id }] : []),
    ],
  }).lean();

  if (duplicateInvite) {
    return res.status(409).json({ message: "A pending invite already exists for this user" });
  }

  const activeMembership = await GroupMembership.findOne({
    groupId: group._id,
    status: "active",
    $or: [
      { invitedEmail },
      ...(invitedUser?._id ? [{ userId: invitedUser._id }] : []),
    ],
  }).lean();

  if (activeMembership) {
    return res.status(409).json({ message: "User is already an active member" });
  }

  const invite = await GroupMembership.create({
    groupId: group._id,
    userId: invitedUser?._id || null,
    invitedEmail,
    invitedBy: req.user.id,
    role: "member",
    status: "pending",
  });

  return res.status(201).json(invite);
});

export const getGroupInvites = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (String(group.createdBy) !== String(req.user.id)) {
    return res.status(403).json({ message: "Only the group owner can view invites" });
  }

  const invites = await GroupMembership.find({
    groupId: group._id,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .populate("userId", "_id name email username")
    .populate("invitedBy", "_id name email username");

  return res.status(200).json(invites);
});

export const getMyPendingGroupInvites = asyncHandler(async (req, res) => {
  const invites = await GroupMembership.find({
    status: "pending",
    $or: [{ userId: req.user.id }, { invitedEmail: normalizeEmail(req.user.email) }],
  })
    .sort({ createdAt: -1 })
    .populate("groupId", "_id name")
    .populate("invitedBy", "_id name email username");

  return res.status(200).json(invites);
});

export const acceptGroupInvite = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.invitationId)) {
    return res.status(400).json({ message: "Invalid invitation ID" });
  }

  const invite = await GroupMembership.findOne({
    _id: req.params.invitationId,
    status: "pending",
    $or: [{ userId: req.user.id }, { invitedEmail: normalizeEmail(req.user.email) }],
  });

  if (!invite) {
    return res.status(404).json({ message: "Invitation not found" });
  }

  const group = await Group.findById(invite.groupId);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (group.members.some((memberId) => String(memberId) === String(req.user.id))) {
    invite.userId = req.user.id;
    invite.status = "active";
    invite.joinedAt = invite.joinedAt || new Date();
    invite.respondedAt = new Date();
    await invite.save();

    return res.status(200).json(invite);
  }

  invite.userId = req.user.id;
  invite.invitedEmail = normalizeEmail(req.user.email);
  invite.status = "active";
  invite.joinedAt = new Date();
  invite.respondedAt = new Date();
  await invite.save();

  group.members = normalizeUniqueObjectIds([...group.members, req.user.id]);
  await group.save();

  return res.status(200).json(invite);
});

export const declineGroupInvite = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.invitationId)) {
    return res.status(400).json({ message: "Invalid invitation ID" });
  }

  const invite = await GroupMembership.findOne({
    _id: req.params.invitationId,
    status: "pending",
    $or: [{ userId: req.user.id }, { invitedEmail: normalizeEmail(req.user.email) }],
  });

  if (!invite) {
    return res.status(404).json({ message: "Invitation not found" });
  }

  if (!invite.userId && invite.invitedEmail === normalizeEmail(req.user.email)) {
    invite.userId = req.user.id;
  }

  invite.invitedEmail = normalizeEmail(req.user.email);
  invite.status = "declined";
  invite.respondedAt = new Date();
  await invite.save();

  return res.status(200).json(invite);
});
