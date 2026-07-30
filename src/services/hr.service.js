import pool from "../config/database.js";

class HrService {
    // ==========================================
    // HIRING INFORMATION SERVICES
    // ==========================================

    async createHiringRecord(recordData) {
        const {
            position_name,
            closing_date,
            interviewees_appeared = 0,
            offers_given = 0,
            onboarded_candidates = 0,
            hiring_status = "Open",
            created_at,
        } = recordData;

        const dateObj = created_at ? new Date(created_at) : new Date();
        const monthCode = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dateObj).substring(0, 7); // YYYY-MM
        const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

        const initialHistory = [{
            id: monthCode,
            month: monthName,
            status: hiring_status,
            interviewees_appeared: Number(interviewees_appeared),
            offers_given: Number(offers_given),
            onboarded_candidates: Number(onboarded_candidates)
        }];

        let query;
        let params;

        if (created_at) {
            query = `
          INSERT INTO hiring_information 
            (position_name, closing_date, interviewees_appeared, offers_given, onboarded_candidates, hiring_status, created_at, history) 
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;
        `;
            params = [
                position_name?.trim(),
                closing_date,
                interviewees_appeared,
                offers_given,
                onboarded_candidates,
                hiring_status,
                created_at,
                JSON.stringify(initialHistory),
            ];
        } else {
            query = `
          INSERT INTO hiring_information 
            (position_name, closing_date, interviewees_appeared, offers_given, onboarded_candidates, hiring_status, history) 
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;
            params = [
                position_name?.trim(),
                closing_date,
                interviewees_appeared,
                offers_given,
                onboarded_candidates,
                hiring_status,
                JSON.stringify(initialHistory),
            ];
        }

        try {
            const { rows } = await pool.query(query, params);
            return rows[0];
        } catch (error) {
            console.error("Error in creating hiring record:", error);
            throw error;
        }
    };

    async getAllHiringRecords(month) {
        let query = `
      SELECT 
        id,
        position_name, 
        closing_date, 
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        created_at,
        updated_at,
        history
      FROM hiring_information
    `;

        const params = [];

        // Apply month filter if provided
        if (month) {
            params.push(`${month}-01`);

            query += `
           WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date < ($1::date + INTERVAL '1 month')
             AND (closing_date IS NULL OR closing_date >= $1::date)
        `;
        }

        query += ` ORDER BY id DESC`;

        try {
            const { rows } = await pool.query(query, params);
            
            const result = rows.map(row => {
                let history = row.history || [];
                if (typeof history === 'string') {
                    try {
                        history = JSON.parse(history);
                    } catch (e) {
                        history = [];
                    }
                }

                // If month filter is applied, extract that month's metrics, else use the raw row columns
                let interviewees_appeared = row.interviewees_appeared;
                let offers_given = row.offers_given;
                let onboarded_candidates = row.onboarded_candidates;
                let hiring_status = row.hiring_status;

                if (month) {
                    const monthLog = history.find(h => h.id === month);
                    if (monthLog) {
                        interviewees_appeared = monthLog.interviewees_appeared;
                        offers_given = monthLog.offers_given;
                        onboarded_candidates = monthLog.onboarded_candidates;
                        hiring_status = monthLog.status;
                    } else {
                        // Dynamically reset metrics to 0 for the carried-over month if not logged yet
                        interviewees_appeared = 0;
                        offers_given = 0;
                        onboarded_candidates = 0;
                    }
                }

                return {
                    id: row.id,
                    position_name: row.position_name,
                    closing_date: row.closing_date,
                    interviewees_appeared,
                    offers_given,
                    onboarded_candidates,
                    hiring_status,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    history
                };
            });

            return result;
        } catch (error) {
            console.error('Error in getting hiring records:', error);
            throw error;
        }
    }

    async getHiringRecordById(id) {
        if (!id || isNaN(Number(id))) throw new Error("A valid hiring record ID is required.");

        const query = "SELECT * FROM hiring_information WHERE id = $1";

        try {
            const { rows } = await pool.query(query, [id]);
            if (rows.length === 0) {
                throw new Error(`Hiring record with ID ${id} not found`);
            }

            return rows[0];
        } catch (error) {
            console.error("Error in getting hiring record by ID:", error);
            throw error;
        }
    };

    async updateHiringRecord(recordData) {
        const { id, position_name, closing_date, interviewees_appeared, offers_given, onboarded_candidates, hiring_status, selected_month } = recordData;

        // Fetch the existing record
        const existingRecord = await this.getHiringRecordById(id);
        
        // Retrieve and parse history (pg parses JSONB automatically)
        let history = existingRecord.history || [];
        if (typeof history === 'string') {
            try {
                history = JSON.parse(history);
            } catch (e) {
                history = [];
            }
        }

        // Determine target month code (YYYY-MM)
        let monthCode;
        if (selected_month && selected_month !== 'All') {
            monthCode = selected_month;
        } else {
            monthCode = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).substring(0, 7);
        }

        // Determine target month name (e.g. "August 2026")
        const targetDate = new Date(`${monthCode}-01T12:00:00`);
        const monthName = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

        // Update or insert month entry in history
        const idx = history.findIndex(h => h.id === monthCode);
        const snapshot = {
            id: monthCode,
            month: monthName,
            status: hiring_status,
            interviewees_appeared: Number(interviewees_appeared),
            offers_given: Number(offers_given),
            onboarded_candidates: Number(onboarded_candidates)
        };

        if (idx !== -1) {
            history[idx] = snapshot;
        } else {
            history.push(snapshot);
        }

        // If overall status is 'Closed', update all occurrences of the status in history to 'Closed'
        if (hiring_status === 'Closed') {
            history = history.map(h => ({
                ...h,
                status: 'Closed'
            }));
        }

        // Sort history by monthCode (id) ascending
        history.sort((a, b) => a.id.localeCompare(b.id));

        const query = `
      UPDATE hiring_information
      SET 
        position_name = $2,
        closing_date = $3,
        interviewees_appeared = $4,
        offers_given = $5,
        onboarded_candidates = $6,
        hiring_status = $7,
        history = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

        try {
            const { rows } = await pool.query(query, [
                id,
                position_name || existingRecord.position_name,
                closing_date || existingRecord.closing_date,
                Number(interviewees_appeared),
                Number(offers_given),
                Number(onboarded_candidates),
                hiring_status || existingRecord.hiring_status,
                JSON.stringify(history),
            ]);

            if (rows.length === 0) {
                throw new Error(`Hiring record with ID ${id} not found`);
            }

            return rows[0];
        } catch (error) {
            console.error("Error while updating the hiring record:", error);
            throw error;
        }
    };

    async deleteHiringRecord(id) {
        if (!id || isNaN(Number(id))) throw new Error("A valid hiring record ID is required.");

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
    };

    async getHiringSummary(month) {
        try {
            if (month) {
                // If filtering by month, fetch visible records using our existing method
                const records = await this.getAllHiringRecords(month);
                
                let total_positions = 0;
                let total_interviewees = 0;
                let total_offers = 0;
                let total_onboarded = 0;

                for (const rec of records) {
                    // Exclude from summary if status in that month is 'On Hold' or 'Closed'
                    if (rec.hiring_status === 'On Hold' || rec.hiring_status === 'Closed') {
                        continue;
                    }

                    if (rec.hiring_status === 'Open') {
                        total_positions += 1;
                    }
                    total_interviewees += rec.interviewees_appeared;
                    total_offers += rec.offers_given;
                    total_onboarded += rec.onboarded_candidates;
                }

                return {
                    total_positions,
                    total_interviewees,
                    total_offers,
                    total_onboarded
                };
            }

            // If no month is filtered, aggregate overall active records directly in SQL
            const query = `
                SELECT
                    COUNT(*) FILTER (WHERE hiring_status = 'Open') AS total_positions,
                    COALESCE(SUM(interviewees_appeared), 0) AS total_interviewees,
                    COALESCE(SUM(offers_given), 0) AS total_offers,
                    COALESCE(SUM(onboarded_candidates), 0) AS total_onboarded
                FROM hiring_information
                WHERE hiring_status <> 'On Hold' AND hiring_status <> 'Closed'
            `;
            const { rows } = await pool.query(query);
            const summary = rows[0];

            return {
                total_positions: Number(summary.total_positions),
                total_interviewees: Number(summary.total_interviewees),
                total_offers: Number(summary.total_offers),
                total_onboarded: Number(summary.total_onboarded),
            };
        } catch (error) {
            console.error('Error in getHiringSummary:', error);
            throw error;
        }
    }
    // ==========================================
    // HIRING TASK SERVICES
    // ==========================================

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
            console.error("Error while creating a task.")
            throw error
        }
    };

    async getAllHiringTasks() {
        const query = "SELECT * FROM hiring_tasks ORDER BY id DESC;";
        try {
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            console.error("Error while fetching hiring tasks")
            throw error
        }
    };

    async getTasksByRange(startDate, endDate) {
        const query = `
      SELECT * FROM hiring_tasks
      WHERE start_date <= $2 AND end_date >= $1
      ORDER BY start_date ASC, id DESC;
    `;

        try {
            const { rows } = await pool.query(query, [startDate, endDate]);
            return rows;
        } catch (error) {
            console.error("Error while fetching tasks by range")
            throw error
        }
    };

    async getTaskById(id) {
        const query = "SELECT * FROM hiring_tasks WHERE id = $1;";

        try {
            const { rows } = await pool.query(query, [id]);

            if (rows.length === 0) {
                throw new Error(`Task with ID ${id} not found`);
            }

            return rows[0];
        } catch (error) {
            console.error("Error while fetching task by ID")
            throw error
        }
    };

    updateTask = async (id, taskData) => {
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
            console.error("Error while updating task")
            throw error
        }
    };

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
    };

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
    };

    async getTaskSummary(startDate, endDate) {
        const query = `
      SELECT
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE completed = TRUE) as completed_tasks,
        COUNT(*) FILTER (WHERE completed = FALSE) as pending_tasks
      FROM hiring_tasks
      WHERE start_date <= $2 AND end_date >= $1;
    `;
        try {
            const { rows } = await pool.query(query, [startDate, endDate]);
            const summary = rows[0];

            return {
                total_tasks: Number(summary.total_tasks),
                completed_tasks: Number(summary.completed_tasks),
                pending_tasks: Number(summary.pending_tasks),
            };
        } catch (error) {
            console.error("Error in getTaskSummary:", error);
            throw error;
        }
    };
}

export default new HrService();
