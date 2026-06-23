import cron from "node-cron";
import { createNotification } from "../services/notification.service.js";
import { emitToUser } from "../utils/socket.js";
import pool from "../config/database.js"; 

export const initCronJobs = () => {
  // "0 */6 * * *" → every 6 hours
  // "*/2 * * * *" -> every 2 minutes
  cron.schedule("0 */6 * * *", async () => {
    console.log("CRON: Checking for missing PO documents with accepted counter offers...");

    try {
      // 1. Fetch only tenders that haven't been notified yet
      const fetchQuery = `
        SELECT id, tender_id, tender_title, createdby
        FROM tender_information
        WHERE (po IS NULL OR po->>'document_url' IS NULL)
          AND createdby IS NOT NULL
          AND counter_offer->>'acceptance_pdf' IS NOT NULL
          AND counter_offer->>'acceptance_pdf' <> ''
          AND po_missing_notified_at IS NULL
          and tender_completed_at is null;
      `;

      const { rows: missingPoTenders } = await pool.query(fetchQuery);


      if (missingPoTenders.length === 0) {
        return; // Silently exit if nothing new is missing
      }

      for (const tender of missingPoTenders) {
        try {
          const message = `Action Required: The PO document is still missing for Tender "${tender.tender_title}".`;
          const type = 'missing_po';

          // 2. Save notification to database
          const notif = await createNotification(
            tender.createdby, 
            message, 
            type
          );

          // 3. Push real-time via Socket.io
          emitToUser(tender.createdby, 'new_notification', notif);

          // 4. IMPORTANT: Mark this specific tender as notified in the database
          await pool.query(
            `UPDATE public.tender_information SET po_missing_notified_at = NOW() WHERE id = $1`,
            [tender.id]
          );

        } catch (innerError) {
          // Catch errors for individual tenders so one failure doesn't break the whole loop
          console.error(`Failed to process notification for tender ID ${tender.id}:`, innerError.message);
        }
      }

      console.log(`CRON: Successfully sent ${missingPoTenders.length} one-time missing PO notifications.`);

    } catch (error) {
      console.error("CRON Error checking missing POs:", error.message);
    }
  });
};