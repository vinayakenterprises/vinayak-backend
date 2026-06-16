import pool from "../config/database.js";

export const createNotification = async (userId, message, type) => {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, message, type)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, message, type]
  );
  return result.rows[0];
};

export const getNotifications = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return result.rows;
};

export const markAllRead = async (userId) => {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
    [userId]
  );
};

export const markOneRead = async (id) => {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1`,
    [id]
  );
};