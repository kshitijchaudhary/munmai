import isEmail from "validator/lib/isEmail.js";
import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";
import User from "../models/User.js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const OPEN_INVITATION_STATUSES = ["pending"];
const OPEN_OR_ACTIVE_STATUSES = [...OPEN_INVITATION_STATUSES, "active"];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toIdString = (value) => String(value || "");

const buildIdentityClauses = (userId, email) => {
  const clauses = [];
  const normalizedEmail = normalizeEmail(email);

  if (userId) {
    clauses.push({ userId });
  }

  if (normalizedEmail) {
    clauses.push({ invitedEmail: normalizedEmail });
  }

  return clauses;
};

const buildIdentityMatch = (userId, email) => {
  const clauses = buildIdentityClauses(userId, email);

  if (clauses.length === 0) {
    return null;
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return { $or: clauses };
};

const closeMatchingMemberships = async ({
  groupId,
  userId,
  email,
  excludeId = null,
  statuses = OPEN_INVITATION_STATUSES,
  nextStatus,
  respondedAt = new Date(),
}) => {
  const identityMatch = buildIdentityMatch(userId, email);

  if (!identityMatch) {
    return;
  }

  const update = {
    status: nextStatus,
    respondedAt,
  };

  if (userId) {
    update.userId = userId;
  }

  if (email) {
    update.invitedEmail = normalizeEmail(email);
  }

  const query = {
    groupId,
    status: { $in: statuses },
    ...identityMatch,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  await GroupMembership.updateMany(query, { $set: update });
};

const resolveDuplicateCreateError = async (groupId, userId, email) => {
  const identityMatch = buildIdentityMatch(userId, email);

  if (!identityMatch) {
    return createError("An invitation is already pending for this email", 409);
  }

  const duplicateMembership = await GroupMembership.findOne({
    groupId,
    status: { $in: OPEN_OR_ACTIVE_STATUSES },
    ...identityMatch,
  }).lean();

  if (!duplicateMembership) {
    return createError("An invitation is already pending for this email", 409);
  }

  return createError(
    duplicateMembership.status === "active"
      ? "User is already a group member"
      : "An invitation is already pending for this email",
    409
  );
};

const buildMembershipOwnershipMatch = (groupId, userId) => ({
  groupId,
  userId,
  role: "owner",
  status: "active",
});

const buildMembershipActiveMatch = (groupId, userId) => ({
  groupId,
  userId,
  status: "active",
});

export const getActiveMemberIds = async (groupId) => {
  const activeMemberships = await GroupMembership.find({
    groupId,
    status: "active",
    userId: { $ne: null },
  })
    .select("userId")
    .lean();

  return new Set(
    activeMemberships
      .map((membership) => membership.userId)
      .filter(Boolean)
      .map((userId) => toIdString(userId))
  );
};

export const createOwnerMembership = async (group, user) => {
  const now = new Date();

  return upsertActiveMembership({
    groupId: group._id,
    user,
    invitedBy: user._id,
    role: "owner",
    now,
  });
};

export const isActiveGroupMember = async (groupId, userId) => {
  const activeMembership = await GroupMembership.exists(
    buildMembershipActiveMatch(groupId, userId)
  );

  if (activeMembership) {
    return true;
  }

  const legacyGroup = await Group.exists({
    _id: groupId,
    members: userId,
  });

  return Boolean(legacyGroup);
};

export const isGroupOwner = async (groupId, userId) => {
  const ownerMembership = await GroupMembership.exists(
    buildMembershipOwnershipMatch(groupId, userId)
  );

  if (ownerMembership) {
    return true;
  }

  const legacyGroup = await Group.exists({
    _id: groupId,
    createdBy: userId,
    members: userId,
  });

  return Boolean(legacyGroup);
};

export const upsertActiveMembership = async ({
  groupId,
  user,
  invitedBy,
  role = "member",
  now = new Date(),
  preferredMembershipId = null,
}) => {
  const userId = user?._id || user?.id || user;
  const invitedEmail = normalizeEmail(user?.email);
  const identityMatch = buildIdentityMatch(userId, invitedEmail);

  if (!identityMatch || !invitedEmail) {
    throw createError("A valid user and email are required to activate membership", 400);
  }

  let membership = null;
  let preferredMembership = null;

  if (preferredMembershipId) {
    preferredMembership = await GroupMembership.findOne({
      _id: preferredMembershipId,
      groupId,
    });
  }

  membership = await GroupMembership.findOne({
    groupId,
    status: "active",
    ...identityMatch,
  }).sort({ createdAt: 1 });

  if (!membership) {
    membership =
      preferredMembership ||
      (await GroupMembership.findOne({
        groupId,
        status: { $in: OPEN_INVITATION_STATUSES },
        ...identityMatch,
      }).sort({ createdAt: 1 }));
  }

  if (!membership) {
    membership = new GroupMembership({ groupId });
  }

  membership.userId = userId;
  membership.invitedEmail = invitedEmail;
  membership.invitedBy = invitedBy || membership.invitedBy || userId;
  membership.role = role;
  membership.status = "active";
  membership.joinedAt = membership.joinedAt || now;
  membership.respondedAt = now;
  await membership.save();

  await closeMatchingMemberships({
    groupId,
    userId,
    email: invitedEmail,
    excludeId: membership._id,
    statuses: OPEN_INVITATION_STATUSES,
    nextStatus: "declined",
    respondedAt: now,
  });

  return membership;
};

export const createEmailInvitation = async (groupId, invitedEmail, invitedBy) => {
  const normalizedEmail = normalizeEmail(invitedEmail);

  if (!isEmail(normalizedEmail)) {
    throw createError("A valid email is required", 400);
  }

  const [group, inviter, linkedUser] = await Promise.all([
    Group.findById(groupId).select("_id members createdBy"),
    User.findById(invitedBy).select("_id email"),
    User.findOne({ email: normalizedEmail }).select("_id email"),
  ]);

  if (!group) {
    throw createError("Group not found", 404);
  }

  if (!inviter) {
    throw createError("Inviting user not found", 404);
  }

  if (!linkedUser) {
    throw createError("User not found", 404);
  }

  if (normalizeEmail(inviter.email) === normalizedEmail) {
    throw createError("You cannot invite yourself", 400);
  }

  if (
    linkedUser &&
    (group.members || []).some(
      (memberId) => toIdString(memberId) === toIdString(linkedUser._id)
    )
  ) {
    throw createError("User is already a group member", 400);
  }

  const identityMatch = buildIdentityMatch(linkedUser?._id, normalizedEmail);
  const duplicateMembership = await GroupMembership.findOne({
    groupId,
    status: { $in: OPEN_OR_ACTIVE_STATUSES },
    ...identityMatch,
  }).lean();

  if (duplicateMembership) {
    throw createError(
      duplicateMembership.status === "active"
        ? "User is already a group member"
        : "An invitation is already pending for this email",
      409
    );
  }

  try {
    return await GroupMembership.create({
      groupId,
      userId: linkedUser._id,
      invitedEmail: normalizedEmail,
      invitedBy,
      role: "member",
      status: "pending",
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw await resolveDuplicateCreateError(groupId, linkedUser?._id, normalizedEmail);
    }

    throw error;
  }
};

export const getUserInvitations = async (user) => {
  const normalizedEmail = normalizeEmail(user.email);

  return GroupMembership.find({
    status: { $in: OPEN_INVITATION_STATUSES },
    $or: [{ userId: user._id }, { invitedEmail: normalizedEmail }],
  })
    .populate("groupId", "_id name")
    .populate("invitedBy", "_id name email username")
    .sort({ createdAt: -1 });
};

const findInvitationForUser = async (invitationId, user) => {
  const normalizedEmail = normalizeEmail(user.email);

  return GroupMembership.findOne({
    _id: invitationId,
    status: { $in: OPEN_INVITATION_STATUSES },
    $or: [{ userId: user._id }, { invitedEmail: normalizedEmail }],
  });
};

export const acceptMembershipInvitation = async (invitationId, user) => {
  const invitation = await findInvitationForUser(invitationId, user);

  if (!invitation) {
    throw createError("Invitation not found", 404);
  }

  const group = await Group.findById(invitation.groupId).select("_id");

  if (!group) {
    throw createError("Group not found", 404);
  }

  const now = new Date();

  await Group.findByIdAndUpdate(invitation.groupId, {
    $addToSet: { members: user._id },
  });

  return upsertActiveMembership({
    groupId: invitation.groupId,
    user,
    invitedBy: invitation.invitedBy || user._id,
    role: invitation.role || "member",
    now,
    preferredMembershipId: invitation._id,
  });
};

export const declineMembershipInvitation = async (invitationId, user) => {
  const invitation = await findInvitationForUser(invitationId, user);

  if (!invitation) {
    throw createError("Invitation not found", 404);
  }

  const normalizedEmail = normalizeEmail(user.email);

  invitation.status = "declined";
  invitation.respondedAt = new Date();
  invitation.invitedEmail = normalizedEmail;
  invitation.userId = user._id;

  await invitation.save();
  await closeMatchingMemberships({
    groupId: invitation.groupId,
    userId: user._id,
    email: normalizedEmail,
    excludeId: invitation._id,
    statuses: OPEN_INVITATION_STATUSES,
    nextStatus: "declined",
    respondedAt: invitation.respondedAt,
  });

  return invitation;
};

export const getGroupedMemberships = async (groupId) => {
  const [group, memberships] = await Promise.all([
    Group.findById(groupId).select("_id createdBy members").lean(),
    GroupMembership.find({
      groupId,
      status: { $in: OPEN_OR_ACTIVE_STATUSES },
    })
      .populate("userId", "_id name email username")
      .populate("invitedBy", "_id name email username")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!group) {
    throw createError("Group not found", 404);
  }

  const activeMembers = memberships.filter((membership) => membership.status === "active");
  const pendingInvites = memberships.filter((membership) =>
    OPEN_INVITATION_STATUSES.includes(membership.status)
  );
  const activeUserIds = new Set(
    activeMembers
      .map((membership) => membership.userId?._id || membership.userId)
      .filter(Boolean)
      .map((value) => toIdString(value))
  );
  const pendingUserIds = new Set(
    pendingInvites
      .map((membership) => membership.userId?._id || membership.userId)
      .filter(Boolean)
      .map((value) => toIdString(value))
  );

  const legacyOnlyMemberIds = (group.members || []).filter(
    (memberId) => {
      const memberIdString = toIdString(memberId);
      return !activeUserIds.has(memberIdString) && !pendingUserIds.has(memberIdString);
    }
  );

  let legacyUsers = [];

  if (legacyOnlyMemberIds.length > 0) {
    legacyUsers = await User.find({ _id: { $in: legacyOnlyMemberIds } })
      .select("_id name email username")
      .lean();
  }

  const legacyActiveMembers = legacyUsers.map((user) => ({
    _id: `legacy-${user._id}`,
    groupId,
    userId: user,
    invitedEmail: normalizeEmail(user.email),
    invitedBy: group.createdBy,
    role: toIdString(user._id) === toIdString(group.createdBy) ? "owner" : "member",
    status: "active",
    joinedAt: null,
    respondedAt: null,
    createdAt: null,
    updatedAt: null,
    isLegacyMember: true,
  }));

  return {
    groupId: toIdString(groupId),
    activeMembers: [...activeMembers, ...legacyActiveMembers],
    pendingInvites,
  };
};

export default {
  createOwnerMembership,
  getActiveMemberIds,
  isActiveGroupMember,
  isGroupOwner,
  createEmailInvitation,
  getUserInvitations,
  acceptMembershipInvitation,
  declineMembershipInvitation,
  getGroupedMemberships,
};
