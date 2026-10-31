import cron from "node-cron";
import { createNotification } from "../services/notification.service.js";
import { emitToUser } from "../utils/socket.js";
import pool from "../config/database.js";
import { sendMail } from "../services/mail.service.js";
import imsService from "../services/ims.service.js";
import {
  addWorkingHours,
  sendNotificationToExecutiveAssistantDash,
} from "../utils/helpers/helper-functions.js";
import o2dService from "../services/o2d.service.js";

export const initCronJobs = () => {
  // "0 */6 * * *" → every 6 hours
  // "*/2 * * * *" -> every 2 minutes
  cron.schedule("0 */6 * * *", async () => {
    console.log("CRON: Checking for missing PO documents with accepted counter offers...");

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
          const notif = await createNotification(tender.createdby, message, type);

          // 3. Push real-time via Socket.io
          emitToUser(tender.createdby, "new_notification", notif);

          // 4. IMPORTANT: Mark this specific tender as notified in the database
          await pool.query(
            `UPDATE public.tender_information SET po_missing_notified_at = NOW() WHERE id = $1`,
            [tender.id]
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
            console.log(`Error sending missing PO mail to ${tender.user_email}:`, mailError);
          }
        } catch (innerError) {
          // Catch errors for individual tenders so one failure doesn't break the whole loop
          console.error(
            `Failed to process notification for tender ID ${tender.id}:`,
            innerError.message
          );
        }
      }

      console.log(
        `CRON: Successfully sent ${missingPoTenders.length} one-time missing PO notifications.`
      );
    } catch (error) {
      console.error("CRON Error checking missing POs:", error.message);
    }
  });

  // Stock level alerts for Purchase Executive at 4:00 PM (16:00) every day
  cron.schedule("0 16 * * *", async () => {
    console.log("CRON: Checking stock levels for Purchase Executive at 4:00 PM...");
    try {
      await imsService.checkCategoryStockLevelsAndNotify();
    } catch (error) {
      console.error("CRON Error during stock status check:", error.message);
    }
  });

  // sending notification to EA(Versha Mam) for pending work of vehicle executive
  cron.schedule(
    "0 */3 * * *",
    async () => {
      console.log(
        "CRON: Checking pending work of CRM, Vehicle & Invoice executive every 3 hours..."
      );

      try {
        // 1. Vikas: Vehicle arrangement documents pending
        const pendingVikasOrders = await pool.query(`
        SELECT *
        FROM public.sales_orders
        WHERE vehicle_arrangement @> '{"assigned_to_vehicle_executive": true}'::jsonb
          AND NOT (vehicle_arrangement ? 'actual_deliver_date');
      `);

        // 2. Gagan: Invoice completion timestamp missing
        const pendingGaganOrdersNotFetched = await pool.query(`
        SELECT *
        FROM public.sales_orders
        WHERE delivery_date IS NOT NULL
          AND delivery_date <= CURRENT_DATE
          AND NOT (invoice_and_dispatch ? 'invoice_completed_at')
        ORDER BY id;
      `);

        // 3. Gagan: Get pending Invoice Pdf, Bilty, and Kanta Parchi documents
        const pendingGaganOrders = await pool.query(`
        SELECT
        so.id AS sale_order_id,
        so.delivery_date,

        ARRAY_REMOVE(
            ARRAY[
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(
                            CASE
                                WHEN jsonb_typeof(so.invoice_and_dispatch->'invoices') = 'array'
                                THEN so.invoice_and_dispatch->'invoices'
                                ELSE '[]'::jsonb
                            END
                        ) AS inv
                        WHERE NULLIF(TRIM(inv->>'invoice'), '') IS NOT NULL
                          AND (
                              NOT (inv ? 'invoice_url')
                              OR inv->'invoice_url' = 'null'::jsonb
                              OR NULLIF(TRIM(inv->>'invoice_url'), '') IS NULL
                          )
                    )
                    THEN 'Invoice PDF'
                END,

                CASE
                    WHEN NULLIF(TRIM(so.vehicle_arrangement->>'bilty_url'), '') IS NULL
                    THEN 'Bilty'
                END,

                CASE
                    WHEN NULLIF(TRIM(so.vehicle_arrangement->>'kanta_parchi_url'), '') IS NULL
                    THEN 'Kanta Parchi'
                END
            ],
            NULL
        ) AS pending_documents,

        ARRAY(
            SELECT inv->>'invoice'
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(so.invoice_and_dispatch->'invoices') = 'array'
                    THEN so.invoice_and_dispatch->'invoices'
                    ELSE '[]'::jsonb
                END
            ) AS inv
            WHERE NULLIF(TRIM(inv->>'invoice'), '') IS NOT NULL
        ) AS invoice_numbers

    FROM public.sales_orders so

    WHERE
        EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(so.invoice_and_dispatch->'invoices') = 'array'
                    THEN so.invoice_and_dispatch->'invoices'
                    ELSE '[]'::jsonb
                END
            ) AS inv
            WHERE NULLIF(TRIM(inv->>'invoice'), '') IS NOT NULL
              AND (
                  NOT (inv ? 'invoice_url')
                  OR inv->'invoice_url' = 'null'::jsonb
                  OR NULLIF(TRIM(inv->>'invoice_url'), '') IS NULL
              )
        )

        OR NULLIF(TRIM(so.vehicle_arrangement->>'bilty_url'), '') IS NULL

        OR NULLIF(TRIM(so.vehicle_arrangement->>'kanta_parchi_url'), '') IS NULL

    ORDER BY so.id;

      `);

        // 4. CRM: Get orders with pending Intimation, Receiving Proof, or Delivery & Weight & Quality
        const pendingCrmOrders = await pool.query(`
        SELECT
          so.id,
          so.client_name,
          so.delivery_date,
          so.invoice_and_dispatch,
          so.intimation_thankyou,
          so.receiving_details,
          so.delivery_and_weight
        FROM public.sales_orders so
        WHERE (
          so.invoice_and_dispatch ? 'invoice_completed_at'
          OR so.invoice_and_dispatch ? 'actual_dispatch_date'
        )
        AND (
          -- A. Intimation pending
          (
            so.invoice_and_dispatch ? 'invoice_completed_at'
            AND NULLIF(TRIM(so.invoice_and_dispatch->>'invoice_completed_at'), '') IS NOT NULL
            AND (
              so.intimation_thankyou IS NULL
              OR NOT (so.intimation_thankyou ? 'completed_at')
              OR NULLIF(TRIM(so.intimation_thankyou->>'completed_at'), '') IS NULL
            )
          )
          OR
          -- B. Receiving Proof pending
          (
            so.invoice_and_dispatch ? 'invoice_completed_at'
            AND NULLIF(TRIM(so.invoice_and_dispatch->>'invoice_completed_at'), '') IS NOT NULL
            AND (
              so.receiving_details IS NULL
              OR NOT (so.receiving_details ? 'completion_timestamp')
              OR NULLIF(TRIM(so.receiving_details->>'completion_timestamp'), '') IS NULL
            )
          )
          OR
          -- C. Delivery & Weight & Quality pending
          (
            so.delivery_and_weight IS NULL
            OR (
              NULLIF(TRIM(so.delivery_and_weight->>'actual_delivery_timestamp'), '') IS NULL
              AND NULLIF(TRIM(so.delivery_and_weight->>'actual_delivery_date'), '') IS NULL
              AND COALESCE(NULLIF(TRIM(so.delivery_and_weight->>'delivery_status'), ''), '') != 'Delivered'
            )
          )
        )
        ORDER BY so.id;
      `);

        // Stop if there are no pending tasks
        if (
          pendingVikasOrders.rows.length === 0 &&
          pendingGaganOrdersNotFetched.rows.length === 0 &&
          pendingGaganOrders.rows.length === 0 &&
          pendingCrmOrders.rows.length === 0
        ) {
          console.log("CRON: No pending tasks for CRM, Vikas and Gagan.");
          return;
        }

        // Vikas: Vehicle executive documents pending
        for (const order of pendingVikasOrders.rows) {
          if (!order.delivery_date) {
            continue;
          }

          const plannedDate = new Date(order.delivery_date).getTime() + 18 * 60 * 60 * 1000;

          if (Date.now() > plannedDate) {
            const message = `Order Id #${order.id} documents are not uploaded by Vehicle Executive.`;
            const message_id = "vehicle_executive_late_work";

            await sendNotificationToExecutiveAssistantDash(message, message_id);
          }
        }

        // Gagan: Invoice completion timestamp missing
        for (const order of pendingGaganOrdersNotFetched.rows) {
          if (!order.delivery_date) {
            continue;
          }

          const plannedDate = new Date(order.delivery_date).getTime() + 18 * 60 * 60 * 1000;

          if (Date.now() > plannedDate) {
            const message = `Order Id #${order.id}: Invoice not fetched yet from Tally.`;
            const message_id = "invoice_not_fetched_late_work";

            await sendNotificationToExecutiveAssistantDash(message, message_id);
          }
        }

        // Gagan: Notify with the specific pending document names
        for (const order of pendingGaganOrders.rows) {
          const pendingDocuments = order.pending_documents || [];

          if (pendingDocuments.length === 0) {
            continue;
          }

          const message =
            `Order Id #${order.sale_order_id}: Pending documents — ` +
            `${pendingDocuments.join(", ")}.`;

          const message_id = "Invoice_Executive_late_work";

          await sendNotificationToExecutiveAssistantDash(message, message_id);
        }

        // 4. CRM: Check late work for Intimation & Thank you, Receiving Proof, and Delivery & Weight & Quality
        const now = Date.now();

        for (const order of pendingCrmOrders.rows) {
          const lateTasks = [];

          const invoiceCompletedAt = order.invoice_and_dispatch?.invoice_completed_at;
          const dispatchDate = order.invoice_and_dispatch?.actual_dispatch_date;
          const intimationCompletedAt = order.intimation_thankyou?.completed_at;

          // A. Intimation & Thank you: invoice_completed_at + 17 working hours
          const isIntimationCompleted = !!(
            order.intimation_thankyou?.completed_at &&
            String(order.intimation_thankyou.completed_at).trim() !== ""
          );

          if (!isIntimationCompleted && invoiceCompletedAt) {
            const plannedIntimation = addWorkingHours(invoiceCompletedAt, 17);
            if (plannedIntimation && now > plannedIntimation.getTime()) {
              lateTasks.push("Intimation & Thank you");
            }
          }

          // B. Receiving Proof: intimation_completed_at + 9 working hours (fallback: invoice_completed_at + 17h + 9h)
          const isReceivingCompleted = !!(
            order.receiving_details?.completion_timestamp &&
            String(order.receiving_details.completion_timestamp).trim() !== ""
          );

          if (!isReceivingCompleted) {
            let plannedReceiving = null;
            if (intimationCompletedAt && String(intimationCompletedAt).trim() !== "") {
              plannedReceiving = addWorkingHours(intimationCompletedAt, 9);
            } else if (invoiceCompletedAt) {
              const plannedIntimation = addWorkingHours(invoiceCompletedAt, 17);
              if (plannedIntimation) {
                plannedReceiving = addWorkingHours(plannedIntimation, 9);
              }
            }

            if (plannedReceiving && now > plannedReceiving.getTime()) {
              lateTasks.push("Receiving Proof");
            }
          }

          // C. Delivery & Weight & Quality: (invoice_completed_at or dispatchDate) + 9 working hours
          const isDeliveryWeightCompleted = !!(
            order.delivery_and_weight?.actual_delivery_timestamp ||
            order.delivery_and_weight?.actual_delivery_date ||
            order.delivery_and_weight?.delivery_status === "Delivered"
          );

          const deliveryBaseDate = invoiceCompletedAt || dispatchDate;
          if (!isDeliveryWeightCompleted && deliveryBaseDate) {
            const plannedDeliveryWeight = addWorkingHours(deliveryBaseDate, 9);
            if (plannedDeliveryWeight && now > plannedDeliveryWeight.getTime()) {
              lateTasks.push("Delivery & Weight & Quality");
            }
          }

          if (lateTasks.length > 0) {
            const message =
              `Order Id #${order.id}: Pending CRM task${lateTasks.length > 1 ? "s" : ""} — ` +
              `${lateTasks.join(", ")}.`;

            const message_id = "CRM_Executive_late_work";
            await sendNotificationToExecutiveAssistantDash(message, message_id);
          }
        }
      } catch (error) {
        console.error("CRON Error during checking late work:", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  // End of Day (18:00 IST) Pending Work Report Email to EA and Admin
  cron.schedule(
    "0 18 * * *",
    async () => {
      console.log("CRON: Triggering 6:00 PM End of Day Pending Work Report...");

      try {
        await o2dService.sendDailyPendingWorkReport();
        console.log("CRON: End of Day Pending Work Report sent successfully.");
      } catch (error) {
        console.error("CRON Error: Failed to send End of Day Pending Work Report:", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  cron.schedule(
    "* * * * *",
    async () => {
      console.log("CRON: Triggering 6:00 PM End of Day Pending Work Report...");

      try {
        await o2dService.sendDailyPendingWorkReport("jr.developer@vinayak-enterprises.com");
        console.log("CRON: End of Day Pending Work Report sent successfully.");
      } catch (error) {
        console.error("CRON Error: Failed to send End of Day Pending Work Report:", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};
