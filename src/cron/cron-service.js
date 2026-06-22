import cron from "node-cron";
import { createNotification } from "../services/notification.service.js";
import { emitToUser } from "../utils/socket.js";
import pool from "../config/database.js"; 

export const initCronJobs = () => {
  // Schedule to run every 2 minutes
  // */2 * * * *  -> every 2 minutes
  // "0 */6 * * *" -> every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    console.log("CRON: Checking for missing PO documents with accepted counter offers...");

    try {
      // Updated query to check the counter_offer JSONB column
      const query = `
        SELECT id, tender_id, tender_title, createdby
        FROM public.tender_information
        WHERE (po IS NULL OR po->>'document_url' IS NULL)
          AND createdby IS NOT NULL
          AND counter_offer->>'acceptance_pdf' IS NOT NULL
          AND counter_offer->>'acceptance_pdf' <> ''; 
      `;

      const { rows: missingPoTenders } = await pool.query(query);

      if (missingPoTenders.length === 0) {
        return; // Silently exit if nothing is missing
      }

      // Loop through the results and trigger notifications to the creator
      for (const tender of missingPoTenders) {
        const message = `Action Required: The PO document is still missing for Tender "${tender.tender_title}".`;
        const type = 'missing_po';

        // 1. Save to database using the 'createdby' identifier
        const notif = await createNotification(
          tender.createdby, 
          message, 
          type
        );

        // 2. Push real-time via Socket.io
        emitToUser(tender.createdby, 'new_notification', notif);
      }

      console.log(`CRON: Sent ${missingPoTenders.length} missing PO notifications to creators.`);

    } catch (error) {
      console.error("CRON Error checking missing POs:", error.message);
    }
  });
};