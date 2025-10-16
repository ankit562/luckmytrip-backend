import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "fallback-access";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "fallback-refresh";
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

export function generateAccessToken(payload, expiresIn = ACCESS_TOKEN_EXPIRY) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn });
}

export function generateRefreshToken(payload, expiresIn = REFRESH_TOKEN_EXPIRY) {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    console.error("Access Token Verification Error:", error);
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    console.error("Refresh Token Verification Error:", error);
    return null;
  }
}
