import authService from '../services/auth.service.js';
import { BadRequestError } from '../errors/customErrors.js';

class AuthController {
  login = async (req, res, next) => {
    try {
      const { email_id, password } = req.body;

      // console.log(email_id, password);
      // console.log("req body", )

      if (!email_id || !password) {
        throw new BadRequestError('Email ID and password are required');
      }

      const result = await authService.login(email_id, password);

      return res.status(200).json({
        status: 'success',
        message: 'Logged in successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new AuthController();
