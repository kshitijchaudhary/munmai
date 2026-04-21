import mongoose from "mongoose";
import Group from "../models/Group.js";
import User from "../models/User.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeUniqueObjectIds = (values = []) => [
  ...new Set(values.map((value) => String(value))),
];

const validateUsersExist = async (userIds) => {
  const count = await User.countDocuments({ _id: { $in: userIds } });
  return count === userIds.length;
};

const findAccessibleGroup = (groupId, userId) =>
  Group.findOne({
    _id: groupId,
    members: userId,
  });

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

  const group = await Group.create({
    name,
    createdBy: req.user.id,
    members: normalizedMemberIds,
  });

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

  return res.status(200).json(group);
});
