import pool from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/customErrors.js';

// Column sets per role
const TENDER_AGENT_COLUMNS = [
  'tender_id', 'tender_ref_no', 'tender_documents', 'tender_title',
  'tender_organization', 'cable_length_km', 'publish_date', 'closing_date',
  'tender_value_cr', 'tender_fee_inr', 'emd_inr', 'state',
  'submission_expected', 'submission_actual', 'payment_type',
  'submit_to_govt_portal_at', 'shortfall', 'docs_resubmitted',
  'rank_file', 'counter_offer', 'loi', 'po',
  'contract_agreement', 'warranty', 'acceptance_letter', 'tender_stage',
];

const MD_COLUMNS = ['approved', 'approved_at'];

const ACCOUNTS_COLUMNS = ['payment_type', 'emd_inr'];

const VALID_PAYMENT_TYPES = ['dd', 'bg', 'online_payment'];

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

    if (typeof paymentType !== 'object' || Array.isArray(paymentType)) {
      throw new BadRequestError(
        'payment_type must be an object with { url: string, type: "dd" | "bg" | "online_payment" }'
      );
    }

    if (!paymentType.url || typeof paymentType.url !== 'string') {
      throw new BadRequestError('payment_type.url is required and must be a string');
    }

    if (!VALID_PAYMENT_TYPES.includes(paymentType.type)) {
      throw new BadRequestError(
        `payment_type.type must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`
      );
    }
  }



  // ─── get tenders ──────────────────────────────────────────
  async getAllTenders() {
    const { rows } = await pool.query(
      'SELECT * FROM tender_information ORDER BY id DESC'
    );
    return rows;
  }

  async getTenderById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM tender_information WHERE id = $1',
      [id]
    );
    if (!rows[0]) throw new NotFoundError(`Tender with id ${id} not found`);
    return rows[0];
  }

  // ─── create tender (tender_agent only) ────────────────────
  async createTender(body, role) {
    if (role !== 'tender_agent') {
      throw new ForbiddenError('Only tender_agent can create tenders');
    }

    // 1. Validate required fields
    if (!body.tender_id || !body.tender_title) {
      throw new BadRequestError('tender_id and tender_title are required');
    }

    // 2. Filter allowed agent columns for creation
    const insertData = this._filterColumns(body, TENDER_AGENT_COLUMNS);

    // If stage is not provided, default to STAGE_1_DRAFT
    if (!insertData.tender_stage) {
      insertData.tender_stage = 1;
    }

    // 3. Validate and format JSON fields
    if (insertData.payment_type !== undefined) {
      this._validatePaymentType(insertData.payment_type);
      insertData.payment_type = insertData.payment_type ? JSON.stringify(insertData.payment_type) : null;
    }

    insertData.tender_documents = JSON.stringify(insertData.tender_documents || []);
    insertData.docs_resubmitted = JSON.stringify(insertData.docs_resubmitted || []);

    // 4. Construct dynamic INSERT SQL statement
    const keys = Object.keys(insertData);
    const values = Object.values(insertData);

    const columnsClause = keys.map(key => `"${key}"`).join(', ');
    const placeholdersClause = keys.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO tender_information (${columnsClause})
      VALUES (${placeholdersClause})
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  // ─── update tender (role-gated) ───────────────────────────
  async updateTender(id, body, role) {
    // 1. Fetch current tender to check stage
    const tender = await this.getTenderById(id);
    const currentStage = String(tender.tender_stage);

    let allowedColumns = [];

    // 2. Role and Stage Validation using your top-level arrays
    switch (role) {
      case 'tender_agent':
        allowedColumns = [...TENDER_AGENT_COLUMNS];
        break;

      case 'md':
        if (currentStage !== '2') {
          throw new ForbiddenError('MD can only update tenders at tender_stage 2');
        }
        // Appending 'tender_stage' so the MD can transition the tender to stage 3 or back to 1
        allowedColumns = [...MD_COLUMNS, 'tender_stage'];
        break;

      case 'accounts':
        if (currentStage !== '3') {
          throw new ForbiddenError('Accounts can only update tenders at tender_stage 3');
        }
        // Appending 'tender_stage' so Accounts can transition the tender to stage 4
        allowedColumns = [...ACCOUNTS_COLUMNS, 'tender_stage'];
        break;

      default:
        throw new ForbiddenError('Your role does not have permission to update tenders');
    }

    // 3. Filter the incoming body using your predefined allowed columns list
    const updateData = {};
    for (const key of allowedColumns) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No updatable fields provided for your role');
    }

    // 4. Validate and stringify ONLY the actual JSONB fields from your schema
    if (updateData.payment_type !== undefined) {
      this._validatePaymentType(updateData.payment_type);
      updateData.payment_type = updateData.payment_type ? JSON.stringify(updateData.payment_type) : null;
    }
    if (updateData.tender_documents !== undefined) {
      updateData.tender_documents = updateData.tender_documents ? JSON.stringify(updateData.tender_documents) : '[]';
    }
    if (updateData.docs_resubmitted !== undefined) {
      updateData.docs_resubmitted = updateData.docs_resubmitted ? JSON.stringify(updateData.docs_resubmitted) : '[]';
    }

    // 5. Construct the raw SQL SET clause
    const keys = Object.keys(updateData);
    const values = Object.values(updateData);

    // Wraps column names in double quotes to remain perfectly safe from any SQL keywords
    const setClause = keys.map((key, index) => `"${key}" = $${index + 1}`).join(', ');

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
}

export default new TenderService();
