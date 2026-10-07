import pool from "../../config/database.js";
import { createNotification } from "../../services/notification.service.js";
import { emitToUser } from "../socket.js";

export const sendNotificationToCrm = async (order_id, message, message_id) => {
  console.log("dsbsd", order_id, message, message_id);
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
    console.log("dbcd", notif);
    emitToUser(crmId, "new_notification", notif);
  } catch (error) {
    console.log("error while sending notification to crm: ", error);
  }
};
