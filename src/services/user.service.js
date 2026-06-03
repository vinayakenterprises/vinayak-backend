import pool from '../config/database.js';

class UserService {
  async getAllUsers() {
    const query = 'SELECT * FROM public.users ORDER BY id ASC';
    const { rows } = await pool.query(query);
    return rows;
  }
}

export default new UserService();
