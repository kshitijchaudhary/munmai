import User from "../models/User.js";

const usernamePattern = /^[a-z0-9_]{3,20}$/;

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

const isValidUsername = (value) => usernamePattern.test(value);

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username || "",
});

export const updateUserProfile = async (req, res) => {
  try {
    const nextName = String(req.body?.name || "").trim();
    const rawUsername = req.body?.username;

    if (!nextName) {
      return res.status(400).json({ message: "Name is required" });
    }

    const updatePayload = {
      name: nextName,
    };

    if (rawUsername !== undefined) {
      const normalizedUsername = normalizeUsername(rawUsername);

      if (!normalizedUsername) {
        return res.status(400).json({ message: "Username is required" });
      }

      if (!isValidUsername(normalizedUsername)) {
        return res.status(400).json({
          message:
            "Username must be 3-20 characters and use only lowercase letters, numbers, and underscores",
        });
      }

      const existingUsernameUser = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: req.user.id },
      }).lean();

      if (existingUsernameUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      updatePayload.username = normalizedUsername;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updatePayload, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(buildUserResponse(updatedUser));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
