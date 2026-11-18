import pool from "../config/database.js";
import { HTTP_STATUS, PURCHASE_ORDER_STAGES } from "../utils/constants.js";
import { sendNotificationToAccountsTeam } from "../utils/helpers/helper-functions.js";
import uploadFileToS3 from "../utils/helpers/uploadSOToS3.js";

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

  getDEOAssignedWorkData = async ({ page = 1, pageSize = 10, search = "" }) => {
    try {
      const offset = (page - 1) * pageSize;

      const values = [];
      let searchCondition = "";

      if (search) {
        values.push(`%${search}%`);

        searchCondition = `
        AND (
          p.material ILIKE $1
          OR p.purity ILIKE $1
          OR p.purchase_type ILIKE $1
          OR p.purchased_by ILIKE $1
          OR p.remarks ILIKE $1
          OR p.accounts_info->'po_information_from_tally'->>'orderno' ILIKE $1
          OR p.accounts_info->'po_information_from_tally'->>'partyname' ILIKE $1
          OR p.accounts_info->'po_information_from_tally'->>'itemname' ILIKE $1
        )
      `;
      }

      const baseCondition = `
      WHERE
        p.accounts_info->>'sent_for_po_at' IS NOT NULL
        AND p.accounts_info->>'sent_for_po_at' <> ''
        AND p.accounts_info->>'po_completed_at' IS NULL
    `;

      // Fetch total count
      const countQuery = `
      SELECT COUNT(*)::INTEGER AS total_items
      FROM public.purchases p
      ${baseCondition}
      ${searchCondition}
    `;

      const countResult = await pool.query(countQuery, values);

      const totalItems = countResult.rows[0].total_items;

      // Fetch paginated records
      const dataValues = [...values];

      dataValues.push(pageSize);
      const limitParam = dataValues.length;

      dataValues.push(offset);
      const offsetParam = dataValues.length;

      const dataQuery = `
      SELECT
        p.*
      FROM public.purchases p
      ${baseCondition}
      ${searchCondition}
      ORDER BY
        (p.accounts_info->>'sent_for_po_at')::TIMESTAMPTZ DESC,
        p.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

      const dataResult = await pool.query(dataQuery, dataValues);

      return {
        rows: dataResult.rows,
        totalItems,
      };
    } catch (err) {
      console.error("Error in fetching DEO assigned work data:", err.message);
      throw err;
    }
  };

  /**
   * Append a material receive record to public.purchases.material_receive_information
   */
  addMaterialReceiveEntry = async ({
    purchaseId,
    kanta_parchi_url,
    loaded_vehicle_image_url,
    driver_photo_url,
    material_receive_date_planned,
    material_receive_date_actual,
    material_received_qty,
    rate,
    balance,
    status,
    user,
  }) => {
    try {
      // 1. Fetch current purchase record
      const getQuery = `
      SELECT id, material_receive_information
      FROM public.purchases
      WHERE id = $1
    `;
      const getRes = await pool.query(getQuery, [purchaseId]);
      if (getRes.rows.length === 0) {
        throw new Error(`Purchase order #${purchaseId} not found`);
      }

      let receiveInfo = getRes.rows[0].material_receive_information;

      // 2. Safe parse existing JSONB structure
      if (typeof receiveInfo === "string") {
        try {
          receiveInfo = JSON.parse(receiveInfo);
        } catch {
          receiveInfo = {};
        }
      }
      if (!receiveInfo || typeof receiveInfo !== "object") {
        receiveInfo = {};
      }
      if (!Array.isArray(receiveInfo.material_recieved)) {
        receiveInfo.material_recieved = [];
      }

      // 3. Compute incremented id (last id + 1)
      const existingList = receiveInfo.material_recieved;
      const lastId = existingList.reduce(
        (max, item) => Math.max(max, parseInt(item.id, 10) || 0),
        0
      );
      const nextId = lastId + 1;

      // 4. Construct entry matching the exact schema with consistent variable names
      const newEntry = {
        id: nextId,
        kanta_parchi_url: kanta_parchi_url || null,
        loaded_vehicle_image_url: loaded_vehicle_image_url || null,
        driver_photo_url: driver_photo_url || null,
        material_receive_date_planned: material_receive_date_planned || null,
        material_receive_date_actual: material_receive_date_actual || null,
        material_recieved_qty: parseFloat(material_received_qty) || 0,
        rate: parseFloat(rate) || 0,
        balance: parseFloat(balance) || 0,
        status: status || "Complete",
      };

      // 5. Append new entry
      receiveInfo.material_recieved.push(newEntry);

      const orderStatus = PURCHASE_ORDER_STAGES.partial_order_receive_stage;
      if (status === "Complete") {
        orderStatus = PURCHASE_ORDER_STAGES.complete_order_receive_stage;
      }

      // 6. Update database record
      const updateQuery = `
      UPDATE public.purchases
      SET material_receive_information = $1, order_status = $3
      WHERE id = $2
      RETURNING *
    `;
      const updateRes = await pool.query(updateQuery, [
        JSON.stringify(receiveInfo),
        purchaseId,
        orderStatus,
      ]);

      return updateRes.rows[0];
    } catch (err) {
      console.error("Error in addMaterialReceiveEntry service:", err.message);
      throw err;
    }
  };
}

export default new PurchaseService();
