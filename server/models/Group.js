import mongoose from "mongoose";

const hasUniqueIds = (values = []) => {
  const normalizedValues = values.map((value) => String(value));
  return normalizedValues.length === new Set(normalizedValues).size;
};

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      maxLength: [100, "Group name cannot exceed 100 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      required: true,
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: "At least one group member is required",
        },
        {
          validator: hasUniqueIds,
          message: "Group members must be unique",
        },
      ],
    },
  },
  { timestamps: true }
);

groupSchema.index({ members: 1, updatedAt: -1 });
groupSchema.index({ createdBy: 1, createdAt: -1 });

const Group = mongoose.model("Group", groupSchema);

export default Group;
