import cron from "node-cron";
import pool from "../config/database.js";

const API_URL = "https://api.etimeoffice.com/api/DownloadInOutPunchData";

const CRON_SCHEDULE = "*/15 * * * *";
const TIME_ZONE = "Asia/Kolkata";

let syncRunning = false;

// Get the current date in IST as DD/MM/YYYY.
const getTodayIST = () => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
};

// Convert DD/MM/YYYY to YYYY-MM-DD for PostgreSQL DATE.
const toPostgresDate = (dateString) => {
  const [day, month, year] = dateString.split("/");
  return `${year}-${month}-${day}`;
};

const UPSERT_ATTENDANCE_QUERY = `
  INSERT INTO attendance_records (
    empcode,
    employee_name,
    attendance_date,
    in_time,
    out_time,
    work_time,
    over_time,
    break_time,
    status,
    remark,
    erl_out,
    late_in
  )
  VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12
  )
  ON CONFLICT (empcode, attendance_date)
  DO UPDATE SET
    employee_name = EXCLUDED.employee_name,
    in_time       = EXCLUDED.in_time,
    out_time      = EXCLUDED.out_time,
    work_time     = EXCLUDED.work_time,
    over_time     = EXCLUDED.over_time,
    break_time    = EXCLUDED.break_time,
    status        = EXCLUDED.status,
    remark        = EXCLUDED.remark,
    erl_out       = EXCLUDED.erl_out,
    late_in       = EXCLUDED.late_in,
    updated_at    = NOW()
  WHERE ROW(
    attendance_records.employee_name,
    attendance_records.in_time,
    attendance_records.out_time,
    attendance_records.work_time,
    attendance_records.over_time,
    attendance_records.break_time,
    attendance_records.status,
    attendance_records.remark,
    attendance_records.erl_out,
    attendance_records.late_in
  ) IS DISTINCT FROM ROW(
    EXCLUDED.employee_name,
    EXCLUDED.in_time,
    EXCLUDED.out_time,
    EXCLUDED.work_time,
    EXCLUDED.over_time,
    EXCLUDED.break_time,
    EXCLUDED.status,
    EXCLUDED.remark,
    EXCLUDED.erl_out,
    EXCLUDED.late_in
  );
`;

export const syncAttendance = async () => {
  if (syncRunning) {
    console.log("ATTENDANCE CRON: Previous sync is still running. Skipping this run.");
    return;
  }

  syncRunning = true;

  let client;
  let transactionStarted = false;

  try {
    const token = process.env.ETIMEOFFICE_BEARER_TOKEN;

    if (!token) {
      throw new Error("ETIMEOFFICE_BEARER_TOKEN is missing from environment variables.");
    }

    const date = getTodayIST();

    console.log(`ATTENDANCE CRON: Starting sync for ${date}...`);

    const params = new URLSearchParams({
      Empcode: "ALL",
      FromDate: date,
      ToDate: date,
    });

    const response = await fetch(`${API_URL}?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`eTimeOffice API returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.Error === true) {
      throw new Error(result.Msg || "eTimeOffice API reported an error.");
    }

    if (!Array.isArray(result.InOutPunchData)) {
      throw new Error("Invalid API response: InOutPunchData is missing or is not an array.");
    }

    const records = result.InOutPunchData;

    // Do not open a database transaction if there is nothing to sync.
    if (records.length === 0) {
      console.log(`ATTENDANCE CRON: No attendance records returned for ${date}.`);
      return;
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    let insertedOrUpdated = 0;
    let unchanged = 0;

    for (const record of records) {
      if (record.Empcode == null || !record.DateString || record.DateString !== date) {
        throw new Error(
          `Invalid employee code or attendance date: ${JSON.stringify({
            Empcode: record.Empcode,
            DateString: record.DateString,
          })}`
        );
      }

      const values = [
        String(record.Empcode),
        record.Name ?? null,
        toPostgresDate(record.DateString),
        record.INTime ?? null,
        record.OUTTime ?? null,
        record.WorkTime ?? null,
        record.OverTime ?? null,
        record.BreakTime ?? null,
        record.Status ?? null,
        record.Remark ?? null,
        record.Erl_Out ?? null,
        record.Late_In ?? null,
      ];

      const queryResult = await client.query(UPSERT_ATTENDANCE_QUERY, values);

      if (queryResult.rowCount === 1) {
        insertedOrUpdated++;
      } else {
        unchanged++;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    console.log("ATTENDANCE CRON: Sync completed successfully.", {
      date,
      received: records.length,
      insertedOrUpdated,
      unchanged,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("ATTENDANCE CRON: Rollback failed:", rollbackError.message);
      }
    }

    console.error("ATTENDANCE CRON: Sync failed:", error.message);
  } finally {
    if (client) {
      client.release();
    }

    syncRunning = false;
  }
};

export const initAttendanceCron = () => {
  console.log("ATTENDANCE CRON: Scheduling attendance sync every 15 minutes.");

  // Run once when the application starts.
  void syncAttendance();

  // Then run every 15 minutes using Indian Standard Time.
  cron.schedule(
    CRON_SCHEDULE,
    () => {
      void syncAttendance();
    },
    {
      timezone: TIME_ZONE,
    }
  );
};
