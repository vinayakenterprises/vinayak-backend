import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import userService from './user.service.js';
import { UnauthorizedError } from '../errors/customErrors.js';

class AuthService {
  async login(email_id, password) {
    // 1. Fetch user by email
    const user = await userService.getUserByEmail(email_id);


    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Verify password (plain text comparison, as requested)
    if (user.password !== password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Generate JWT Token
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      department: user.department,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    // 4. Return user info (without password) and the token
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    return {
      user: userWithoutPassword,
      token,
    };
  }
}

export default new AuthService();
