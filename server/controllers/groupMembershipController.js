import mongoose from "mongoose";
import isEmail from "validator/lib/isEmail.js";
import {
  acceptMembershipInvitation,
  createEmailInvitation,
  declineMembershipInvitation,
  getGroupedMemberships,
  getUserInvitations,
  isActiveGroupMember,
  isGroupOwner,
} from "../services/groupMembershipService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const respondWithError = (res, error) =>
  res.status(error.statusCode || 500).json({ message: error.message || "Server Error" });

export const inviteGroupMemberByEmail = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const invitedEmail = normalizeEmail(req.body?.email);

  if (!isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  if (!invitedEmail) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!isEmail(invitedEmail)) {
    return res.status(400).json({ message: "A valid email is required" });
  }

  const isOwner = await isGroupOwner(groupId, req.user.id);

  if (!isOwner) {
    return res.status(403).json({ message: "Only the group owner can invite members" });
  }

  try {
    const invitation = await createEmailInvitation(groupId, invitedEmail, req.user.id);
    return res.status(201).json(invitation);
  } catch (error) {
    return respondWithError(res, error);
  }
});

export const listCurrentUserInvitations = asyncHandler(async (req, res) => {
  const invitations = await getUserInvitations(req.user);
  return res.status(200).json(invitations);
});

export const acceptGroupInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;

  if (!isValidObjectId(invitationId)) {
    return res.status(400).json({ message: "Invalid invitation ID" });
  }

  try {
    const invitation = await acceptMembershipInvitation(invitationId, req.user);
    return res.status(200).json(invitation);
  } catch (error) {
    return respondWithError(res, error);
  }
});

export const declineGroupInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;

  if (!isValidObjectId(invitationId)) {
    return res.status(400).json({ message: "Invalid invitation ID" });
  }

  try {
    const invitation = await declineMembershipInvitation(invitationId, req.user);
    return res.status(200).json(invitation);
  } catch (error) {
    return respondWithError(res, error);
  }
});

export const listGroupMemberships = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  if (!isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const isMember = await isActiveGroupMember(groupId, req.user.id);

  if (!isMember) {
    return res.status(403).json({ message: "Only active group members can view memberships" });
  }

  try {
    const memberships = await getGroupedMemberships(groupId);
    return res.status(200).json(memberships);
  } catch (error) {
    return respondWithError(res, error);
  }
});
