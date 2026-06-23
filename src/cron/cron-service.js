import cron from "node-cron";
import { createNotification } from "../services/notification.service.js";
import { emitToUser } from "../utils/socket.js";
import pool from "../config/database.js";
import { sendMail } from "../services/mail.service.js";

export const initCronJobs = () => {
  // "0 */6 * * *" → every 6 hours
  // "*/2 * * * *" -> every 2 minutes
  cron.schedule("0 */6 * * *", async () => {
    console.log(
      "CRON: Checking for missing PO documents with accepted counter offers...",
    );

    try {
      // 1. Fetch only tenders that haven't been notified yet
      const fetchQuery = `
        SELECT 
            ti.id,
            ti.createdby,
            ti.tender_id,
            ti.tender_title,
            u.email_id as user_email
        FROM tender_information ti
        INNER JOIN users u
            ON ti.createdby::integer = u.id
        WHERE (ti.po IS NULL OR ti.po->>'document_url' IS NULL)
          AND ti.createdby IS NOT NULL
          AND ti.counter_offer->>'acceptance_pdf' IS NOT NULL
          AND ti.counter_offer->>'acceptance_pdf' <> ''
          AND ti.po_missing_notified_at IS NULL
          AND ti.tender_completed_at IS NULL
          AND ti.counter_offer->>'counter_offer_approve_by_md_at' IS NOT NULL
          AND (ti.counter_offer->>'counter_offer_approve_by_md_at')::timestamptz < NOW() - INTERVAL '15 days';
      `;

      const { rows: missingPoTenders } = await pool.query(fetchQuery);

      if (missingPoTenders.length === 0) {
        return; // Silently exit if nothing new is missing
      }

      for (const tender of missingPoTenders) {
        try {
          const message = `Action Required: The PO document is still missing for Tender "${tender.tender_title}".`;
          const type = "missing_po";

          // 2. Save notification to database
          const notif = await createNotification(
            tender.createdby,
            message,
            type,
          );

          // 3. Push real-time via Socket.io
          emitToUser(tender.createdby, "new_notification", notif);

          // 4. IMPORTANT: Mark this specific tender as notified in the database
          await pool.query(
            `UPDATE public.tender_information SET po_missing_notified_at = NOW() WHERE id = $1`,
            [tender.id],
          );

          try {
            await sendMail({
              to: tender.user_email,
              subject: `⏳ Action Required: Missing PO Document - ${tender.tender_id}`,
              templateName: "missing-po-alert",
              replacements: {
                tender_id: tender.tender_id,
                tender_title: tender.tender_title,
                appName: "Mittalu Pvt Ltd",
              },
            });
          } catch (mailError) {
            console.log(
              `Error sending missing PO mail to ${tender.user_email}:`,
              mailError,
            );
          }
        } catch (innerError) {
          // Catch errors for individual tenders so one failure doesn't break the whole loop
          console.error(
            `Failed to process notification for tender ID ${tender.id}:`,
            innerError.message,
          );
        }
      }

      console.log(
        `CRON: Successfully sent ${missingPoTenders.length} one-time missing PO notifications.`,
      );
    } catch (error) {
      console.error("CRON Error checking missing POs:", error.message);
    }
  });
};
