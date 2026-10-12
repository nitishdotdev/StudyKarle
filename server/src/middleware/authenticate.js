const tokenService = require('../services/tokenService');
const userModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('./asyncHandler');
const env = require('../config/env');

module.exports = asyncHandler(async function authenticate(req, res, next) {
  const token = req.cookies ? req.cookies[env.cookieName] : null;

  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  let payload;
  try {
    payload = tokenService.verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Session expired. Please log in again');
  }

  const user = await userModel.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  const currentTv = user.token_version || 0;
  const tokenTv = payload.tv == null ? 0 : payload.tv;
  if (currentTv !== tokenTv) {
    throw ApiError.unauthorized('Session expired. Please log in again');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  next();
});
