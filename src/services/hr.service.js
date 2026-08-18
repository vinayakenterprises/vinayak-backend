import pool from "../config/database.js";

const formatToYYYYMMDD = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(dateInput);
  }
  const str = String(dateInput).trim();
  if (!str || str === "null" || str === "undefined" || str === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy)
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(dt);
  }
  return null;
};

const getMonthCode = (dateInput) => {
  const formatted = formatToYYYYMMDD(dateInput);
  if (formatted) return formatted.substring(0, 7);
  return null;
};


class HrService {
  async createHiringRecord(recordData) {
    const {
      position_name,
      closing_date,
      interviewees_appeared = 0,
      offers_given = 0,
      onboarded_candidates = 0,
      hiring_status = "Open",
      selected_month,
      created_at,
      final_closed_date: inputFinalClosedDate,
      priority,
      job_id,
    } = recordData;

    let finalJobId = job_id?.trim();
    if (!finalJobId) {
      const { rows } = await pool.query(`SELECT job_id FROM hiring_information`);
      let maxNum = 0;
      for (const r of rows) {
        if (r.job_id) {
          const match = r.job_id.match(/#(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      finalJobId = `#${maxNum + 1}`;
    }

    const finalPriority = priority !== undefined && priority !== null && priority !== ""
      ? parseInt(priority, 10)
      : 3;

    const cleanClosingDate = formatToYYYYMMDD(closing_date);

    const dateObj = created_at ? new Date(created_at) : new Date();
    const monthCode =
      selected_month && selected_month !== "All"
        ? selected_month
        : getMonthCode(dateObj); // YYYY-MM
    const [yearStr, monthStr] = monthCode.split("-");
    const targetDate = new Date(
      parseInt(yearStr, 10),
      parseInt(monthStr, 10) - 1,
      1,
      12,
      0,
      0,
    );
    const monthName = targetDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const closingMonthCode = getMonthCode(cleanClosingDate);

    // If the position closes in a future month, creation month status MUST be 'Open'
    let creationStatus = hiring_status;
    if (
      closingMonthCode &&
      monthCode < closingMonthCode &&
      hiring_status === "Closed"
    ) {
      creationStatus = "Open";
    }

    let final_closed_date = null;
    if (hiring_status === "Closed") {
      final_closed_date = formatToYYYYMMDD(new Date());
    }

    const initialHistory = [
      {
        id: monthCode,
        month: monthName,
        status: creationStatus,
        interviewees_appeared: Number(interviewees_appeared),
        offers_given: Number(offers_given),
        onboarded_candidates: Number(onboarded_candidates),
      },
    ];

    if (closingMonthCode && closingMonthCode > monthCode) {
      const [yStr, mStr] = closingMonthCode.split("-");
      const targetClosingDate = new Date(
        parseInt(yStr, 10),
        parseInt(mStr, 10) - 1,
        1,
        12,
        0,
        0,
      );
      const closingMonthName = targetClosingDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      initialHistory.push({
        id: closingMonthCode,
        month: closingMonthName,
        status: hiring_status,
        interviewees_appeared: Number(interviewees_appeared),
        offers_given: Number(offers_given),
        onboarded_candidates: Number(onboarded_candidates),
      });
    }

    let query;
    let params;

    if (created_at) {
      query = `
          INSERT INTO hiring_information 
            (position_name, closing_date, interviewees_appeared, offers_given, onboarded_candidates, hiring_status, created_at, history, final_closed_date, job_id, priority) 
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *;
        `;
      params = [
        position_name?.trim(),
        cleanClosingDate,
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        created_at,
        JSON.stringify(initialHistory),
        final_closed_date,
        finalJobId,
        finalPriority,
      ];
    } else {
      query = `
          INSERT INTO hiring_information 
            (position_name, closing_date, interviewees_appeared, offers_given, onboarded_candidates, hiring_status, history, final_closed_date, job_id, priority) 
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;
        `;
      params = [
        position_name?.trim(),
        cleanClosingDate,
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        JSON.stringify(initialHistory),
        final_closed_date,
        finalJobId,
        finalPriority,
      ];
    }

    try {
      const { rows } = await pool.query(query, params);
      return await this.getHiringRecordById(rows[0].id);
    } catch (error) {
      console.error("Error in creating hiring record:", error);
      throw error;
    }
  }

  /**
   * Retrieves all hiring records based on date range filtering.
   */
  async getAllHiringRecords(startDateParam, endDateParam) {
    let startDate = startDateParam;
    let endDate = endDateParam;

    // Support both signatures: getAllHiringRecords(startDate, endDate) and getAllHiringRecords({ startDate, endDate })
    if (typeof startDateParam === "object" && startDateParam !== null) {
      startDate = startDateParam.startDate || null;
      endDate = startDateParam.endDate || null;
    }

    // Helper function to normalize dates safely (supports ISO, DMY, and Date objects)
    const normalizeDateStr = (d) => {
      if (!d) return null;
      const str = String(d).trim();
      if (!str || str === "null" || str === "undefined") return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
      const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmy)
        return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
        }).format(dt);
      }
      return null;
    };

    const cleanStart = normalizeDateStr(startDate);
    const cleanEnd = normalizeDateStr(endDate);

    const startMonth = cleanStart
      ? cleanStart.substring(0, 7)
      : cleanEnd
        ? cleanEnd.substring(0, 7)
        : null;
    const endMonth = cleanEnd ? cleanEnd.substring(0, 7) : startMonth;

    let query = `
            SELECT 
                id,
                job_id,
                priority,
                position_name,
                closing_date,
                interviewees_appeared,
                offers_given,
                onboarded_candidates,
                hiring_status,
                created_at,
                updated_at,
                history,
                final_closed_date
            FROM hiring_information
        `;

    const params = [];
    const conditions = [];

    // Apply filtering logic if a date range is selected
    if (cleanStart && cleanEnd) {
      params.push(cleanEnd); // $1

      // Include all jobs created on or before the selected endDate so monthly history snapshots determine metrics
      conditions.push(`created_at::date <= $1::date`);
    } else {
      if (cleanEnd) {
        params.push(cleanEnd);
        conditions.push(`created_at::date <= $${params.length}::date`);
      }
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY id DESC";

    try {
      const { rows } = await pool.query(query, params);

      const allRecords = rows.map((row) => {
        // Parse history safely if it is a string or already an array
        let history = Array.isArray(row.history)
          ? row.history
          : (() => {
              try {
                return JSON.parse(row.history || "[]");
              } catch {
                return [];
              }
            })();

        // Sort history ascending by month id (YYYY-MM)
        history.sort((a, b) => a.id.localeCompare(b.id));

        let interviewees = 0;
        let offers = 0;
        let onboarded = 0;
        let status = row.hiring_status;

        // When a date range is selected:
        if (startMonth && endMonth) {
          // Sum only the history entries between startMonth and endMonth
          const rangeLogs = history.filter(
            (h) => h.id >= startMonth && h.id <= endMonth,
          );

          for (const h of rangeLogs) {
            interviewees += Number(h.interviewees_appeared || 0);
            offers += Number(h.offers_given || 0);
            onboarded += Number(h.onboarded_candidates || 0);
          }

          // Determine the latest status up to endMonth
          const latestLog = [...history]
            .reverse()
            .find((h) => h.id <= endMonth);

          if (latestLog) {
            status = latestLog.status;
          }

          // If position is Closed, but closing date/month is after endMonth, show status as Open for endMonth
          if (row.hiring_status === "Closed" && row.closing_date) {
            const closingMonth = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
            })
              .format(new Date(row.closing_date))
              .substring(0, 7);
            if (endMonth < closingMonth) {
              status = "Open";
            }
          }
        } else {
          // If no date range is provided, return all-time totals from history
          for (const h of history) {
            interviewees += Number(h.interviewees_appeared || 0);
            offers += Number(h.offers_given || 0);
            onboarded += Number(h.onboarded_candidates || 0);
          }

          if (history.length > 0) {
            status = history[history.length - 1].status;
          }
        }

        let finalClosedDate = formatToYYYYMMDD(row.final_closed_date);
        if (status === "Closed" && !finalClosedDate) {
          finalClosedDate =
            formatToYYYYMMDD(row.updated_at) || formatToYYYYMMDD(new Date());
        }

        return {
          id: row.id,
          job_id: row.job_id,
          priority: row.priority !== null && row.priority !== undefined ? Number(row.priority) : 3,
          position_name: row.position_name,
          closing_date: formatToYYYYMMDD(row.closing_date),
          final_closed_date: finalClosedDate,
          interviewees_appeared: interviewees,
          offers_given: offers,
          onboarded_candidates: onboarded,
          hiring_status: status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          history,
        };
      });

      // Filter out positions whose status changed to Closed in prior months
      if (startMonth && endMonth) {
        return allRecords.filter((rec) => {
          if (rec.hiring_status === "Closed") {
            // Find the contiguous Closed block ending at endMonth
            const historyUpToEnd = rec.history
              .filter((h) => h.id <= endMonth)
              .sort((a, b) => b.id.localeCompare(a.id));

            const nonClosedIndex = historyUpToEnd.findIndex(
              (h) => h.status !== "Closed",
            );
            let closedMonth = null;
            if (nonClosedIndex > 0) {
              closedMonth = historyUpToEnd[nonClosedIndex - 1].id;
            } else if (nonClosedIndex === -1 && historyUpToEnd.length > 0) {
              closedMonth = historyUpToEnd[historyUpToEnd.length - 1].id;
            }

            // If the job became Closed in a month strictly before startMonth, filter it out
            if (closedMonth && closedMonth < startMonth) {
              return false;
            }
          }
          return true;
        });
      }

      return allRecords;
    } catch (error) {
      console.error("Error in getting hiring records:", error);
      throw error;
    }
  }

  async getHiringRecordById(id) {
    if (!id || isNaN(Number(id)))
      throw new Error("A valid hiring record ID is required.");

    const query = "SELECT * FROM hiring_information WHERE id = $1";

    try {
      const { rows } = await pool.query(query, [id]);
      if (rows.length === 0) {
        throw new Error(`Hiring record with ID ${id} not found`);
      }

      const row = rows[0];
      let history = row.history || [];
      if (typeof history === "string") {
        try {
          history = JSON.parse(history);
        } catch (e) {
          history = [];
        }
      }
      history.sort((a, b) => a.id.localeCompare(b.id));

      let finalClosedDate = formatToYYYYMMDD(row.final_closed_date);
      if (row.hiring_status === "Closed" && !finalClosedDate) {
        finalClosedDate =
          formatToYYYYMMDD(row.updated_at) || formatToYYYYMMDD(new Date());
      }

      return {
        ...row,
        closing_date: formatToYYYYMMDD(row.closing_date),
        final_closed_date: finalClosedDate,
        history,
      };
    } catch (error) {
      console.error("Error in getting hiring record by ID:", error);
      throw error;
    }
  }

  async updateHiringRecord(recordData) {
    const {
      id,
      position_name,
      closing_date,
      interviewees_appeared,
      offers_given,
      onboarded_candidates,
      hiring_status,
      selected_month,
      final_closed_date: inputFinalClosedDate,
      priority,
      job_id,
    } = recordData;

    // Fetch existing record
    const existingRecord = await this.getHiringRecordById(id);

    const finalPriority = priority !== undefined && priority !== null && priority !== ""
      ? parseInt(priority, 10)
      : (existingRecord.priority !== undefined && existingRecord.priority !== null ? Number(existingRecord.priority) : 3);
    const finalJobId = job_id?.trim() || existingRecord.job_id;

    // Parse history safely
    let history = existingRecord.history || [];
    if (typeof history === "string") {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }

    const createdMonthCode =
      getMonthCode(existingRecord.created_at) || getMonthCode(new Date());

    const newStatus = hiring_status || existingRecord.hiring_status;
    const newClosingDate =
      formatToYYYYMMDD(closing_date) ||
      formatToYYYYMMDD(existingRecord.closing_date);

    // -----------------------------
    // Final Closed Date Logic
    // -----------------------------
    let newFinalClosedDate = null;

    if (newStatus === "Closed") {
      if (existingRecord.hiring_status !== "Closed") {
        // Status changed to Closed: set final_closed_date to current day's date
        newFinalClosedDate = formatToYYYYMMDD(new Date());
      } else {
        // Status was already Closed: retain existing or input final closed date
        newFinalClosedDate =
          formatToYYYYMMDD(inputFinalClosedDate) ||
          formatToYYYYMMDD(existingRecord.final_closed_date) ||
          formatToYYYYMMDD(new Date());
      }
    } else {
      // Clear when status is not Closed
      newFinalClosedDate = null;
    }

    // Determine effective closing month code if Closed
    let closedMonthCode = null;

    if (newStatus === "Closed") {
      closedMonthCode = getMonthCode(newClosingDate);

      if (!closedMonthCode) {
        if (selected_month && selected_month !== "All") {
          closedMonthCode = selected_month;
        } else {
          closedMonthCode = getMonthCode(new Date());
        }
      }
    }

    // Determine target month code
    let targetMonthCode;

    if (selected_month && selected_month !== "All") {
      targetMonthCode = selected_month;
    } else if (closedMonthCode) {
      targetMonthCode = closedMonthCode;
    } else {
      targetMonthCode = getMonthCode(new Date());
    }

    // Ensure creation month history exists
    const creationIdx = history.findIndex((h) => h.id === createdMonthCode);

    if (creationIdx === -1) {
      const createdDate = existingRecord.created_at
        ? new Date(existingRecord.created_at)
        : new Date();

      const createdMonthName = createdDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });

      history.push({
        id: createdMonthCode,
        month: createdMonthName,
        status: "Open",
        interviewees_appeared: 0,
        offers_given: 0,
        onboarded_candidates: 0,
      });
    }

    // Target month snapshot
    const [yearStr, monthStr] = targetMonthCode.split("-");

    const targetDate = new Date(
      parseInt(yearStr, 10),
      parseInt(monthStr, 10) - 1,
      1,
      12,
      0,
      0,
    );

    const monthName = targetDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const idx = history.findIndex((h) => h.id === targetMonthCode);

    if (idx !== -1) {
      history[idx] = {
        ...history[idx],
        status: newStatus,
        interviewees_appeared:
          interviewees_appeared !== undefined
            ? Number(interviewees_appeared)
            : history[idx].interviewees_appeared,
        offers_given:
          offers_given !== undefined
            ? Number(offers_given)
            : history[idx].offers_given,
        onboarded_candidates:
          onboarded_candidates !== undefined
            ? Number(onboarded_candidates)
            : history[idx].onboarded_candidates,
      };
    } else {
      const prevLogs = history.filter((h) => h.id < targetMonthCode);

      prevLogs.sort((a, b) => a.id.localeCompare(b.id));

      const lastPrev =
        prevLogs.length > 0 ? prevLogs[prevLogs.length - 1] : null;

      history.push({
        id: targetMonthCode,
        month: monthName,
        status: newStatus,
        interviewees_appeared:
          interviewees_appeared !== undefined
            ? Number(interviewees_appeared)
            : lastPrev
              ? lastPrev.interviewees_appeared
              : 0,
        offers_given:
          offers_given !== undefined
            ? Number(offers_given)
            : lastPrev
              ? lastPrev.offers_given
              : 0,
        onboarded_candidates:
          onboarded_candidates !== undefined
            ? Number(onboarded_candidates)
            : lastPrev
              ? lastPrev.onboarded_candidates
              : 0,
      });
    }

    // Sort history
    history.sort((a, b) => a.id.localeCompare(b.id));

    // Update future months status
    for (const h of history) {
      if (h.id >= targetMonthCode) {
        h.status = newStatus;
      }
    }

    const lastEntry = history[history.length - 1];

    const query = `
        UPDATE hiring_information
        SET 
            position_name = $2,
            closing_date = $3,
            interviewees_appeared = $4,
            offers_given = $5,
            onboarded_candidates = $6,
            hiring_status = $7,
            history = $8::jsonb,
            final_closed_date = $9::date,
            priority = $10,
            job_id = $11,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
    `;

    try {
      console.log({
        id,
        newStatus,
        newFinalClosedDate,
        finalPriority,
        finalJobId,
      });

      const { rows } = await pool.query(query, [
        id,
        position_name || existingRecord.position_name,
        newClosingDate,
        lastEntry
          ? lastEntry.interviewees_appeared
          : Number(interviewees_appeared || 0),
        lastEntry ? lastEntry.offers_given : Number(offers_given || 0),
        lastEntry
          ? lastEntry.onboarded_candidates
          : Number(onboarded_candidates || 0),
        lastEntry ? lastEntry.status : newStatus,
        JSON.stringify(history),
        newFinalClosedDate,
        finalPriority,
        finalJobId,
      ]);

      if (rows.length === 0) {
        throw new Error(`Hiring record with ID ${id} not found`);
      }

      return await this.getHiringRecordById(rows[0].id);
    } catch (error) {
      console.error("Error while updating the hiring record:", error);
      throw error;
    }
  }

  async deleteHiringRecord(id) {
    if (!id || isNaN(Number(id)))
      throw new Error("A valid hiring record ID is required.");

    const query = "DELETE FROM hiring_information WHERE id = $1 RETURNING *;";
    try {
      const { rows } = await pool.query(query, [id]);

      if (rows.length === 0) {
        throw new Error(`Hiring record with ID ${id} not found`);
      }

      return rows[0];
    } catch (error) {
      console.error("Error while deleting the hiring record");
      throw error;
    }
  }

  async getHiringSummary(startDateParam, endDateParam) {
    try {
      let startDate = startDateParam;
      let endDate = endDateParam;

      if (typeof startDateParam === "object" && startDateParam !== null) {
        startDate = startDateParam.startDate || null;
        endDate = startDateParam.endDate || null;
      }

      const records = await this.getAllHiringRecords({ startDate, endDate });

      let total_positions = 0;
      let total_interviewees = 0;
      let total_offers = 0;
      let total_onboarded = 0;

      for (const rec of records) {
        if (rec.hiring_status === "Open") {
          total_positions += 1;
          total_interviewees += Number(rec.interviewees_appeared || 0);
          total_offers += Number(rec.offers_given || 0);
          total_onboarded += Number(rec.onboarded_candidates || 0);
        }
      }

      return {
        total_positions,
        total_interviewees,
        total_offers,
        total_onboarded,
      };
    } catch (error) {
      console.error("Error in getHiringSummary:", error);
      throw error;
    }
  }

  // HIRING TASK SERVICES

  async createHiringTask(taskData) {
    const {
      task_name,
      start_date,
      end_date,
      completed = false,
      remarks = null,
    } = taskData;

    const query = `
      INSERT INTO hiring_tasks 
        (task_name, start_date, end_date, completed, remarks) 
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    try {
      const { rows } = await pool.query(query, [
        task_name,
        start_date,
        end_date,
        completed,
        remarks,
      ]);

      return rows[0];
    } catch (error) {
      console.error("Error while creating a task.");
      throw error;
    }
  }

  async getAllHiringTasks() {
    const query = "SELECT * FROM hiring_tasks ORDER BY id DESC;";
    try {
      const { rows } = await pool.query(query);
      return rows.map((row) => {
        let delay_days = 0;
        const targetDate = row.end_date ? new Date(row.end_date) : null;
        const compDate = row.completed ? (row.updated_at ? new Date(row.updated_at) : new Date()) : new Date();
        if (targetDate && !isNaN(targetDate.getTime())) {
          targetDate.setHours(0, 0, 0, 0);
          compDate.setHours(0, 0, 0, 0);
          const diff = Math.ceil((compDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) delay_days = diff;
        }
        return { ...row, delay_days };
      });
    } catch (error) {
      console.error("Error while fetching hiring tasks");
      throw error;
    }
  }

  async getTasksByRange(startDate, endDate) {
    const query = `
      SELECT * FROM hiring_tasks
      WHERE start_date <= $2 AND end_date >= $1
      ORDER BY start_date ASC, id DESC;
    `;

    try {
      const { rows } = await pool.query(query, [startDate, endDate]);
      return rows.map((row) => {
        let delay_days = 0;
        const targetDate = row.end_date ? new Date(row.end_date) : null;
        const compDate = row.completed ? (row.updated_at ? new Date(row.updated_at) : new Date()) : new Date();
        if (targetDate && !isNaN(targetDate.getTime())) {
          targetDate.setHours(0, 0, 0, 0);
          compDate.setHours(0, 0, 0, 0);
          const diff = Math.ceil((compDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) delay_days = diff;
        }
        return { ...row, delay_days };
      });
    } catch (error) {
      console.error("Error while fetching tasks by range");
      throw error;
    }
  }

  async getTaskById(id) {
    const query = "SELECT * FROM hiring_tasks WHERE id = $1;";

    try {
      const { rows } = await pool.query(query, [id]);

      if (rows.length === 0) {
        throw new Error(`Task with ID ${id} not found`);
      }

      return rows[0];
    } catch (error) {
      console.error("Error while fetching task by ID");
      throw error;
    }
  }

  async updateTask(id, taskData) {
    // Check if task exists first
    await this.getTaskById(id);

    const { task_name, start_date, end_date, completed, remarks } = taskData;

    const query = `
      UPDATE hiring_tasks
      SET 
        task_name = $1,
        start_date = $2,
        end_date = $3,
        completed = $4,
        remarks = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    try {
      const { rows } = await pool.query(query, [
        task_name,
        start_date,
        end_date,
        completed,
        remarks,
        id,
      ]);

      return rows[0];
    } catch (error) {
      console.error("Error while updating task");
      throw error;
    }
  }

  async updateTaskStatus(id, completed) {
    const query = `
      UPDATE hiring_tasks
      SET 
        completed = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    try {
      const { rows } = await pool.query(query, [completed, id]);

      if (rows.length === 0) {
        throw new Error(`Task with ID ${id} not found`);
      }

      return rows[0];
    } catch (error) {
      console.error("Error in updateTaskStatus:", error);
      throw error;
    }
  }

  async deleteTask(id) {
    const query = "DELETE FROM hiring_tasks WHERE id = $1 RETURNING *;";
    try {
      const { rows } = await pool.query(query, [id]);

      if (rows.length === 0) {
        throw new Error(`Task with ID ${id} not found`);
      }

      return rows[0];
    } catch (error) {
      console.error("Error in deleteTask:", error);
      throw error;
    }
  }

  async createVisitEntry(planned) {
    try {
      const insertQuery = `insert into hr_visit_tracker (planned) values ($1) returning *`;
      const { rows } = await pool.query(insertQuery, [planned]);
      return rows[0];
    } catch (error) {
      console.error("Error in creating visit entry: ", error);
      throw error;
    }
  }

  async getHRVisitTrackerEntries(startDateParam, endDateParam) {
    try {
      let startDate = startDateParam;
      let endDate = endDateParam;

      // Support passing an object
      if (typeof startDateParam === "object" && startDateParam !== null) {
        startDate = startDateParam.startDate || null;
        endDate = startDateParam.endDate || null;
      }

      let query = `
            SELECT
                id,
                planned,
                actual,
                created_at
            FROM hr_visit_tracker
        `;

      const params = [];

      // Apply filter only if BOTH dates are provided
      if (startDate && endDate) {
        params.push(startDate, endDate);

        query += `
                WHERE planned BETWEEN $1 AND $2
            `;
      }

      query += `
            ORDER BY id DESC
        `;

      const { rows } = await pool.query(query, params);

      return rows.map((row) => {
        let delay_days = 0;
        const plannedDate = row.planned ? new Date(row.planned) : null;
        const actualDate = row.actual ? new Date(row.actual) : new Date();
        if (plannedDate && !isNaN(plannedDate.getTime())) {
          plannedDate.setHours(0, 0, 0, 0);
          actualDate.setHours(0, 0, 0, 0);
          const diff = Math.ceil((actualDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) delay_days = diff;
        }
        return { ...row, delay_days };
      });
    } catch (error) {
      console.error("Error in getting visit entries:", error);
      throw error;
    }
  }

  async deleteVisitEntry(id) {
    try {
      const deleteQuery = `delete from hr_visit_tracker where id = $1 returning *`;
      const { rows } = await pool.query(deleteQuery, [id]);
      return rows[0];
    } catch (error) {
      console.error("Error in deleting visit entry: ", error);
      throw error;
    }
  }

  async updateActualDate(id, actual) {
    try {
      const updateQuery = `update hr_visit_tracker set actual = $1 where id = $2 returning *`;
      const { rows } = await pool.query(updateQuery, [actual, id]);
      return rows[0];
    } catch (error) {
      console.error("Error in updating visit entry: ", error);
      throw error;
    }
  }

  async getTaskSummary(startDateParam, endDateParam) {
    try {
      let startDate = startDateParam;
      let endDate = endDateParam;

      if (typeof startDateParam === "object" && startDateParam !== null) {
        startDate = startDateParam.startDate || null;
        endDate = startDateParam.endDate || null;
      }

      const conditions = [];
      const params = [];
      if (startDate) {
        params.push(startDate);
        conditions.push(`end_date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`start_date <= $${params.length}`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `
              SELECT
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE completed = TRUE) as completed_tasks,
                COUNT(*) FILTER (WHERE completed = FALSE) as pending_tasks
              FROM hiring_tasks
              ${whereClause};
            `;

      const { rows } = await pool.query(query, params);
      const summary = rows[0];

      return {
        total_tasks: Number(summary.total_tasks || 0),
        completed_tasks: Number(summary.completed_tasks || 0),
        pending_tasks: Number(summary.pending_tasks || 0),
      };
    } catch (error) {
      console.error("Error in getTaskSummary:", error);
      throw error;
    }
  }
}

export default new HrService();
