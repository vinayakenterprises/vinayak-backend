import pool from "../config/database.js";

// Convert objects to JSON strings while preserving plain text.
const stringifyValue = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
};

class ErrorLogsService {
  // Create a new error log
  async createErrorLog(source, message, response) {
    if (source === undefined || source === null) {
      throw new Error("Source is required.");
    }

    if (typeof message !== "string" || !message.trim()) {
      throw new Error("A valid error message is required.");
    }

    const query = `
      INSERT INTO public.error_logs (source, message, response)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const values = [stringifyValue(source), message.trim(), stringifyValue(response)];

    const result = await pool.query(query, values);

    return result.rows[0];
  }

  // Get all error logs
  async getAllErrorLogs() {
    const query = `
      SELECT *
      FROM public.error_logs
      ORDER BY id DESC;
    `;

    const result = await pool.query(query);

    return result.rows;
  }

  // Get an error log by ID
  async getErrorLogById(id) {
    const validId = this.validateId(id);

    const query = `
      SELECT *
      FROM public.error_logs
      WHERE id = $1;
    `;

    const result = await pool.query(query, [validId]);

    return result.rows[0] || null;
  }

  // Update an existing error log
  async updateErrorLog(id, source, message, response) {
    const validId = this.validateId(id);

    if (source === undefined || source === null) {
      throw new Error("Source is required.");
    }

    if (typeof message !== "string" || !message.trim()) {
      throw new Error("A valid error message is required.");
    }

    const query = `
      UPDATE public.error_logs
      SET source = $2,
          message = $3,
          response = $4
      WHERE id = $1
      RETURNING *;
    `;

    const values = [validId, stringifyValue(source), message.trim(), stringifyValue(response)];

    const result = await pool.query(query, values);

    return result.rows[0] || null;
  }

  // Delete an error log
  async deleteErrorLog(id) {
    const validId = this.validateId(id);

    const query = `
      DELETE FROM public.error_logs
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, [validId]);

    return result.rows[0] || null;
  }

  // Validate the error log ID
  validateId(id) {
    const validId = Number(id);

    if (!Number.isSafeInteger(validId) || validId <= 0) {
      throw new Error("A valid positive error log ID is required.");
    }

    return validId;
  }
}

export default new ErrorLogsService();
