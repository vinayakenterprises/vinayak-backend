import errorLogsService from "../services/errorLogs.service.js";

class ErrorLogsController {
  // Create a new error log
  createErrorLog = async (req, res, next) => {
    try {
      const { source, message, response, error } = req.body;

      // Support both error.message and message
      const errorMessage = error?.message ?? message;

      if (typeof errorMessage !== "string" || !errorMessage.trim()) {
        return res.status(400).json({
          status: "error",
          message: "A valid error message is required.",
        });
      }

      // Use the provided source or store the complete request body
      const errorSource = source ?? req.body;

      if (errorSource === null || (typeof errorSource === "string" && !errorSource.trim())) {
        return res.status(400).json({
          status: "error",
          message: "Source is required.",
        });
      }

      // Prefer response, otherwise store the error object
      const errorResponse = response ?? error ?? null;

      const log = await errorLogsService.createErrorLog(errorSource, errorMessage, errorResponse);

      return res.status(201).json({
        status: "success",
        message: "Error log created successfully",
        data: log,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get all error logs
  getAllErrorLogs = async (req, res, next) => {
    try {
      const logs = await errorLogsService.getAllErrorLogs();

      return res.status(200).json({
        status: "success",
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get an error log by ID
  getErrorLogById = async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          status: "error",
          message: "A valid positive error log ID is required.",
        });
      }

      const log = await errorLogsService.getErrorLogById(id);

      if (!log) {
        return res.status(404).json({
          status: "error",
          message: "Error log not found.",
        });
      }

      return res.status(200).json({
        status: "success",
        data: log,
      });
    } catch (error) {
      next(error);
    }
  };

  // Update an existing error log
  updateErrorLog = async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          status: "error",
          message: "A valid positive error log ID is required.",
        });
      }

      const { source, message, response } = req.body;

      if (
        source === undefined ||
        source === null ||
        (typeof source === "string" && !source.trim())
      ) {
        return res.status(400).json({
          status: "error",
          message: "Source is required.",
        });
      }

      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          status: "error",
          message: "A valid error message is required.",
        });
      }

      const log = await errorLogsService.updateErrorLog(id, source, message, response);

      if (!log) {
        return res.status(404).json({
          status: "error",
          message: "Error log not found.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Error log updated successfully",
        data: log,
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete an error log
  deleteErrorLog = async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          status: "error",
          message: "A valid positive error log ID is required.",
        });
      }

      const log = await errorLogsService.deleteErrorLog(id);

      if (!log) {
        return res.status(404).json({
          status: "error",
          message: "Error log not found.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Error log deleted successfully",
        data: log,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new ErrorLogsController();
