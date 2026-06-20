import pool from "../config/database.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../errors/customErrors.js";
import { emitToUser } from "../utils/socket.js";

import { sendMail } from "./mail.service.js";
import { createNotification } from "./notification.service.js";

// Column sets per role
const TENDER_AGENT_COLUMNS = [
  "tender_id",
  "tender_ref_no",
  "tender_documents",
  "tender_title",
  "tender_organization",
  "cable_length_km",
  "publish_date",
  "closing_date",
  "tender_value_cr",
  "tender_fee_inr",
  "emd_inr",
  "state",
  "submission_expected",
  "submission_actual",
  "payment_type",
  "submit_to_govt_portal_at",
  "shortfall",
  "docs_resubmitted",
  "rank_file",
  "counter_offer",
  "loi",
  "po",
  "contract_agreement",
  "warranty",
  "acceptance_letter",
  "tender_stage",
];

const MD_COLUMNS = ["approved", "approved_at"];

const ACCOUNTS_COLUMNS = ["payment_type", "emd_inr"];

const VALID_PAYMENT_TYPES = ["dd", "bg", "online_payment"];

class TenderService {
  // ─── helpers ──────────────────────────────────────────────
  _filterColumns(body, allowedColumns) {
    const filtered = {};
    for (const col of allowedColumns) {
      if (body[col] !== undefined) {
        filtered[col] = body[col];
      }
    }
    return filtered;
  }

  _validatePaymentType(paymentType) {
    if (paymentType === null || paymentType === undefined) return;

    if (typeof paymentType !== "object" || Array.isArray(paymentType)) {
      throw new BadRequestError(
        'payment_type must be an object with { url: string, type: "dd" | "bg" | "online_payment" }',
      );
    }

    if (!paymentType.url || typeof paymentType.url !== "string") {
      throw new BadRequestError(
        "payment_type.url is required and must be a string",
      );
    }

    if (!VALID_PAYMENT_TYPES.includes(paymentType.type)) {
      throw new BadRequestError(
        `payment_type.type must be one of: ${VALID_PAYMENT_TYPES.join(", ")}`,
      );
    }
  }

  // ─── get tenders ──────────────────────────────────────────
  async getAllTenders(userId) {
    const { rows } = await pool.query(
      "SELECT * FROM tender_information where createdBy = $1 ORDER BY id DESC",
      [userId],
    );
    return rows;
  }

  async getActiveTenders() {
    try {
      const getActiveTendersQuery = `select * from tender_information where approved is null and send_for_approval = false order by id desc`;
      const { rows } = await pool.query(getActiveTendersQuery);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getPendingMDApprovalTenders(userId) {
    try {
      const getPendingMDApprovalTendersQuery = `select * from tender_information where send_for_approval = true and approved is null and createdBy = $1 order by id desc`;
      const { rows } = await pool.query(getPendingMDApprovalTendersQuery, [
        userId,
      ]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getRejectedTendersForTenderAgent(userId) {
    try {
      const getRejectedTendersForTenderAgentQuery = `select * from tender_information where approved = false and createdBy = $1 order by id desc`;
      const { rows } = await pool.query(getRejectedTendersForTenderAgentQuery, [
        userId,
      ]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getShortfallTenders(userId) {
    try {
      const getShortfallTendersQuery = `select * from tender_information where shortfall = true and createdBy = $1 and tender_completed_at is not null order by id desc`;
      const { rows } = await pool.query(getShortfallTendersQuery, [userId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getCompletedTendersForTenderAgent(userId) {
    try {
      const getCompletedTendersForTenderAgentQuery = `select * from tender_information where tender_completed_at is null and createdBy = $1 order by id desc`;
      const { rows } = await pool.query(
        getCompletedTendersForTenderAgentQuery,
        [userId],
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getApprovedTendersForTenderAgent(userId) {
    try {
      const getApprovedTendersForTenderAgentQuery = `select * from tender_information where approved = true and createdBy = $1 and tender_completed_at is null order by id desc`;
      const { rows } = await pool.query(getApprovedTendersForTenderAgentQuery, [
        userId,
      ]);

      // console.log("rows: ", rows);

      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getCounterOfferRejectedTenderAgent(userId) {
    try {
      const getCounterOfferRejectedTenderAgentQuery = `select * from tender_information where counter_offer->>'counter_offer_approve_by_md' = 'false' and tender_completed_at is not null and createdBy = $1 order by id desc`;
      const { rows } = await pool.query(
        getCounterOfferRejectedTenderAgentQuery,
        [userId],
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async markAsCompleteTenderAfterApprovedByMD(id, userId) {
    try {
      const updateQuery = `
        UPDATE tender_information
        SET tender_completed_at = CURRENT_TIMESTAMP
        WHERE id = $2 and createdBy = $1 returning *
      `;

      const { rows } = await pool.query(updateQuery, [userId, id]);


      try{
        const mdIdQuery = `SELECT id FROM users WHERE role = 'MD'`;
        const mdId = await pool.query(mdIdQuery);
        const mdIdResult = mdId.rows[0].id;

        const notif = await createNotification(
          mdIdResult,
          `Tender Title as ${rows[0].tender_title} has been marked as complete.`,
          "tender_completed_notification",
        );
        emitToUser(mdIdResult, "new_notification", notif);
      }catch(error){
        console.log("error in sending notification: ", error);
      }

      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  async deleteTender(id) {
    try {
      const deleteQuery = `
        DELETE FROM tender_information
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await pool.query(deleteQuery, [id]);
      if (rows.length === 0) {
        throw new NotFoundError(`Tender with id ${id} not found`);
      }

      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  async getTenderById(id) {
    const { rows } = await pool.query(
      "SELECT * FROM tender_information WHERE id = $1",
      [id],
    );
    if (!rows[0]) throw new NotFoundError(`Tender with id ${id} not found`);
    return rows[0];
  }

  async approveTender(id, approveStatus) {
    try {
      // get accounts team data

      const tenderInformationFromDB = await pool.query(
        `SELECT * FROM tender_information WHERE id = $1`,
        [id],
      );

      const createdById = tenderInformationFromDB.rows[0].createdby;

      const approvedAt = new Date();
      const submissionExpected = new Date();
      submissionExpected.setDate(submissionExpected.getDate() + 2);

      let finalRows;

      if (approveStatus === true) {
        const updateQuery = `
        UPDATE tender_information
        SET approved = $1, approved_at = $2, submission_expected = $3, assigned_to = $4 where id = $5
        `;

        const { rows } = await pool.query(updateQuery, [
          approveStatus,
          approvedAt,
          submissionExpected,
          createdById,
          id,
        ]);

        finalRows = rows;
      } else {
        const updateQuery = `
        UPDATE tender_information
        SET approved = $1, approved_at = $2 where id = $3
        `;

        const { rows } = await pool.query(updateQuery, [
          approveStatus,
          approvedAt,
          id,
        ]);

        finalRows = rows;
      }

      try {
        const isApproved = approveStatus === true;

        sendMail({
          to: "rinkusingh805764@gmail.com",
          subject: isApproved
            ? `✅ Tender Approved - ${tenderInformationFromDB.rows[0].tender_ref_no}`
            : `❌ Tender Rejected - ${tenderInformationFromDB.rows[0].tender_ref_no}`,
          templateName: "tender-status", // ← single template for both cases
          replacements: {
            // ── dynamic based on status ──
            header_color: isApproved ? "#1a7f4b" : "#c0392b",
            header_sub_color: isApproved ? "#d4edda" : "#f5c6cb",
            header_icon: isApproved ? "🎉" : "⚠️",
            badge_icon: isApproved ? "✅" : "❌",
            status_text: isApproved ? "Approved" : "Rejected",
            status_text_lower: isApproved ? "approved" : "rejected",
            status_text_upper: isApproved ? "APPROVED" : "REJECTED",
            status_message: isApproved
              ? "We are pleased to inform you that the following tender has been <strong>approved by the MD</strong>. Please proceed with the next steps before the expected submission date."
              : "We regret to inform you that the following tender has been <strong>rejected by the MD</strong>. Please review the details and contact the MD for further clarification.",
            footer_message: isApproved
              ? "Please ensure all required documents are prepared and submitted before the expected date."
              : "If you have any questions, please reach out to your manager for next steps.",
            submission_row: isApproved
              ? `<tr><td>Submission Expected By</td><td>${submissionExpected.toLocaleString("en-IN")}</td></tr>`
              : "", // ← hidden when rejected

            // ── tender data (same for both) ──
            tender_ref_no: tenderInformationFromDB.rows[0].tender_ref_no,
            tender_title: tenderInformationFromDB.rows[0].tender_title,
            tender_organization:
              tenderInformationFromDB.rows[0].tender_organization,
            cable_length_km: tenderInformationFromDB.rows[0].cable_length_km,
            tender_value_cr: tenderInformationFromDB.rows[0].tender_value_cr,
            approved_at: approvedAt.toLocaleString("en-IN"),
            appName: "Mittalu Pvt Ltd",
          },
        });

        // send notification
        const notif = await createNotification(
          createdById,
          `Your Tender with Tender Title as ${tenderInformationFromDB?.rows[0]?.tender_title} ${isApproved ? "has been approved." : "has been rejected."}.`,
          "tender_approval_status",
        );
        emitToUser(createdById, "new_notification", notif);
      } catch (error) {
        console.log("error in sending mail: ", error);
      }

      return finalRows[0];
    } catch (error) {
      throw error;
    }
  }

  async approveCounterOfferTender(id, approveStatus) {
    try {
      const counterOfferApproveQuery = `UPDATE tender_information
    SET counter_offer = counter_offer || jsonb_build_object(
        'counter_offer_approve_by_md', $1::boolean,
        'counter_offer_approve_by_md_at', CURRENT_TIMESTAMP
    )
    WHERE id = $2
    RETURNING *;`;

      const { rows } = await pool.query(counterOfferApproveQuery, [
        approveStatus,
        id,
      ]);

      const tenderData = rows[0];

      try {
        const isApproved = approveStatus === true;

        // Format timestamp for exactly when the action occurred
        const actionTime = new Date().toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        });

        sendMail({
          to: "rinkusingh805764@gmail.com",
          subject: isApproved
            ? `✅ Counter Offer Approved - ${tenderData.tender_ref_no || "N/A"}`
            : `❌ Counter Offer Rejected - ${tenderData.tender_ref_no || "N/A"}`,

          templateName: "counter-offer-status-mail", // The single template that handles both states

          replacements: {
            // -----------------------------------------------------
            // 1. Dynamic Status Variables (Colors, Text, UI)
            // -----------------------------------------------------
            header_bg_color: isApproved ? "#27ae60" : "#c0392b", // Green vs Red
            header_icon: isApproved ? "✅" : "❌",
            status_heading: isApproved
              ? "Counter Offer Approved"
              : "Counter Offer Rejected",

            banner_bg_color: isApproved ? "#e8f8f5" : "#fdecea",
            banner_border_color: isApproved ? "#27ae60" : "#c0392b",
            banner_text_color: isApproved ? "#1a5232" : "#78281f",

            status_message_html: isApproved
              ? "Good news! The Managing Director has <strong>approved</strong> your counter offer request. You can now proceed with the tender submission."
              : "The Managing Director has <strong>rejected</strong> your counter offer request. Please log in to review the feedback and adjust the margins.",

            status_label: isApproved ? "Approved On" : "Rejected On",
            action_time: actionTime,

            cta_bg_color: isApproved ? "#2ecc71" : "#e74c3c",
            cta_button_text: isApproved
              ? "Proceed to Submission"
              : "Review Details",
            // action_url: isApproved
            //   ? `https://your-frontend-domain.com/tenders/submission/${tenderData.id}`
            //   : `https://your-frontend-domain.com/tenders/counter-offer/${tenderData.id}`, // Change these routes to match your frontend architecture

            // -----------------------------------------------------
            // 2. Standard Tender Data Mapping
            // -----------------------------------------------------
            tender_id: tenderData.tender_id,
            tender_ref_no: tenderData.tender_ref_no || "N/A",
            tender_title: tenderData.tender_title,
            tender_organization: tenderData.tender_organization || "N/A",
            state: tenderData.state || "N/A",
            cable_length_km: tenderData.cable_length_km || 0,
            tender_value_cr: tenderData.tender_value_cr || 0,

            // Formatted Currency
            tender_fee_inr: tenderData.tender_fee_inr
              ? Number(tenderData.tender_fee_inr).toLocaleString("en-IN")
              : "0",
            emd_inr: tenderData.emd_inr
              ? Number(tenderData.emd_inr).toLocaleString("en-IN")
              : "0",

            // Formatted Dates
            publish_date: tenderData.publish_date
              ? new Date(tenderData.publish_date).toLocaleDateString("en-IN")
              : "N/A",
            closing_date: tenderData.closing_date
              ? new Date(tenderData.closing_date).toLocaleDateString("en-IN")
              : "N/A",

            appName: "Mittalu Pvt Ltd",
          },
        });



        // send notification to tender executive
        const notif = await createNotification(
          tenderData.createdby,
          `Your Counter Offer Request with Tender Title as ${tenderData?.tender_title} ${isApproved ? "has been approved." : "has been rejected."}.`,
          "counter_offer_approval_status",
        );
        

        emitToUser(tenderData.createdby, "new_notification", notif);


      } catch (error) {
        console.log("error in sending mail or notification: ", error);
      }

      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // ─── create tender (tender_agent only) ────────────────────
  async createTender(body, role, userId) {
    if (role !== "tender_agent") {
      throw new ForbiddenError("Only tender_agent can create tenders");
    }

    const {
      tender_id,
      tender_ref_no,
      tender_documents,
      tender_title,
      tender_organization,
      product_name,
      product_type,
      cable_length_km,
      publish_date,
      closing_date,
      tender_value_cr,
      tender_fee_inr,
      emd_inr,
      state,
    } = body;

    const query = `
        INSERT INTO tender_information (
            tender_id,
            tender_ref_no,
            tender_documents,
            tender_title,
            tender_organization,
            cable_length_km,
            publish_date,
            closing_date,
            tender_value_cr,
            tender_fee_inr,
            emd_inr,
            state,
            tender_stage,
            assigned_to,
            createdBy,
            product_name,
            product_type
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13,
            $14, $15, $16, $17
        )
        RETURNING *;
    `;

    const values = [
      tender_id,
      tender_ref_no,
      JSON.stringify(tender_documents || []),
      tender_title,
      tender_organization,
      cable_length_km,
      publish_date,
      closing_date,
      tender_value_cr,
      tender_fee_inr,
      emd_inr,
      state,
      "1",
      userId,
      userId,
      product_name,
      product_type,
    ];

    const result = await pool.query(query, values);

    return result;
  }

  // ─── update tender (role-gated) ───────────────────────────
  async updateTender(id, body, role) {
    // 1. Fetch current tender to check stage
    const tender = await this.getTenderById(id);
    const currentStage = String(tender.tender_stage);

    let allowedColumns = [];

    // 2. Role and Stage Validation using your top-level arrays
    switch (role) {
      case "tender_agent":
        allowedColumns = [...TENDER_AGENT_COLUMNS];
        break;

      case "md":
        if (currentStage !== "2") {
          throw new ForbiddenError(
            "MD can only update tenders at tender_stage 2",
          );
        }
        // Appending 'tender_stage' so the MD can transition the tender to stage 3 or back to 1
        allowedColumns = [...MD_COLUMNS, "tender_stage"];
        break;

      case "accounts":
        if (currentStage !== "3") {
          throw new ForbiddenError(
            "Accounts can only update tenders at tender_stage 3",
          );
        }
        // Appending 'tender_stage' so Accounts can transition the tender to stage 4
        allowedColumns = [...ACCOUNTS_COLUMNS, "tender_stage"];
        break;

      default:
        throw new ForbiddenError(
          "Your role does not have permission to update tenders",
        );
    }

    // 3. Filter the incoming body using your predefined allowed columns list
    const updateData = {};
    for (const key of allowedColumns) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError("No updatable fields provided for your role");
    }

    // 4. Validate and stringify ONLY the actual JSONB fields from your schema
    if (updateData.payment_type !== undefined) {
      this._validatePaymentType(updateData.payment_type);
      updateData.payment_type = updateData.payment_type
        ? JSON.stringify(updateData.payment_type)
        : null;
    }
    if (updateData.tender_documents !== undefined) {
      updateData.tender_documents = updateData.tender_documents
        ? JSON.stringify(updateData.tender_documents)
        : "[]";
    }
    if (updateData.docs_resubmitted !== undefined) {
      updateData.docs_resubmitted = updateData.docs_resubmitted
        ? JSON.stringify(updateData.docs_resubmitted)
        : "[]";
    }

    // 5. Construct the raw SQL SET clause
    const keys = Object.keys(updateData);
    const values = Object.values(updateData);

    // Wraps column names in double quotes to remain perfectly safe from any SQL keywords
    const setClause = keys
      .map((key, index) => `"${key}" = $${index + 1}`)
      .join(", ");

    // Push the ID to the end of the values array for the WHERE clause position
    values.push(id);

    const query = `
      UPDATE tender_information 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async sendForApproval(id, role, userId, userName) {
    try {
      if (role !== "tender_agent") {
        throw new ForbiddenError(
          "Your role does not have permission to send tenders for approval",
        );
      }

      const mdUserData = await pool.query(
        `SELECT id FROM users WHERE role = 'MD'`,
      );
      const mdId = mdUserData.rows[0].id;

      const updateQuery = `
        UPDATE tender_information
        SET send_for_approval = $1, send_for_approval_at = $2,tender_stage = $3, assigned_to = $5  where id = $4 returning *
        `;

      const { rows } = await pool.query(updateQuery, [
        true,
        new Date(),
        2,
        id,
        mdId,
      ]);

      const tenderData = rows[0];

      try {
        sendMail({
          to: "rinkusingh805764@gmail.com",
          subject: `⏳ Action Required: Tender Approval - ${tenderData.tender_ref_no}`,
          templateName: "send-for-approval-mail", // The HTML file created above
          replacements: {
            tender_ref_no: tenderData.tender_ref_no,
            tender_title: tenderData.tender_title,
            tender_organization: tenderData.tender_organization,
            cable_length_km: tenderData.cable_length_km,
            tender_value_cr: tenderData.tender_value_cr,
            // sent_at: sentAt.toLocaleString("en-IN"),
            // action_url: `https://your-frontend-domain.com/tenders/review/${id}`, // Update with your actual URL
            appName: "Mittalu Pvt Ltd",
          },
        });

        // send notification
        const notif = await createNotification(
          mdId,
          `Tender Executive ${userName} sent you a Tender for Approval.`,
          "tender_approval_request",
        );
        emitToUser(mdId, "new_notification", notif);
      } catch (error) {
        console.log("Error sending send-for-approval mail: ", error);
      }

      return tenderData;
    } catch (error) {
      throw error;
    }
  }

  async getApprovalRequestTenders(userId) {
    const getApprovalRequestTendersQuery = `
      SELECT * FROM tender_information
      WHERE assigned_to = $1 AND send_for_approval = true and approved is null AND tender_stage = '2'
      ORDER BY id DESC
    `;
    const { rows } = await pool.query(getApprovalRequestTendersQuery, [userId]);
    return rows;
  }

  async getCounterOfferApprovalRequestTenders(userId) {
    try {
      const getCounterOfferApprovalRequestTendersQuery = `
        SELECT *
        FROM tender_information
        WHERE counter_offer->>'sent_for_approval' = 'true' and counter_offer->>'counter_offer_approve_by_md_at' is null
        ORDER BY id DESC
      `;
      const { rows } = await pool.query(
        getCounterOfferApprovalRequestTendersQuery,
        [],
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getCounterOfferRejectedTenders(userId) {
    try {
      const getCounterOfferRejectedTendersQuery = `
        SELECT * FROM tender_information
        WHERE counter_offer->>'counter_offer_approve_by_md' = 'false'
        ORDER BY id DESC
      `;
      const { rows } = await pool.query(
        getCounterOfferRejectedTendersQuery,
        [],
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getCounterOfferApprovedTenders(userId) {
    try {
      const getCounterOfferApprovedTendersQuery = `
        SELECT * FROM tender_information
        WHERE counter_offer->>'counter_offer_approve_by_md' = 'true'
        ORDER BY id DESC
      `;
      const { rows } = await pool.query(
        getCounterOfferApprovedTendersQuery,
        [],
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getApprovedTenders(userId) {
    const getApprovedTendersQuery = `
      SELECT * FROM tender_information
      WHERE approved = true
      ORDER BY id DESC
    `;


    const { rows } = await pool.query(getApprovedTendersQuery, []);
    return rows;
  }

  async getRejectedTenders(userId) {
    try {
      const getRejectedTendersQuery = `
        SELECT * FROM tender_information
        WHERE approved = false
        ORDER BY id DESC
      `;

      const { rows } = await pool.query(getRejectedTendersQuery, []);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getTendersForAccountsTeam(userId) {
    try {
      const getTendersForAccountsTeamQuery = `
        SELECT * FROM tender_information
        WHERE assigned_to = $1 AND tender_stage = '3'
        ORDER BY id DESC
      `;

      const { rows } = await pool.query(getTendersForAccountsTeamQuery, [
        userId,
      ]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getCompletedTendersForAccountsTeam(userId) {
    try {
      const getCompletedTendersForAccountsTeamQuery = `
        SELECT * FROM tender_information
        WHERE is_accounts_team_work_done = true AND tender_stage = '4'
        ORDER BY id DESC
      `;

      const { rows } = await pool.query(
        getCompletedTendersForAccountsTeamQuery,
        [],
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getTenderCardsCountData() {
    try {
      const totalTendersCountQuery = `select count(*) from tender_information`;
      const totalActiveTendersCountQuery = `select count(*) from tender_information where submission_actual is null`;
      const totalApprovedTendersCountQuery = `select count(*) from tender_information where approved = true`;
      const pendingFromAccountsTeamCountQuery = `select count(*) from tender_information where approved = true and is_accounts_team_work_done = false`;
      const completedTendersCountQuery = `select count(*) from tender_information where submission_actual is not null`;
      const rejectedTendersCountQuery = `select count(*) from tender_information where approved = false`;

      const totalTendersCountResult = await pool.query(totalTendersCountQuery);
      const totalActiveTendersCountResult = await pool.query(
        totalActiveTendersCountQuery,
      );
      const totalApprovedTendersCountResult = await pool.query(
        totalApprovedTendersCountQuery,
      );
      const pendingFromAccountsTeamCountResult = await pool.query(
        pendingFromAccountsTeamCountQuery,
      );
      const completedTendersCountResult = await pool.query(
        completedTendersCountQuery,
      );
      const rejectedTendersCountResult = await pool.query(
        rejectedTendersCountQuery,
      );

      return {
        totalTenders: parseInt(totalTendersCountResult.rows[0].count, 0),
        totalActiveTenders: parseInt(
          totalActiveTendersCountResult.rows[0].count,
          0,
        ),
        totalApprovedTenders: parseInt(
          totalApprovedTendersCountResult.rows[0].count,
          0,
        ),
        pendingFromAccountsTeam: parseInt(
          pendingFromAccountsTeamCountResult.rows[0].count,
          0,
        ),
        completedTenders: parseInt(
          completedTendersCountResult.rows[0].count,
          0,
        ),
        rejectedTenders: parseInt(rejectedTendersCountResult.rows[0].count, 0),
      };
    } catch (error) {
      throw error;
    }
  }

  async getTendersAssignedByAccountsTeam(userId) {
    try {
      const getTendersAssignedByAccountsTeamQuery = `
        SELECT * FROM tender_information
        WHERE is_accounts_team_work_done = true AND tender_stage = '4' and assigned_to = $1
        ORDER BY id DESC
      `;

      const { rows } = await pool.query(getTendersAssignedByAccountsTeamQuery, [
        userId,
      ]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async updateTenderByAccountsTeam(body, userId) {
    try {
      const { payment_type, id } = body;

      const updateQuery = `
        UPDATE tender_information
        SET payment_type = $1
        WHERE id = $2;
      `;

      const { rows } = await pool.query(updateQuery, [
        JSON.stringify(payment_type),
        id,
      ]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  async markTenderCompleteByAccountsTeam(body, userId) {
    try {
      const tenderId = body.id;

      const createdBy = await pool.query(
        `SELECT createdby FROM tender_information WHERE id = $1`,
        [tenderId],
      );

      const updateQuery = `
        UPDATE tender_information
        SET tender_stage = '4', is_accounts_team_work_done = true, accounts_team_work_done_at = $1, updated_at = $1, assigned_to = $3
        WHERE id = $2;
      `;

      const { rows } = await pool.query(updateQuery, [
        new Date(),
        tenderId,
        createdBy.rows[0].createdby,
      ]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  async updateTenderDetails(body, userId) {
    const values = [];

    try {
      // helper function:
      function addTimestamp(data) {
        const timestamp = new Date().toISOString();

        if (Array.isArray(data)) {
          return data.map((item) => ({
            ...item,
            added_at: item?.added_at ?? timestamp,
          }));
        }

        if (data && typeof data === "object") {
          return {
            ...data,
            added_at: data?.added_at ?? timestamp,
          };
        }

        return data;
      }

      const { id, ...fieldsToUpdate } = body;

      if (!id) {
        throw new Error("Tender ID is required for updating.");
      }

      const mdIdResult = await pool.query(
        `SELECT id FROM users WHERE role = 'MD'`,
      );
      const mdId = mdIdResult.rows[0].id;

      // Verify ownership
      const checkQuery = `
      SELECT *
      FROM tender_information
      WHERE id = $1 AND createdby = $2
    `;

      const tenderData = await pool.query(checkQuery, [id, String(userId)]);

      if (tenderData.rowCount === 0) {
        throw new Error(
          "Tender not found or you do not have permission to update it.",
        );
      }

      const allowedColumns = [
        "tender_id",
        "tender_ref_no",
        "tender_documents",
        "tender_title",
        "tender_organization",
        "cable_length_km",
        "publish_date",
        "closing_date",
        "tender_value_cr",
        "tender_fee_inr",
        "emd_inr",
        "state",
        "submission_expected",
        "submission_actual",
        "payment_type",
        "submit_to_govt_portal_at",
        "shortfall",
        "docs_resubmitted",
        "rank_file",
        "counter_offer",
        "loi",
        "po",
        "contract_agreement",
        "warranty",
        "acceptance_letter",
        "tender_stage",
        "send_for_approval",
        "send_for_approval_at",
        "fee_document",
        "technical_document",
        "boq_filled",
        "courier",
        "submit_to_govt_portal_slip",
        "a9slip",
        "pbg",
        "insurance",
        "npv_bond",
      ];

      const jsonColumns = [
        "tender_documents",
        "payment_type",
        "docs_resubmitted",
        "counter_offer",
        "fee_document",
        "technical_document",
        "boq_filled",
        "courier",
        "submit_to_govt_portal_slip",
        "a9slip",
        "rank_file",
        "loi",
        "po",
        "contract_agreement",
        "warranty",
        "acceptance_letter",
        "pbg",
        "insurance",
        "npv_bond",
        "submission_actual", // Added this so it safely parses as JSONB!
      ];

      // 1. send submit to govt portal notification
      if (
        fieldsToUpdate.submission_actual?.submission_actual_status === true &&
        !tenderData.rows[0].submission_actual?.notified_to_md
      ) {
        const notif = await createNotification(
          mdId,
          `Tender Title - ${tenderData.rows[0].tender_title} related documents has been submitted to Government Portal.`,
          "submit_to_govt_portal_notification",
        );
        emitToUser(mdId, "new_notification", notif);
        // We don't need to manually set notified_to_md here anymore,
        // the merge block below will handle it safely!
      }

      // 2. Merge incoming submission_actual data with database submission_actual data
      if (fieldsToUpdate.submission_actual !== undefined) {
        fieldsToUpdate.submission_actual = {
          ...tenderData.rows[0].submission_actual, // existing DB value
          ...fieldsToUpdate.submission_actual, // incoming frontend payload
          notified_to_md:
            tenderData.rows[0].submission_actual?.notified_to_md || // preserve existing flag
            fieldsToUpdate.submission_actual?.submission_actual_status === true, // or set if status is true
        };

        // console.log(
        //   "✅ MERGED submission_actual going to DB: ",
        //   fieldsToUpdate.submission_actual,
        // );
      }

      // 3. counter offer approval request notification
      if (
        fieldsToUpdate.counter_offer?.sent_for_approval === true &&
        !tenderData.rows[0].counter_offer?.notified_to_md
      ) {
        const notif = await createNotification(
          mdId,
          `Tender Title - ${tenderData.rows[0].tender_title} needs your approval for counter offer.`,
          "counter_offer_approval_request_notification",
        );
        emitToUser(mdId, "new_notification", notif);

        // console.log("body body body -> ", body);
        // console.log("tender title: ", tenderData.rows[0].tender_title);
        // console.log(
        //   "fieldsToUpdate.counter_offer?.sent_for_approval: ",
        //   fieldsToUpdate.counter_offer?.sent_for_approval,
        // );
        // console.log(
        //   "tenderData.rows[0].counter_offer?.notified_to_md: ",
        //   tenderData.rows[0].counter_offer,
        // );
        // console.log(
        //   "tenderData.rows[0].counter_offer?.notified_to_md4535: ",
        //   tenderData.rows[0].counter_offer?.notified_to_md,
        // );
      }

      // 4. Merge incoming counter_offer data with database counter_offer data
      if (fieldsToUpdate.counter_offer !== undefined) {
        fieldsToUpdate.counter_offer = {
          ...tenderData.rows[0].counter_offer, // existing DB value
          ...fieldsToUpdate.counter_offer, // incoming frontend payload
          notified_to_md:
            tenderData.rows[0].counter_offer?.notified_to_md || // preserve existing flag
            fieldsToUpdate.counter_offer?.sent_for_approval === true, // or set if sending for approval
        };

        // console.log(
        //   "✅ MERGED counter_offer going to DB: ",
        //   fieldsToUpdate.counter_offer,
        // );
      }

      const setClauses = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(fieldsToUpdate)) {
        if (!allowedColumns.includes(key)) continue;

        if (jsonColumns.includes(key)) {
          let jsonValue = value;

          const documentColumns = [
            "tender_documents",
            "fee_document",
            "technical_document",
            "boq_filled",
            "docs_resubmitted",
            "submit_to_govt_portal_slip",
            "a9slip",
            "rank_file",
            "loi",
            "po",
            "contract_agreement",
            "warranty",
            "acceptance_letter",
            "pbg",
            "insurance",
            "npv_bond",
          ];

          if (documentColumns.includes(key)) {
            jsonValue = addTimestamp(jsonValue);
          }

          setClauses.push(`${key} = $${paramIndex}::jsonb`);
          values.push(jsonValue === null ? null : JSON.stringify(jsonValue));
        } else {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
        }

        paramIndex++;
      }

      if (setClauses.length === 0) {
        throw new Error("No valid fields provided for update.");
      }

      setClauses.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      const updateQuery = `
      UPDATE tender_information
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

      values.push(id);

      const { rows } = await pool.query(updateQuery, values);

      const isSentForApproval =
        rows[0].counter_offer?.sent_for_approval === true;

      if (isSentForApproval) {
        const tenderData = rows[0];

        try {
          sendMail({
            to: "rinkusingh805764@gmail.com",
            subject: `⏳ Action Required: Tender Approval - ${tenderData.tender_ref_no}`,
            templateName: "counter-offer-approval-request-mail",
            replacements: {
              tender_id: tenderData.tender_id,
              tender_ref_no: tenderData.tender_ref_no,
              tender_title: tenderData.tender_title,
              tender_organization: tenderData.tender_organization,
              cable_length_km: tenderData.cable_length_km,
              publish_date: new Date(
                tenderData.publish_date,
              ).toLocaleDateString("en-IN"),
              closing_date: new Date(
                tenderData.closing_date,
              ).toLocaleDateString("en-IN"),
              tender_value_cr: tenderData.tender_value_cr,
              tender_fee_inr: tenderData.tender_fee_inr.toLocaleString("en-IN"),
              emd_inr: tenderData.emd_inr.toLocaleString("en-IN"),
              state: tenderData.state,
              appName: "Mittalu Pvt Ltd",
            },
          });
        } catch (error) {
          console.log("Error sending send-for-approval mail: ", error);
        }
      }

      return rows[0];
    } catch (err) {
      console.log("Postgres Error:", err.message);
      console.log("Postgres Detail:", err.detail);
      console.log("Postgres Position:", err.position);
      console.log("Values JSON:", JSON.stringify(values, null, 2));
      throw err;
    }
  }
}

export default new TenderService();
