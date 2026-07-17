import jwt from "jsonwebtoken";
import User from "../models/User.js";


export const protect = async (req, res, next) => {
  let token;

  // Token usually sent in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    
    try {

      // Extract token
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request only when the token still references an account
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "Not authorized, token failed" });
      }

      req.user = user;

      return next();

    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }

  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

export default protect;
