import User from "../models/User.js";

const usernamePattern = /^[a-z0-9_]+$/;

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

const isValidUsername = (value) => usernamePattern.test(value);

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username || "",
});

const validateProfileInput = async ({ name, username, currentUserId }) => {
  const nextName = String(name || "").trim();
  const normalizedUsername = normalizeUsername(username);

  if (!nextName) {
    return { error: "Name is required" };
  }

  if (!normalizedUsername) {
    return { error: "Username is required" };
  }

  if (!isValidUsername(normalizedUsername)) {
    return {
      error: "Username must use only letters, numbers, and underscores",
    };
  }

  if (normalizedUsername.length < 3) {
    return { error: "Username must be at least 3 characters" };
  }

  const existingUsernameUser = await User.findOne({
    username: normalizedUsername,
    _id: { $ne: currentUserId },
  }).lean();

  if (existingUsernameUser) {
    return { error: "Username is already taken" };
  }

  return {
    value: {
      name: nextName,
      username: normalizedUsername,
    },
  };
};

export const getCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email username");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(buildUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateCurrentUserProfile = async (req, res) => {
  try {
    const validation = await validateProfileInput({
      name: req.body?.name,
      username: req.body?.username,
      currentUserId: req.user.id,
    });

    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      validation.value,
      {
        new: true,
        runValidators: true,
      }
    ).select("name email username");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(buildUserResponse(updatedUser));
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.username) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    return res.status(500).json({ message: error.message });
  }
};

export const updateUserProfile = updateCurrentUserProfile;
