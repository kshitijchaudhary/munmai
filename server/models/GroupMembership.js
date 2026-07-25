import mongoose from "mongoose";
import isEmail from "validator/lib/isEmail.js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const groupMembershipSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    invitedEmail: {
      type: String,
      required: [true, "Invited email is required"],
      lowercase: true,
      trim: true,
      maxLength: [254, "Invited email cannot exceed 254 characters"],
      set: normalizeEmail,
      validate: {
        validator: (value) => isEmail(normalizeEmail(value)),
        message: "A valid invited email is required",
      },
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
    },
    source: {
      type: String,
      enum: ["invite", "join_request"],
      default: "invite",
    },
    status: {
      type: String,
      enum: ["pending", "active", "declined"],
      default: "pending",
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

groupMembershipSchema.index({ groupId: 1, invitedEmail: 1, status: 1 });
groupMembershipSchema.index({ groupId: 1, userId: 1, status: 1 });
groupMembershipSchema.index({ userId: 1, status: 1, groupId: 1 });
groupMembershipSchema.index(
  { groupId: 1, invitedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "active"] },
    },
  }
);
groupMembershipSchema.index(
  { groupId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: { $exists: true, $type: "objectId" },
      status: { $in: ["pending", "active"] },
    },
  }
);

const GroupMembership = mongoose.model("GroupMembership", groupMembershipSchema);

export default GroupMembership;
