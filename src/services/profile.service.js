import pool from "../config/database.js";

class ProfileService {
  getProfileData = async (userId) => {
    try {
      const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
        userId,
      ]);


      return rows[0];
    } catch (error) {
      throw error;
    }
  };
}

export default new ProfileService();
