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
