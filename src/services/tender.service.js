import pool from "../config/database.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../errors/customErrors.js";

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

  async deleteTender(id) {
    try{
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

    }catch(error){
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

  async approveTender(id) {
    try {
      // get accounts team data
      const accountsUserData = await pool.query(
        `SELECT id FROM users WHERE role = 'tender_handler_accounts'`,
      );
      const accountsId = accountsUserData.rows[0].id;

      const submissionExpected = new Date();
    submissionExpected.setDate(submissionExpected.getDate() + 2);

      const updateQuery = `
        UPDATE tender_information
        SET approved = $1, approved_at = $2, tender_stage = '3', accounts_assignee_id = $4, assigned_to_accounts_team = $5, submission_expected = $6 where id = $3
        `;

      const { rows } = await pool.query(updateQuery, [
        true,
        new Date(),
        id,
        accountsId,
        true,
        submissionExpected,
      ]);
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
            accounts_assignee_id,
            createdBy
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13,
            $14, $15
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

  async sendForApproval(id, role, userId) {
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
        SET send_for_approaval = $1, send_for_approaval_at = $2,tender_stage = $3, accounts_assignee_id = $5  where id = $4
        `;

      const { rows } = await pool.query(updateQuery, [
        true,
        new Date(),
        2,
        id,
        mdId,
      ]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  async getApprovalRequestTenders(userId) {
    console.log("userId in service: ", userId);
    console.log("typeOf userId: ", typeof userId);

    const getApprovalRequestTendersQuery = `
      SELECT * FROM tender_information
      WHERE accounts_assignee_id = $1 AND send_for_approaval = true AND tender_stage = '2'
      ORDER BY id DESC
    `;
    const { rows } = await pool.query(getApprovalRequestTendersQuery, [userId]);
    return rows;
  }

  async getApprovedTenders(userId) {
    const getApprovedTendersQuery = `
      SELECT * FROM tender_information
      WHERE approved = true
      ORDER BY id DESC
    `;

    console.log(getApprovedTendersQuery);

    const { rows } = await pool.query(getApprovedTendersQuery, []);
    return rows;
  }

  async getTendersForAccountsTeam(userId) {
    try {
      const getTendersForAccountsTeamQuery = `
        SELECT * FROM tender_information
        WHERE accounts_assignee_id = $1 AND tender_stage = '3'
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
    try{

      const totalTendersCountQuery = `select count(*) from tender_information`;
      const totalActiveTendersCountQuery = `select count(*) from tender_information where submission_actual is null`;
      const totalApprovedTendersCountQuery = `select count(*) from tender_information where approved = true`;
      const pendingFromAccountsTeamCountQuery = `select count(*) from tender_information where approved = true and is_accounts_team_work_done = false`;
      const completedTendersCountQuery = `select count(*) from tender_information where submission_actual is not null`;
      const rejectedTendersCountQuery = `select count(*) from tender_information where approved = false`;
      

      const totalTendersCountResult = await pool.query(totalTendersCountQuery);
      const totalActiveTendersCountResult = await pool.query(totalActiveTendersCountQuery);
      const totalApprovedTendersCountResult = await pool.query(totalApprovedTendersCountQuery);
      const pendingFromAccountsTeamCountResult = await pool.query(pendingFromAccountsTeamCountQuery);
      const completedTendersCountResult = await pool.query(completedTendersCountQuery);
      const rejectedTendersCountResult = await pool.query(rejectedTendersCountQuery);

      return {
        totalTenders: parseInt(totalTendersCountResult.rows[0].count, 0),
        totalActiveTenders: parseInt(totalActiveTendersCountResult.rows[0].count, 0),
        totalApprovedTenders: parseInt(totalApprovedTendersCountResult.rows[0].count, 0),
        pendingFromAccountsTeam: parseInt(pendingFromAccountsTeamCountResult.rows[0].count, 0),
        completedTenders: parseInt(completedTendersCountResult.rows[0].count, 0),
        rejectedTenders: parseInt(rejectedTendersCountResult.rows[0].count, 0),
      };

    }catch(error){
      throw error;
    }
  }


  async getTendersAssignedByAccountsTeam(userId) {
    try {
      const getTendersAssignedByAccountsTeamQuery = `
        SELECT * FROM tender_information
        WHERE is_accounts_team_work_done = true AND tender_stage = '4' and accounts_assignee_id = $1
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
        SET tender_stage = '4', is_accounts_team_work_done = true, accounts_team_work_done_at = $1, updated_at = $1, accounts_assignee_id = $3
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
      const { id, ...fieldsToUpdate } = body;

      if (!id) {
        throw new Error("Tender ID is required for updating.");
      }

      // Verify ownership
      const checkQuery = `
      SELECT id
      FROM tender_information
      WHERE id = $1 AND createdby = $2
    `;

      const checkResult = await pool.query(checkQuery, [id, String(userId)]);

      if (checkResult.rowCount === 0) {
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
        "send_for_approaval",
        "send_for_approaval_at",
      ];

      const jsonColumns = [
        "tender_documents",
        "payment_type",
        "docs_resubmitted",
        "counter_offer",
      ];

      const setClauses = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(fieldsToUpdate)) {
        if (!allowedColumns.includes(key)) continue;

        if (jsonColumns.includes(key)) {
          setClauses.push(`${key} = $${paramIndex}::jsonb`);
          values.push(value === null ? null : JSON.stringify(value));
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


      const { rows } = await pool.query(updateQuery, values);

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
