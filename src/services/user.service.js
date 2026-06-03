import pool from '../config/database.js';

class UserService {
  async getAllUsers() {
    const query = 'SELECT * FROM public.users ORDER BY id ASC';
    const { rows } = await pool.query(query);
    return rows;
  }

  async getUserById(id) {
    const query = 'SELECT * FROM public.users WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  async getUserByEmail(email_id) {
    const query = 'SELECT * FROM public.users WHERE email_id = $1';
    const { rows } = await pool.query(query, [email_id]);
    return rows[0] || null;
  }
}

export default new UserService();
