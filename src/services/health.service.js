import pool from '../config/database.js';

class HealthService {
  async checkStatus() {
    const health = {
      server: 'healthy',
      database: 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    try {
      // A quick lightweight query to check connection status
      await pool.query('SELECT 1');
      health.database = 'healthy';
    } catch (error) {
      health.database = 'unhealthy';
      if (typeof AggregateError !== 'undefined' && error instanceof AggregateError) {
        health.dbError = error.errors.map(e => e.message).join(' | ');
      } else {
        health.dbError = error.message || String(error);
      }
    }

    return health;
  }
}

export default new HealthService();
