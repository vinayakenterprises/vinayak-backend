import pool from "../../config/database.js";
import { createNotification } from "../../services/notification.service.js";
import { emitToUser } from "../socket.js";

export const sendNotificationToCrm = async (order_id, message, message_id) => {
  try {
    const crmIdResult = await pool.query(
      `select c.crm from sales_orders so inner join customers c on so.client_name = c.company_name or so.client_name = any(c.child_companies)
          where so.id = $1`,
      [order_id]
    );

    if (crmIdResult.rows.length === 0 || crmIdResult.rows[0].crm === null) {
      throw new Error("Please Assign CRM First");
    }
    const crmId = crmIdResult.rows[0].crm;

    const notif = await createNotification(crmId, `${message}`, `${message_id}`);
    emitToUser(crmId, "new_notification", notif);
  } catch (error) {
    console.log("error while sending notification to crm: ", error);
  }
};

export const sendNotificationToSalesTeamLead = async (order_id, message, message_id) => {
  try {
    const userDetails = await pool.query(
      `select * from users where role = 'Sales Executive Lead' and department = 'Sales' limit 1`
    );

    if (userDetails.rows.length === 0 || userDetails.rows[0].id === null) {
      throw new Error("Please Assign Sales Team Lead First");
    }
    const salesTeamLeadId = userDetails.rows[0].id;

    const notif = await createNotification(salesTeamLeadId, `${message}`, `${message_id}`);
    emitToUser(salesTeamLeadId, "new_notification", notif);
  } catch (error) {
    console.log("error while sending notification to sales team lead: ", error);
  }
};

export const sendNotificationToAccountsTeam = async (order_id, message, message_id) => {
  try {
    const userDetails = await pool.query(
      `select * from users where role = 'Sale Order Executive' and department = 'Accounts' limit 1`
    );

    if (userDetails.rows.length === 0 || userDetails.rows[0].id === null) {
      throw new Error("Please Assign Accounts Team First");
    }
    const accountsTeamId = userDetails.rows[0].id;

    const notif = await createNotification(accountsTeamId, `${message}`, `${message_id}`);
    emitToUser(accountsTeamId, "new_notification", notif);
  } catch (error) {
    console.log("error while sending notification to accounts team: ", error);
  }
};

export const sendNotificationToExecutiveAssistantDash = async (message, message_id) => {
  try {
    const user = await pool.query(`select * from users where role = 'Executive Assistant'`);

    if (user.rows.length === 0 || user.rows[0].id === null) {
      throw new Error("Ea not found");
    }
    const adminId = user.rows[0].id;

    const notif = await createNotification(adminId, `${message}`, `${message_id}`);
    emitToUser(adminId, "new_notification", notif);
  } catch (error) {
    console.log("error while sending notification to admin dashboard: ", error);
  }
};

export const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/**
 * Format a Date or date string to Indian Standard Time (IST) representation
 */
export const formatToIST = (dateInput) => {
  if (!dateInput) return "N/A";
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    const str = String(dateInput);
    const hasTimezone = /([+-]\d{2}:?\d{2}|[+-]\d{2}|[Zz])$/.test(str);
    date = new Date(hasTimezone ? str : str + "Z");
  }

  if (isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Format a Date or date string to a Date-only format (e.g., "Sep 28, 2026") in IST
 */
export const formatDateOnly = (dateInput) => {
  if (!dateInput) return "N/A";
  const comp = getISTComponents(dateInput);
  if (!comp) return "N/A";

  const d = new Date(Date.UTC(comp.year, comp.month, comp.day));
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const WORK_CONFIG = {
  // Standard Working Window (9:30 AM to 6:30 PM IST = 9 hours = 540 minutes per working day)
  DEFAULT_START_TIME: { hour: 9, minute: 30 },
  DEFAULT_END_TIME: { hour: 18, minute: 30 },
  TOTAL_DAILY_MINUTES: 540,

  // Weekly Off: Sunday (0)
  WEEKLY_OFF_DAYS: [0],

  // Official 2026 Company Holiday Calendar
  FULL_HOLIDAYS: {
    "2026-01-26": "Republic Day",
    "2026-03-04": "Holi",
    "2026-03-26": "Rama Navami",
    "2026-08-11": "Sawan Shivratri",
    "2026-08-15": "Independence Day",
    "2026-08-28": "Raksha Bandhan",
    "2026-09-04": "Janmashtami",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-09": "Diwali",
    "2026-11-10": "Govardhan Pooja",
    "2026-11-11": "Bhai Dooj",
  },

  // Future Half Days (Configurable ad-hoc dates with custom window)
  // Format: "YYYY-MM-DD": { start: { hour: 9, minute: 30 }, end: { hour: 13, minute: 30 }, name: "Holiday Eve" }
  HALF_DAYS: {},

  // Future Recurring Half Days (e.g., if Saturday = 6 becomes a half day)
  // Format: 6: { start: { hour: 9, minute: 30 }, end: { hour: 13, minute: 30 } }
  RECURRING_HALF_DAYS: {},
};

export const getISTComponents = (dateInput) => {
  if (!dateInput) return null;
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    const str = String(dateInput).trim();
    if (!str) return null;
    // Check if it's a date-only string like YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-").map(Number);
      return {
        rawDate: null,
        istTimeMs: null,
        year: y,
        month: m - 1,
        day: d,
        dayOfWeek: new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).getUTCDay(),
        hours: 9,
        minutes: 30,
        seconds: 0,
        ms: 0,
        dateString: str,
      };
    }
    const hasTimezone = /([+-]\d{2}:?\d{2}|[+-]\d{2}|[Zz])$/.test(str);
    date = new Date(hasTimezone ? str : str + "Z");
  }

  if (isNaN(date.getTime())) return null;

  // IST offset is fixed +05:30 (330 minutes)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTimeMs = date.getTime() + istOffsetMs;
  const istDate = new Date(istTimeMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();
  const dayOfWeek = istDate.getUTCDay();
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const seconds = istDate.getUTCSeconds();
  const ms = istDate.getUTCMilliseconds();

  const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    rawDate: date,
    istTimeMs,
    year,
    month,
    day,
    dayOfWeek,
    hours,
    minutes,
    seconds,
    ms,
    dateString,
  };
};

/**
 * Creates a Date instance representing the given IST year, month, day, hours, minutes.
 */
export const createISTDate = (year, month, day, hours = 0, minutes = 0, seconds = 0, ms = 0) => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcMs = Date.UTC(year, month, day, hours, minutes, seconds, ms) - istOffsetMs;
  return new Date(utcMs);
};

/**
 * Determines the working window for a specific date (regular day, half day, or holiday/off).
 */
export const getDayWorkingWindow = (dateInput, config = WORK_CONFIG) => {
  const comp = getISTComponents(dateInput);
  if (!comp) return null;

  // 1. Weekly off check (e.g. Sunday)
  if (config.WEEKLY_OFF_DAYS.includes(comp.dayOfWeek)) {
    return null;
  }

  // 2. Full Holiday check
  if (config.FULL_HOLIDAYS[comp.dateString]) {
    return null;
  }

  // 3. Ad-hoc Half Day check
  if (config.HALF_DAYS[comp.dateString]) {
    const hd = config.HALF_DAYS[comp.dateString];
    const startMins = hd.start.hour * 60 + hd.start.minute;
    const endMins = hd.end.hour * 60 + hd.end.minute;
    return {
      dateString: comp.dateString,
      startHour: hd.start.hour,
      startMinute: hd.start.minute,
      endHour: hd.end.hour,
      endMinute: hd.end.minute,
      startMinutesFromMidnight: startMins,
      endMinutesFromMidnight: endMins,
      totalDailyMinutes: Math.max(0, endMins - startMins),
      isHalfDay: true,
      name: hd.name || "Half Day",
    };
  }

  // 4. Recurring Half Day check (e.g., recurring Saturday half-day)
  if (config.RECURRING_HALF_DAYS[comp.dayOfWeek]) {
    const rhd = config.RECURRING_HALF_DAYS[comp.dayOfWeek];
    const startMins = rhd.start.hour * 60 + rhd.start.minute;
    const endMins = rhd.end.hour * 60 + rhd.end.minute;
    return {
      dateString: comp.dateString,
      startHour: rhd.start.hour,
      startMinute: rhd.start.minute,
      endHour: rhd.end.hour,
      endMinute: rhd.end.minute,
      startMinutesFromMidnight: startMins,
      endMinutesFromMidnight: endMins,
      totalDailyMinutes: Math.max(0, endMins - startMins),
      isHalfDay: true,
      name: "Recurring Half Day",
    };
  }

  // 5. Regular Working Day (9:30 AM to 6:30 PM IST)
  const startMins = config.DEFAULT_START_TIME.hour * 60 + config.DEFAULT_START_TIME.minute;
  const endMins = config.DEFAULT_END_TIME.hour * 60 + config.DEFAULT_END_TIME.minute;
  return {
    dateString: comp.dateString,
    startHour: config.DEFAULT_START_TIME.hour,
    startMinute: config.DEFAULT_START_TIME.minute,
    endHour: config.DEFAULT_END_TIME.hour,
    endMinute: config.DEFAULT_END_TIME.minute,
    startMinutesFromMidnight: startMins,
    endMinutesFromMidnight: endMins,
    totalDailyMinutes: config.TOTAL_DAILY_MINUTES,
    isHalfDay: false,
    name: null,
  };
};

/**
 * Core Forward Calculation: Adds `hoursToAdd` of pure working time to `startDateInput`.
 * Skips non-working hours, Sundays, holidays, and accounts for half days.
 * Returns a JavaScript Date object.
 */
export const addWorkingHours = (startDateInput, hoursToAdd, config = WORK_CONFIG) => {
  if (!startDateInput || hoursToAdd == null || isNaN(hoursToAdd)) return null;
  if (hoursToAdd <= 0) {
    const comp = getISTComponents(startDateInput);
    return comp ? createISTDate(comp.year, comp.month, comp.day, comp.hours, comp.minutes) : null;
  }

  let remainingMinutes = Math.round(hoursToAdd * 60);
  let comp = getISTComponents(startDateInput);
  if (!comp) return null;

  let currentYear = comp.year;
  let currentMonth = comp.month;
  let currentDay = comp.day;
  let currentMinutesFromMidnight = comp.hours * 60 + comp.minutes + comp.seconds / 60;

  let iterations = 0;
  const maxIterations = 365 * 2; // Safeguard against infinite loop

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;
    const testDate = createISTDate(currentYear, currentMonth, currentDay, 12, 0);
    const window = getDayWorkingWindow(testDate, config);

    // If non-working day (Sunday or Holiday), roll to next day at 00:00
    if (!window) {
      const nextDay = new Date(Date.UTC(currentYear, currentMonth, currentDay + 1));
      currentYear = nextDay.getUTCFullYear();
      currentMonth = nextDay.getUTCMonth();
      currentDay = nextDay.getUTCDate();
      currentMinutesFromMidnight = 0;
      continue;
    }

    // Snap forward to start of working window if earlier
    if (currentMinutesFromMidnight < window.startMinutesFromMidnight) {
      currentMinutesFromMidnight = window.startMinutesFromMidnight;
    }

    // If current time is past the end of today's working window, roll to next day
    if (currentMinutesFromMidnight >= window.endMinutesFromMidnight) {
      const nextDay = new Date(Date.UTC(currentYear, currentMonth, currentDay + 1));
      currentYear = nextDay.getUTCFullYear();
      currentMonth = nextDay.getUTCMonth();
      currentDay = nextDay.getUTCDate();
      currentMinutesFromMidnight = 0;
      continue;
    }

    // Available working minutes today
    const availableToday = window.endMinutesFromMidnight - currentMinutesFromMidnight;

    if (remainingMinutes <= availableToday) {
      const finalMinuteOfDay = currentMinutesFromMidnight + remainingMinutes;
      const finalHour = Math.floor(finalMinuteOfDay / 60);
      const finalMinute = Math.round(finalMinuteOfDay % 60);
      return createISTDate(currentYear, currentMonth, currentDay, finalHour, finalMinute, 0);
    } else {
      // Consume today's available working minutes and roll to next day
      remainingMinutes -= availableToday;
      const nextDay = new Date(Date.UTC(currentYear, currentMonth, currentDay + 1));
      currentYear = nextDay.getUTCFullYear();
      currentMonth = nextDay.getUTCMonth();
      currentDay = nextDay.getUTCDate();
      currentMinutesFromMidnight = 0;
    }
  }

  return null;
};

/**
 * Core Difference Calculation: Calculates elapsed working hours between planned and actual.
 * Ignores overnight hours, Sundays, and official holidays.
 * Returns positive hours if actual > planned (overdue/late), 0 or negative if on time.
 */
export const getWorkingHoursDiff = (plannedDateInput, actualDateInput, config = WORK_CONFIG) => {
  if (!plannedDateInput) return null;

  const plannedComp = getISTComponents(plannedDateInput);
  if (!plannedComp) return null;

  const actualComp = actualDateInput
    ? getISTComponents(actualDateInput)
    : getISTComponents(new Date());
  if (!actualComp) return null;

  const plannedTimeMs = createISTDate(
    plannedComp.year,
    plannedComp.month,
    plannedComp.day,
    plannedComp.hours,
    plannedComp.minutes,
    plannedComp.seconds
  ).getTime();

  const actualTimeMs = createISTDate(
    actualComp.year,
    actualComp.month,
    actualComp.day,
    actualComp.hours,
    actualComp.minutes,
    actualComp.seconds
  ).getTime();

  if (plannedTimeMs === actualTimeMs) return 0;

  const isNegative = actualTimeMs < plannedTimeMs;
  const startMs = isNegative ? actualTimeMs : plannedTimeMs;
  const endMs = isNegative ? plannedTimeMs : actualTimeMs;

  let totalWorkingMinutes = 0;

  let curDateObj = new Date(startMs);
  const endDayComp = getISTComponents(new Date(endMs));
  const finalDayString = endDayComp.dateString;

  let iterations = 0;
  const maxIterations = 365 * 2;

  while (iterations < maxIterations) {
    iterations++;
    const curComp = getISTComponents(curDateObj);
    const window = getDayWorkingWindow(curDateObj, config);

    if (window) {
      const windowStartMs = createISTDate(
        curComp.year,
        curComp.month,
        curComp.day,
        window.startHour,
        window.startMinute
      ).getTime();

      const windowEndMs = createISTDate(
        curComp.year,
        curComp.month,
        curComp.day,
        window.endHour,
        window.endMinute
      ).getTime();

      const effStart = Math.max(startMs, windowStartMs);
      const effEnd = Math.min(endMs, windowEndMs);

      if (effEnd > effStart) {
        totalWorkingMinutes += (effEnd - effStart) / (1000 * 60);
      }
    }

    if (curComp.dateString === finalDayString) {
      break;
    }

    const nextUtc = new Date(Date.UTC(curComp.year, curComp.month, curComp.day + 1));
    curDateObj = createISTDate(
      nextUtc.getUTCFullYear(),
      nextUtc.getUTCMonth(),
      nextUtc.getUTCDate(),
      0,
      0
    );
  }

  const hoursDiff = totalWorkingMinutes / 60;
  return isNegative ? -hoursDiff : hoursDiff;
};

/**
 * Generic target for delivery date at 6:00 PM IST (18:00 IST)
 * If Sunday or holiday, rolls to next working day at 18:00 IST
 */
export const getPlannedDeliveryTargetDate = (deliveryDateStr, config = WORK_CONFIG) => {
  if (!deliveryDateStr) return null;
  const comp = getISTComponents(deliveryDateStr);
  if (!comp) return null;

  let year = comp.year;
  let month = comp.month;
  let day = comp.day;

  // Target 18:00 (6:00 PM) IST
  let target = createISTDate(year, month, day, 18, 0);
  let window = getDayWorkingWindow(target, config);

  // If Sunday or holiday, roll to next working day 18:00 IST
  if (!window) {
    target = addWorkingHours(createISTDate(year, month, day, 9, 30), 8.5, config);
  }
  return target;
};

/* =========================================================================
   Stage-Specific Planned Getters
   ========================================================================= */

// 1. SO Generation: created_at + 2 working hours
export const getPlannedSOTime = (createdAtStr) => {
  if (!createdAtStr) return "N/A";
  try {
    const planned = addWorkingHours(createdAtStr, 2);
    return planned ? formatToIST(planned) : createdAtStr;
  } catch (err) {
    console.error(err);
    return createdAtStr;
  }
};

// 2. Delivery Date Time Str: 6:00 PM IST formatted
export const getPlannedDateTimeStr = (deliveryDateStr) => {
  if (!deliveryDateStr) return "N/A";
  try {
    const target = getPlannedDeliveryTargetDate(deliveryDateStr);
    if (!target) return deliveryDateStr;
    const comp = getISTComponents(target);
    const d = new Date(Date.UTC(comp.year, comp.month, comp.day));
    const dateFormatted = d.toLocaleDateString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `${dateFormatted}, 6:00 PM`;
  } catch (err) {
    console.error(err);
    return deliveryDateStr;
  }
};

// 3. PO Generation: sent_for_po_at + 24 working hours
export const getPlannedPoTime = (soSentAtStr) => {
  if (!soSentAtStr) return "N/A";
  try {
    const planned = addWorkingHours(soSentAtStr, 24);
    return planned ? formatToIST(planned) : soSentAtStr;
  } catch (err) {
    console.error(err);
    return soSentAtStr;
  }
};

// 4. Invoice & Dispatch: delivery_date at 6:00 PM IST
export const getPlannedInvoiceTime = (deliveryDateStr) => {
  if (!deliveryDateStr) return "NA";
  try {
    const target = getPlannedDeliveryTargetDate(deliveryDateStr);
    return target ? formatToIST(target) : "NA";
  } catch (err) {
    console.error(err);
    return "NA";
  }
};

// 5. Intimation: invoice_completed_at + 17 working hours
export const getPlannedIntimationTime = (invoiceCompletedAtStr) => {
  if (!invoiceCompletedAtStr) return "NA";
  try {
    const planned = addWorkingHours(invoiceCompletedAtStr, 17);
    return planned ? formatToIST(planned) : "NA";
  } catch (err) {
    console.error(err);
    return "NA";
  }
};

// Compatibility alias for Date object return
export const getPlannedIntimationDate = (invoiceCompletedAtStr, config = WORK_CONFIG) => {
  if (!invoiceCompletedAtStr) return null;
  try {
    return addWorkingHours(invoiceCompletedAtStr, 17, config);
  } catch (err) {
    console.error(err);
    return null;
  }
};

// 6. Receiving Proof: intimation_completed_at + 9 working hours (fallback: invoice + 17h + 9h)
export const getPlannedReceivingTime = (intimationCompletedAtStr, invoiceCompletedAtStr) => {
  try {
    if (intimationCompletedAtStr) {
      const planned = addWorkingHours(intimationCompletedAtStr, 9);
      if (planned) return formatToIST(planned);
    }
    if (invoiceCompletedAtStr) {
      const intimationPlanned = addWorkingHours(invoiceCompletedAtStr, 17);
      const planned = addWorkingHours(intimationPlanned, 9);
      if (planned) return formatToIST(planned);
    }
  } catch (err) {
    console.error(err);
  }
  return "NA";
};

// Compatibility alias for Date object return
export const getPlannedReceivingDate = (
  intimationCompletedAtStr,
  invoiceCompletedAtStr,
  config = WORK_CONFIG
) => {
  try {
    if (intimationCompletedAtStr) {
      const planned = addWorkingHours(intimationCompletedAtStr, 9, config);
      if (planned) return planned;
    }
    if (invoiceCompletedAtStr) {
      const intimationPlanned = addWorkingHours(invoiceCompletedAtStr, 17, config);
      if (intimationPlanned) {
        return addWorkingHours(intimationPlanned, 9, config);
      }
    }
  } catch (err) {
    console.error(err);
  }
  return null;
};

// 7. Delivery & Weight: actual_dispatch_date + 9 working hours (1 working day)
export const getPlannedDeliveryAndWeightTime = (actualDispatchDateStr) => {
  if (!actualDispatchDateStr) return "N/A";
  try {
    const planned = addWorkingHours(actualDispatchDateStr, 9);
    return planned ? formatToIST(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// Compatibility alias for Date object return
export const getPlannedDeliveryAndWeightDate = (baseDateStr, config = WORK_CONFIG) => {
  if (!baseDateStr) return null;
  try {
    return addWorkingHours(baseDateStr, 9, config);
  } catch (err) {
    console.error(err);
    return null;
  }
};

// 8. CN / DN Note: actual_delivery_date + 9 working hours (1 working day)
export const getPlannedCnDnTime = (actualDeliveryDateStr) => {
  if (!actualDeliveryDateStr) return "N/A";
  try {
    const planned = addWorkingHours(actualDeliveryDateStr, 9);
    return planned ? formatDateOnly(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// 9. Payment: actual_dispatch_date + 90 working hours (10 working days)
export const getPlannedPaymentTime = (actualDispatchDateStr) => {
  if (!actualDispatchDateStr) return "N/A";
  try {
    const planned = addWorkingHours(actualDispatchDateStr, 90);
    return planned ? formatDateOnly(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// 10. Interest Note Issue: payment_done_at + 9 working hours (1 working day)
export const getPlannedInterestNoteTime = (paymentDoneAtStr) => {
  if (!paymentDoneAtStr) return "N/A";
  try {
    const planned = addWorkingHours(paymentDoneAtStr, 9);
    return planned ? formatDateOnly(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// 11. Interest Note Collection: interest_note_issued_on + 45 working hours (5 working days)
export const getPlannedInterestNoteCollectionTime = (interestNoteIssuedOnTimestampStr) => {
  if (!interestNoteIssuedOnTimestampStr) return "N/A";
  try {
    const planned = addWorkingHours(interestNoteIssuedOnTimestampStr, 45);
    return planned ? formatDateOnly(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// 12. Quality Confirmation: actual_delivery_date + 36 working hours (4 working days)
export const getPlannedQualityConfirmationTime = (actualDeliveryDateStr) => {
  if (!actualDeliveryDateStr) return "N/A";
  try {
    const planned = addWorkingHours(actualDeliveryDateStr, 36);
    return planned ? formatDateOnly(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// 13. Complaint - Call Action: complaint_created_at + 2 working hours
export const getPlannedCallActionTime = (createdAtStr) => {
  if (!createdAtStr) return "N/A";
  try {
    const planned = addWorkingHours(createdAtStr, 2);
    return planned ? formatToIST(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

// 14. Complaint - Plant Visit: call_action_actual_date + 9 working hours (1 working day)
export const getPlannedPlantVisitTime = (callActionActualDateStr) => {
  if (!callActionActualDateStr) return "N/A";
  try {
    const planned = addWorkingHours(callActionActualDateStr, 9);
    return planned ? formatToIST(planned) : "N/A";
  } catch (err) {
    console.error(err);
    return "N/A";
  }
};

/* =========================================================================
   Stage-Specific Late Hours Getters (Elapsed Working Hours)
   ========================================================================= */

// SO Generation Late Hours
export const getLateHoursSO = (createdAtStr, completedAtStr) => {
  if (!createdAtStr) return null;
  try {
    const planned = addWorkingHours(createdAtStr, 2);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, completedAtStr);
    if (completedAtStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// PO Generation Late Hours
export const getLateHoursPo = (sentForSoAtStr, poCompletedAtStr) => {
  if (!sentForSoAtStr) return null;
  try {
    const planned = addWorkingHours(sentForSoAtStr, 24);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, poCompletedAtStr);
    if (poCompletedAtStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Generic Late Hours for Delivery / Vehicle Arrangement
export const getLateHours = (deliveryDateStr, actualDateStr) => {
  if (!deliveryDateStr) return null;
  try {
    const planned = getPlannedDeliveryTargetDate(deliveryDateStr);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, actualDateStr);
    if (actualDateStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Invoice Late Hours
export const getLateHoursInvoice = (deliveryDateStr, invoiceCompletedAtStr) => {
  if (!deliveryDateStr) return null;
  try {
    const planned = getPlannedDeliveryTargetDate(deliveryDateStr);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, invoiceCompletedAtStr);
    if (invoiceCompletedAtStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Dispatch Late Hours
export const getLateHoursDispatch = (deliveryDateStr, completedAtStr) => {
  return getLateHoursInvoice(deliveryDateStr, completedAtStr);
};

// Intimation Late Hours
export const getLateHoursIntimation = (invoiceCompletedAtStr, intimatedCompletedAtStr) => {
  if (!invoiceCompletedAtStr) return null;
  try {
    const planned = addWorkingHours(invoiceCompletedAtStr, 17);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, intimatedCompletedAtStr);
    if (intimatedCompletedAtStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Receiving Proof Late Hours
export const getLateHoursReceiving = (
  intimationCompletedAtStr,
  invoiceCompletedAtStr,
  receivingCompletedAtStr
) => {
  try {
    let planned = null;
    if (intimationCompletedAtStr) {
      planned = addWorkingHours(intimationCompletedAtStr, 9);
    } else if (invoiceCompletedAtStr) {
      const intimationPlanned = addWorkingHours(invoiceCompletedAtStr, 17);
      planned = addWorkingHours(intimationPlanned, 9);
    }

    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, receivingCompletedAtStr);
    if (receivingCompletedAtStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Delivery & Weight Late Hours
export const getLateHoursDeliveryAndWeight = (actualDispatchDateStr, actualDeliveryDateStr) => {
  if (!actualDispatchDateStr) return null;
  try {
    const planned = addWorkingHours(actualDispatchDateStr, 9);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, actualDeliveryDateStr);
    if (actualDeliveryDateStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// CN / DN Late Hours
export const getLateHoursCnDn = (actualDeliveryDateStr, cnOrDnIssueTimestampStr) => {
  if (!actualDeliveryDateStr) return null;
  try {
    const planned = addWorkingHours(actualDeliveryDateStr, 9);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, cnOrDnIssueTimestampStr);
    if (cnOrDnIssueTimestampStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Payment Late Hours
export const getLateHoursPayment = (actualDispatchDateStr, paymentDoneAtStr) => {
  if (!actualDispatchDateStr) return null;
  try {
    const planned = addWorkingHours(actualDispatchDateStr, 90);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, paymentDoneAtStr);
    if (paymentDoneAtStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Interest Note Late Hours
export const getLateHoursInterestNote = (paymentDoneAtStr, interestNoteIssuedOnTimestampStr) => {
  if (!paymentDoneAtStr) return null;
  try {
    const planned = addWorkingHours(paymentDoneAtStr, 9);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, interestNoteIssuedOnTimestampStr);
    if (interestNoteIssuedOnTimestampStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Interest Note Collection Late Hours
export const getLateHoursInterestNoteCollection = (
  interestNoteIssuedOnTimestampStr,
  interestNoteCollectedOnTimestampStr
) => {
  if (!interestNoteIssuedOnTimestampStr) return null;
  try {
    const planned = addWorkingHours(interestNoteIssuedOnTimestampStr, 45);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, interestNoteCollectedOnTimestampStr);
    if (interestNoteCollectedOnTimestampStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Quality Confirmation Late Hours
export const getLateHoursQualityConfirmation = (
  actualDeliveryDateStr,
  qualityConfirmationTimestampStr
) => {
  if (!actualDeliveryDateStr) return null;
  try {
    const planned = addWorkingHours(actualDeliveryDateStr, 36);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, qualityConfirmationTimestampStr);
    if (qualityConfirmationTimestampStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Call Action Late Hours (Complaints)
export const getLateHoursCallAction = (createdAtStr, actualDateStr) => {
  if (!createdAtStr) return null;
  try {
    const planned = addWorkingHours(createdAtStr, 2);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, actualDateStr);
    if (actualDateStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// Plant Visit Late Hours (Complaints)
export const getLateHoursPlantVisit = (actualDateStr, callActionActualDateStr) => {
  if (!callActionActualDateStr) return null;
  try {
    const planned = addWorkingHours(callActionActualDateStr, 9);
    if (!planned) return null;
    const diff = getWorkingHoursDiff(planned, actualDateStr);
    if (actualDateStr) return diff;
    return diff > 0 ? diff : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 * Formats elapsed working delay between a planned date and actual date (default now)
 * into human-readable business days and hours based on WORK_CONFIG (9h per day).
 * E.g., "1d 4h late", "3h late", "< 1h late".
 * Returns null if not overdue (<= 0 working hours).
 */
export const formatWorkingDelay = (
  plannedDateInput,
  actualDateInput = new Date(),
  config = WORK_CONFIG
) => {
  if (!plannedDateInput) return null;
  const diffHours = getWorkingHoursDiff(plannedDateInput, actualDateInput, config);
  if (diffHours === null || diffHours <= 0) return null;

  const dailyHours = config.TOTAL_DAILY_MINUTES ? config.TOTAL_DAILY_MINUTES / 60 : 9;
  const days = Math.floor(diffHours / dailyHours);
  const hours = Math.floor(diffHours % dailyHours);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h late` : `${days}d late`;
  }

  const rounded = Math.round(diffHours);
  return rounded > 0 ? `${rounded}h late` : `< 1h late`;
};

/**
 * Calculates working delay and status for Vehicle Executive based on WORK_CONFIG.
 * Considers 18:00 (6:00 PM IST) cutoff and rolls Sunday/holiday to next working day.
 */
export const getVehicleWorkingDelay = (
  deliveryDateInput,
  actualDateInput = new Date(),
  config = WORK_CONFIG
) => {
  if (!deliveryDateInput) {
    return {
      isOverdue: false,
      delayText: "Pending",
      plannedDate: "Not Set",
      plannedTargetDate: null,
    };
  }

  const plannedTargetDate = getPlannedDeliveryTargetDate(deliveryDateInput, config);
  if (!plannedTargetDate) {
    return {
      isOverdue: false,
      delayText: "Pending",
      plannedDate: "Not Set",
      plannedTargetDate: null,
    };
  }

  const diffHours = getWorkingHoursDiff(plannedTargetDate, actualDateInput, config);

  if (diffHours === null) {
    return {
      isOverdue: false,
      delayText: "Pending",
      plannedDate: dateFormatter.format(plannedTargetDate),
      plannedTargetDate,
    };
  }

  if (diffHours <= 0) {
    return {
      isOverdue: false,
      delayText: "Within Limit",
      plannedDate: dateFormatter.format(plannedTargetDate),
      plannedTargetDate,
    };
  }

  const dailyHours = config.TOTAL_DAILY_MINUTES ? config.TOTAL_DAILY_MINUTES / 60 : 9;
  const days = Math.floor(diffHours / dailyHours);
  const hours = Math.floor(diffHours % dailyHours);

  let delayText;
  if (days > 0) {
    delayText = hours > 0 ? `Overdue (${days}d ${hours}h)` : `Overdue (${days}d)`;
  } else {
    const rounded = Math.round(diffHours);
    delayText = rounded > 0 ? `Overdue (${rounded}h)` : `Overdue (< 1h)`;
  }

  return {
    isOverdue: true,
    delayText,
    plannedDate: dateFormatter.format(plannedTargetDate),
    plannedTargetDate,
  };
};

export const sendNotificationToPurchaseExecutive = async (order_id, message, message_id) => {
  try {
    const userDetails = await pool.query(
      `select * from users where role = 'Purchase Executive' and department = 'Purchase' limit 1`
    );

    if (userDetails.rows.length === 0 || userDetails.rows[0].id === null) {
      throw new Error("Please Assign Purchase Team First");
    }
    const purchaseExecutiveId = userDetails.rows[0].id;

    const notif = await createNotification(purchaseExecutiveId, `${message}`, `${message_id}`);
    emitToUser(purchaseExecutiveId, "new_notification", notif);
  } catch (error) {
    console.log("error while sending notification to purchase executive: ", error);
  }
};
