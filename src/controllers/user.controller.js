import userService from "../services/user.service.js";

class UserController {
  getAll = async (req, res, next) => {
    try {
      const users = await userService.getAllUsers();

      return res.status(200).json({
        status: "success",
        message: "Users retrieved successfully",
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req, res, next) => {
    try {
      return res.status(200).json({
        status: "success",
        message: "Profile fetched successfully",
        data: req.user,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const file = req.files?.avatar_url?.[0] || null;

      const updatedProfile = await userService.updateProfile(userId, req.body, file);

      return res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        data: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new UserController();
