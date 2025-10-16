// File: /src/middleware/authMiddleware.js
import { verifyAccessToken } from "../lib/jsonWebToken.js";

export function authMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.cookies?.accessToken;
      if (!authHeader)
        return res.status(401).json({ message: "Unauthorized: No token" });

      const token = authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : authHeader;

      const decoded = verifyAccessToken(token);
      if (!decoded)
        return res.status(401).json({ message: "Unauthorized: Invalid token" });

      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      req.user = decoded;
      next();
    } catch (err) {
      console.error("Auth Middleware Error:", err);
      res.status(500).json({ message: "Internal Server Error in auth middleware" });
    }
  };
}
