import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import userService from '../services/user.service.js';
import { UnauthorizedError } from '../errors/customErrors.js';

export const authMiddleware = async (req, res, next) => {
  try {
    // 1. Get Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token missing or invalid');
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];

    // 3. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // 4. Verify user exists in DB
    const user = await userService.getUserById(decoded.id);
    if (!user) {
      throw new UnauthorizedError('User associated with this token no longer exists');
    }

    // 5. Attach user info (without password) to req.user
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;
    req.user = userWithoutPassword;

    next();
  } catch (error) {
    next(error);
  }
};
