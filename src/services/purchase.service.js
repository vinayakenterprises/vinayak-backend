import pool from "../config/database.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { sendNotificationToAccountsTeam } from "../utils/helpers/helper-functions.js";

class PurchaseService {
  // Fetch vendors list (id and vendor_name)
  getVendorsData = async () => {
    try {
      const query = `
        SELECT id, vendor_name 
        FROM public.vendors_data 
        ORDER BY vendor_name ASC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (err) {
      console.error("Error in getting vendors data:", err.message);
      throw err;
    }
  };

  // Insert new purchase record into public.purchases
  createPurchase = async (purchaseData) => {
    const {
      purchase_type,
      vendor_id,
      material,
      purity,
      quantity,
      rate,
      material_receive_date,
      payment_terms,
      purchased_by,
      remarks,
    } = purchaseData;

    try {
      const query = `
      WITH inserted_purchase AS (
        INSERT INTO public.purchases (
          purchase_type,
          vendor_id,
          material,
          purity,
          quantity,
          rate,
          material_receive_date,
          payment_terms,
          purchased_by,
          remarks,
          accounts_info
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          jsonb_build_object(
            'sent_for_po_at',
            TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          )
        )
        RETURNING *
      )
      SELECT 
        ip.*,
        vd.vendor_name
      FROM inserted_purchase ip
      LEFT JOIN public.vendors_data vd 
        ON vd.id = ip.vendor_id;
      `;

      const values = [
        purchase_type,
        vendor_id,
        material,
        purity,
        quantity,
        rate,
        material_receive_date,
        payment_terms,
        purchased_by,
        remarks,
      ];

      const { rows } = await pool.query(query, values);
      sendNotificationToAccountsTeam(
        rows[0].id,
        `A new purchase order request (#${rows[0].id}) has been created for vendor: ${rows[0].vendor_name || "N/A"}. Material: ${material}. Please review the details and proceed with PO creation.`,
        "new_purchase_record"
      );
      return rows[0];
    } catch (err) {
      console.error("Error in creating purchase record:", err.message);
      throw err;
    }
  };

  // Fetch all purchase records with vendor name joined
  getPurchases = async () => {
    try {
      const query = `
        SELECT 
          p.id,
          p.purchase_type,
          p.vendor_id,
          v.vendor_name,
          p.material,
          p.purity,
          p.quantity,
          p.rate,
          ROUND((p.quantity * p.rate)::numeric, 2) AS total_amount,
          p.material_receive_date,
          p.payment_terms,
          p.purchased_by,
          p.remarks,
          p.created_at,
          p.updated_at
        FROM public.purchases p
        LEFT JOIN public.vendors_data v ON p.vendor_id = v.id
        ORDER BY p.created_at DESC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (err) {
      console.error("Error in fetching purchases list:", err.message);
      throw err;
    }
  };

  getPOCreationRequests = async () => {
    try {
      const query = `SELECT *
      FROM public.purchases p left join vendors_data v on p.vendor_id = v.id
      WHERE accounts_info ? 'sent_for_po_at'
        AND accounts_info->>'sent_for_po_at' IS NOT NULL;`;
      const { rows } = await pool.query(query);
      return rows;
    } catch (err) {
      console.error("Error in fetching PO creation requests:", err.message);
      throw err;
    }
  };

  completePOCreationFromTally = async (data) => {
    const client = await pool.connect();

    try {
      const { crn, ...poData } = data;

      if (!crn) {
        const error = new Error("CRN is required");
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw error;
      }

      await client.query("BEGIN");

      const crnData = await client.query(
        `SELECT id, accounts_info
       FROM public.purchases
       WHERE id = $1
       FOR UPDATE`,
        [crn]
      );

      if (crnData.rows.length === 0) {
        const error = new Error(`No purchase record found for CRN: ${crn}`);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const existingAccountsInfo = crnData.rows[0].accounts_info || {};

      const existingPO = existingAccountsInfo.po_information_from_tally;

      // Helper to normalize objects for comparison
      const normalize = (obj, ignoreGuid = false) => {
        if (Array.isArray(obj)) {
          return obj.map((item) => normalize(item));
        }

        if (obj !== null && typeof obj === "object") {
          return Object.keys(obj)
            .filter((key) => !(ignoreGuid && key === "guid"))
            .sort()
            .reduce((result, key) => {
              result[key] = normalize(obj[key]);
              return result;
            }, {});
        }

        return obj;
      };

      // Case 1: New PO creation
      if (!existingPO) {
        const query = `
        UPDATE public.purchases
        SET
          accounts_info = jsonb_set(
            jsonb_set(
              COALESCE(accounts_info, '{}'::jsonb),
              '{po_information_from_tally}',
              $2::jsonb,
              true
            ),
            '{po_completed_at}',
            to_jsonb(NOW() AT TIME ZONE 'UTC'),
            true
          ),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;

        const result = await client.query(query, [crn, JSON.stringify(poData)]);

        await client.query("COMMIT");

        return {
          statusCode: HTTP_STATUS.CREATED,
          message: "PO created successfully",
          data: result.rows[0],
        };
      }

      // Compare existing and incoming PO data, ignoring guid
      const existingData = JSON.stringify(normalize(existingPO, true));
      const incomingData = JSON.stringify(normalize(poData, true));

      // Case 2: No changes
      if (existingData === incomingData) {
        await client.query("COMMIT");

        return {
          statusCode: HTTP_STATUS.OK,
          message: "Nothing to Update",
          data: crnData.rows[0],
        };
      }

      // Case 3: Existing PO has changes, update it
      const updateQuery = `
      UPDATE public.purchases
      SET
        accounts_info = jsonb_set(
          jsonb_set(
            COALESCE(accounts_info, '{}'::jsonb),
            '{po_information_from_tally}',
            $2::jsonb,
            true
          ),
          '{po_completed_at}',
          to_jsonb(NOW() AT TIME ZONE 'UTC'),
          true
        ),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

      const updateResult = await client.query(updateQuery, [crn, JSON.stringify(poData)]);

      await client.query("COMMIT");

      return {
        statusCode: HTTP_STATUS.OK,
        message: "PO information updated successfully",
        data: updateResult.rows[0],
      };
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Error in completing PO creation from Tally:", err.message);

      throw err;
    } finally {
      client.release();
    }
  };

  getCompletePOCreationFromTallyData = async ({ page = 1, pageSize = 10, search = "" }) => {
    try {
      const offset = (page - 1) * pageSize;
      const queryParams = [];
      let paramIndex = 1;

      // Base conditions
      let whereClause = `
      WHERE p.accounts_info ? 'po_completed_at'
        AND p.accounts_info->>'po_completed_at' IS NOT NULL
    `;

      // Optional Search filter
      if (search) {
        whereClause += `
        AND (
          v.vendor_name ILIKE $${paramIndex}
          OR p.material ILIKE $${paramIndex}
          OR p.purchased_by ILIKE $${paramIndex}
          OR p.id::text ILIKE $${paramIndex}
        )
      `;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // 1. Get Total Count for Pagination
      const countQuery = `
      SELECT COUNT(*) AS total
      FROM public.purchases p
      LEFT JOIN public.vendors_data v ON p.vendor_id = v.id
      ${whereClause};
    `;

      const countResult = await pool.query(countQuery, queryParams);
      const totalItems = parseInt(countResult.rows[0]?.total || 0, 10);

      // 2. Get Paginated Data
      const dataQuery = `
      SELECT p.*, v.*
      FROM public.purchases p
      LEFT JOIN public.vendors_data v ON p.vendor_id = v.id
      ${whereClause}
      ORDER BY
        COALESCE(
          (p.accounts_info->>'po_completed_at')::timestamptz,
          p.created_at
        ) DESC,
        p.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

      queryParams.push(pageSize, offset);

      const { rows } = await pool.query(dataQuery, queryParams);

      return { rows, totalItems };
    } catch (err) {
      console.error("Error in fetching completed PO creation from Tally:", err.message);
      throw err;
    }
  };
}

export default new PurchaseService();
