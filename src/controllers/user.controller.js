import userService from '../services/user.service.js';

class UserController {
  getAll = async (req, res, next) => {
    try {
      const users = await userService.getAllUsers();
      
      return res.status(200).json({
        status: 'success',
        message: 'Users retrieved successfully',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new UserController();
