import healthService from '../services/health.service.js';

class HealthController {
  check = async (req, res, next) => {
    try {
      const status = await healthService.checkStatus();
      
      if (status.database === 'unhealthy') {
        return res.status(503).json({
          status: 'error',
          message: 'Service is partially degraded (Database connection failed)',
          data: status,
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Service is healthy',
        data: status,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new HealthController();
