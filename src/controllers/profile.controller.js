import profileService from "../services/profile.service.js";



class ProfileController {
    getProfileData = async (req, res, next) => {
        try {
            const userId = req.user?.id;


            const profileData = await profileService.getProfileData(userId);
            return res.status(200).json({
                status: "success",
                message: "Profile data retrieved successfully",
                data: profileData,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default new ProfileController();