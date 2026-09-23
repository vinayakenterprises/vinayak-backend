import pool from "../config/database.js";
import config from "../config/env.js";
import { uploadToS3 } from "../utils/s3.js";

class UserService {
  async getAllUsers() {
    const query = "SELECT * FROM public.users ORDER BY id ASC";
    const { rows } = await pool.query(query);
    return rows;
  }

  async getUserById(id) {
    const query = "SELECT * FROM public.users WHERE id = $1";
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  async getUserByEmail(email_id) {
    const query = "SELECT * FROM public.users WHERE email_id = $1";
    const { rows } = await pool.query(query, [email_id]);
    return rows[0] || null;
  }

  async updateProfile(id, data, file) {
    const query = "SELECT * FROM public.users WHERE id = $1";
    const { rows } = await pool.query(query, [id]);

    const user = rows[0];

    if (!user) {
      throw new Error("User not found");
    }

    const { phone_no } = data;

    let avatar_url = (data.avatar_url !== undefined && data.avatar_url !== null && data.avatar_url !== '') ? data.avatar_url : user.avatar_url;

    if (file) {
      avatar_url = await uploadToS3(file, config.s3.bucketName, "profile-avatar");
    }

    const updateQuery = `
    UPDATE public.users
    SET
      avatar_url = $1,
      phone_no = COALESCE($2, phone_no),
      updated_at = NOW()
    WHERE id = $3
    RETURNING *;
  `;

    const values = [avatar_url, phone_no, id];
    const { rows: updatedRows } = await pool.query(updateQuery, values);

    return updatedRows[0] || null;
  }
}

export default new UserService();
