import pool from "../config/database.js";
import { HTTP_STATUS, PURCHASE_ORDER_STAGES } from "../utils/constants.js";
import {
  addWorkingHours,
  sendNotificationToAccountsTeam,
} from "../utils/helpers/helper-functions.js";
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

  // getPOCreationRequests = async () => {
  //   try {
  //     const query = `SELECT *
  //     FROM public.purchases p left join vendors_data v on p.vendor_id = v.id
  //     WHERE accounts_info ? 'sent_for_po_at'
  //       AND accounts_info->>'sent_for_po_at' IS NOT NULL;`;
  //     const { rows } = await pool.query(query);
  //     return rows;
  //   } catch (err) {
  //     console.error("Error in fetching PO creation requests:", err.message);
  //     throw err;
  //   }
  // };

  getPOCreationRequests = async () => {
    try {
      const query = `
      SELECT
        p.*,
        v.vendor_name,
        p.accounts_info->>'sent_for_po_at' AS po_requested_at
      FROM public.purchases p
      LEFT JOIN vendors_data v ON p.vendor_id = v.id
      WHERE p.accounts_info ? 'sent_for_po_at'
        AND p.accounts_info->>'sent_for_po_at' IS NOT NULL
      ORDER BY p.created_at DESC;
    `;

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
          OR vd.vendor_name ILIKE $1
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
        and (
          p.order_status IS NULL
          OR p.order_status != 'Order Complete'
        )
    `;

      // Fetch total count
      const countQuery = `
      SELECT COUNT(*)::INTEGER AS total_items
      FROM public.purchases p
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
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
        p.*,
        vd.vendor_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', m.id,
                'purchase_id', m.purchase_id,
                'rate', m.rate,
                'status', m.status,
                'material_received_qty_mt', m.material_received_qty_mt,
                'material_recieved_qty', m.material_received_qty_mt,
                'balance', m.balance,
                'material_received_planned_date', m.material_received_planned_date,
                'material_receive_date_planned', m.material_received_planned_date,
                'material_received_actual_date', m.material_received_actual_date,
                'material_receive_date_actual', m.material_received_actual_date,
                'kanta_parchi_url', m.geo_tagged_images->>'kanta_parchi_url',
                'loaded_vehicle_image_url', m.geo_tagged_images->>'loaded_vehicle_image_url',
                'driver_photo_url', m.geo_tagged_images->>'driver_photo_url',
                'geo_tagged_images', m.geo_tagged_images,
                'quality_information', m.quality_information,
                'created_at', m.created_at
              ) ORDER BY m.created_at ASC
            )
            FROM public.material_received_information m
            WHERE m.purchase_id = p.id
          ),
          '[]'::json
        ) AS material_received_entries
      FROM public.purchases p
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
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

  getDEOWorkHistoryData = async ({ page = 1, pageSize = 10, search = "" }) => {
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
          OR vd.vendor_name ILIKE $1
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
        AND p.order_status = 'Order Complete'
    `;

      // Fetch total count
      const countQuery = `
      SELECT COUNT(*)::INTEGER AS total_items
      FROM public.purchases p
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
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
        p.*,
        vd.vendor_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', m.id,
                'purchase_id', m.purchase_id,
                'rate', m.rate,
                'status', m.status,
                'material_received_qty_mt', m.material_received_qty_mt,
                'material_recieved_qty', m.material_received_qty_mt,
                'balance', m.balance,
                'material_received_planned_date', m.material_received_planned_date,
                'material_receive_date_planned', m.material_received_planned_date,
                'material_received_actual_date', m.material_received_actual_date,
                'material_receive_date_actual', m.material_received_actual_date,
                'kanta_parchi_url', m.geo_tagged_images->>'kanta_parchi_url',
                'loaded_vehicle_image_url', m.geo_tagged_images->>'loaded_vehicle_image_url',
                'driver_photo_url', m.geo_tagged_images->>'driver_photo_url',
                'geo_tagged_images', m.geo_tagged_images,
                'quality_information', m.quality_information,
                'created_at', m.created_at
              ) ORDER BY m.created_at ASC
            )
            FROM public.material_received_information m
            WHERE m.purchase_id = p.id
          ),
          '[]'::json
        ) AS material_received_entries
      FROM public.purchases p
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
      ${baseCondition}
      ${searchCondition}
      ORDER BY
        p.updated_at DESC,
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
      console.error("Error in fetching DEO work history data:", err.message);
      throw err;
    }
  };

  getDEOQualityConfirmationData = async ({ page = 1, pageSize = 10, search = "" }) => {
    try {
      const offset = (page - 1) * pageSize;

      const values = [];
      let searchCondition = "";

      if (search && search.trim() !== "") {
        values.push(`%${search.trim()}%`);

        searchCondition = `
        AND (
          m.id::TEXT ILIKE $1
          OR p.id::TEXT ILIKE $1
          OR p.material ILIKE $1
          OR p.purity ILIKE $1
          OR p.purchase_type ILIKE $1
          OR p.purchased_by ILIKE $1
          OR p.remarks ILIKE $1
          OR vd.vendor_name ILIKE $1
          OR m.status ILIKE $1
          OR m.quality_information->>'status' ILIKE $1
        )
      `;
      }

      const baseCondition = `
      WHERE (
        m.quality_information IS NOT NULL 
        AND m.quality_information ? 'status' 
        AND m.quality_information->>'status' IS NOT NULL 
        AND m.quality_information->>'status' <> ''
      )
    `;

      // Fetch total count
      const countQuery = `
      SELECT COUNT(*)::INTEGER AS total_items
      FROM public.material_received_information m
      JOIN public.purchases p ON m.purchase_id = p.id
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
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
        m.id,
        m.id AS receiving_id,
        m.purchase_id,
        m.rate AS receiving_rate,
        m.rate,
        m.status AS receiving_status,
        m.status,
        m.material_received_qty_mt,
        m.material_received_qty_mt AS material_recieved_qty,
        m.balance,
        m.material_received_planned_date,
        m.material_received_actual_date,
        m.geo_tagged_images,
        m.geo_tagged_images->>'kanta_parchi_url' AS kanta_parchi_url,
        m.geo_tagged_images->>'loaded_vehicle_image_url' AS loaded_vehicle_image_url,
        m.geo_tagged_images->>'driver_photo_url' AS driver_photo_url,
        m.quality_information,
        m.created_at,
        -- Purchase Order Information
        p.id AS po_id,
        p.purchase_type,
        p.material,
        p.purity,
        p.quantity AS po_quantity,
        p.rate AS po_rate,
        p.purchased_by,
        p.remarks AS po_remarks,
        p.order_status,
        p.material_receive_date,
        p.payment_terms,
        p.accounts_info,
        -- Vendor Information
        COALESCE(vd.vendor_name, 'N/A') AS vendor_name,
        vd.id AS vendor_id
      FROM public.material_received_information m
      JOIN public.purchases p ON m.purchase_id = p.id
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
      ${baseCondition}
      ${searchCondition}
      ORDER BY
        (m.quality_information->>'status_updated_at') DESC NULLS LAST,
        m.created_at DESC,
        m.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

      const dataResult = await pool.query(dataQuery, dataValues);

      return {
        rows: dataResult.rows,
        totalItems,
      };
    } catch (err) {
      console.error("Error in fetching DEO quality confirmation data:", err.message);
      throw err;
    }
  };

  /**
   * Fetch DEO Pending Quality Confirmation Data
   * From public.material_received_information where quality_information -> status IS NULL or not set
   */
  getDEOPendingQualityConfirmationData = async ({ page = 1, pageSize = 10, search = "" }) => {
    try {
      const offset = (page - 1) * pageSize;

      let searchCondition = "";
      const values = [];

      if (search && search.trim() !== "") {
        values.push(`%${search.trim()}%`);
        searchCondition = `
        AND (
          m.id::TEXT ILIKE $1
          OR p.id::TEXT ILIKE $1
          OR p.material ILIKE $1
          OR p.purity ILIKE $1
          OR p.purchase_type ILIKE $1
          OR p.purchased_by ILIKE $1
          OR p.remarks ILIKE $1
          OR vd.vendor_name ILIKE $1
          OR m.status ILIKE $1
        )
      `;
      }

      const baseCondition = `
      WHERE (
        m.quality_information IS NULL 
        OR NOT (m.quality_information ? 'status') 
        OR m.quality_information->>'status' IS NULL 
        OR m.quality_information->>'status' = ''
      )
    `;

      // Fetch total count
      const countQuery = `
      SELECT COUNT(*)::INTEGER AS total_items
      FROM public.material_received_information m
      JOIN public.purchases p ON m.purchase_id = p.id
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
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
        m.id,
        m.id AS receiving_id,
        m.purchase_id,
        m.rate AS receiving_rate,
        m.rate,
        m.status AS receiving_status,
        m.status,
        m.material_received_qty_mt,
        m.material_received_qty_mt AS material_recieved_qty,
        m.balance,
        m.material_received_planned_date,
        m.material_received_actual_date,
        m.geo_tagged_images,
        m.geo_tagged_images->>'kanta_parchi_url' AS kanta_parchi_url,
        m.geo_tagged_images->>'loaded_vehicle_image_url' AS loaded_vehicle_image_url,
        m.geo_tagged_images->>'driver_photo_url' AS driver_photo_url,
        m.quality_information,
        m.created_at,
        -- Purchase Order Information
        p.id AS po_id,
        p.purchase_type,
        p.material,
        p.purity,
        p.quantity AS po_quantity,
        p.rate AS po_rate,
        p.purchased_by,
        p.remarks AS po_remarks,
        p.order_status,
        p.material_receive_date,
        p.payment_terms,
        p.accounts_info,
        -- Vendor Information
        COALESCE(vd.vendor_name, 'N/A') AS vendor_name,
        vd.id AS vendor_id
      FROM public.material_received_information m
      JOIN public.purchases p ON m.purchase_id = p.id
      LEFT JOIN public.vendors_data vd ON p.vendor_id = vd.id
      ${baseCondition}
      ${searchCondition}
      ORDER BY
        m.created_at DESC,
        m.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

      const dataResult = await pool.query(dataQuery, dataValues);

      return {
        rows: dataResult.rows,
        totalItems,
      };
    } catch (err) {
      console.error("Error in fetching DEO pending quality confirmation data:", err.message);
      throw err;
    }
  };

  /**
   * Submit Quality Inspection for a material received record
   */
  submitQualityInspection = async ({
    receivingId,
    purchaseId,
    status,
    purity_received,
    quality_report_pdf,
    not_okay_details,
    user,
  }) => {
    const client = await pool.connect();
    try {
      let resolvedReceivingId = receivingId;

      // 1. Check parent entry existence
      const checkQuery = `
      SELECT m.*, p.order_status, p.id as po_id
      FROM public.material_received_information m
      JOIN public.purchases p ON m.purchase_id = p.id
      WHERE m.id = $1
    `;
      let checkRes = await client.query(checkQuery, [resolvedReceivingId]);

      // Fallback 1: Uninspected entry for purchaseId
      if (checkRes.rows.length === 0 && purchaseId) {
        const fallbackQuery = `
        SELECT m.*, p.order_status, p.id as po_id
        FROM public.material_received_information m
        JOIN public.purchases p ON m.purchase_id = p.id
        WHERE m.purchase_id = $1 AND (m.quality_information IS NULL OR m.quality_information->>'status' IS NULL OR m.quality_information->>'status' = '')
        ORDER BY m.id ASC
        LIMIT 1
      `;
        const fallbackRes = await client.query(fallbackQuery, [purchaseId]);
        if (fallbackRes.rows.length > 0) {
          checkRes = fallbackRes;
          resolvedReceivingId = checkRes.rows[0].id;
        }
      }

      // Fallback 2: receivingId passed was purchase_id
      if (checkRes.rows.length === 0) {
        const fallbackByPurchaseQuery = `
        SELECT m.*, p.order_status, p.id as po_id
        FROM public.material_received_information m
        JOIN public.purchases p ON m.purchase_id = p.id
        WHERE m.purchase_id = $1 AND (m.quality_information IS NULL OR m.quality_information->>'status' IS NULL OR m.quality_information->>'status' = '')
        ORDER BY m.id ASC
        LIMIT 1
      `;
        const fallbackByPurchaseRes = await client.query(fallbackByPurchaseQuery, [
          resolvedReceivingId,
        ]);
        if (fallbackByPurchaseRes.rows.length > 0) {
          checkRes = fallbackByPurchaseRes;
          resolvedReceivingId = checkRes.rows[0].id;
        }
      }

      if (checkRes.rows.length === 0) {
        throw new Error(`Material received entry with ID ${receivingId} not found`);
      }

      const parentRow = checkRes.rows[0];

      // Begin atomic transaction
      await client.query("BEGIN");

      let childMrid = null;
      const isReplacementRaised =
        status === "Not Okay" && not_okay_details && Boolean(not_okay_details.replacement_raised);

      // 2. If replacement is raised, create the child entry
      if (isReplacementRaised) {
        const replacedQty =
          parseFloat(not_okay_details.replaced_quantity_mt) ||
          parseFloat(parentRow.material_received_qty_mt) ||
          0;

        // Calculate planned date = parent.created_at + 4 working days (4 * 9 = 36 working hours)
        const baseCreatedAt = parentRow.created_at || new Date();
        const plannedDate = addWorkingHours(baseCreatedAt, 36);

        const childQualityInfo = {
          parent_mrid: resolvedReceivingId,
          replacement_type: not_okay_details.replacement_type || "Partial",
          status: null,
        };

        const insertChildQuery = `
        INSERT INTO public.material_received_information (
          purchase_id,
          rate,
          status,
          material_received_qty_mt,
          balance,
          material_received_planned_date,
          quality_information,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id;
      `;

        const insertChildRes = await client.query(insertChildQuery, [
          parentRow.purchase_id,
          parentRow.rate,
          "Replacement",
          replacedQty,
          0,
          plannedDate, // created_at + 36 working hours (skips Sundays, non-working hours & holidays)
          JSON.stringify(childQualityInfo),
        ]);

        childMrid = insertChildRes.rows[0].id;
      }

      // 3. Prepare parent quality_information including child_mrid
      const qualityInformation = {
        status: status === "Not Okay" ? "Not Okay" : "Okay",
        status_updated_at: new Date().toISOString(),
        quality_report_pdf: quality_report_pdf || null,
        purity_received:
          purity_received !== undefined && purity_received !== null && purity_received !== ""
            ? parseFloat(purity_received)
            : null,
        not_okay_details: status === "Not Okay" && not_okay_details ? not_okay_details : null,
        child_mrid: childMrid, // Added to parent quality_information
      };

      // 4. Update the parent entry
      const updateParentQuery = `
      UPDATE public.material_received_information
      SET quality_information = $1
      WHERE id = $2
      RETURNING *;
    `;
      const updateRes = await client.query(updateParentQuery, [
        JSON.stringify(qualityInformation),
        resolvedReceivingId,
      ]);

      await client.query("COMMIT");

      return updateRes.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error in submitQualityInspection:", err.message);
      throw err;
    } finally {
      client.release();
    }
  };

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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Fetch current purchase record
      const getQuery = `
        SELECT id, order_status
        FROM public.purchases
        WHERE id = $1
      `;
      const getRes = await client.query(getQuery, [purchaseId]);
      if (getRes.rows.length === 0) {
        throw new Error(`Purchase order #${purchaseId} not found`);
      }

      // 2. Prepare payload for material_received_information
      const geo_tagged_images = {
        kanta_parchi_url: kanta_parchi_url || null,
        loaded_vehicle_image_url: loaded_vehicle_image_url || null,
        driver_photo_url: driver_photo_url || null,
      };

      const parsedQty = parseFloat(material_received_qty) || 0;
      const parsedRate = parseFloat(rate) || 0;
      const parsedBalance = parseFloat(balance) || 0;
      const finalStatus = status || "Complete";

      // 3. Insert into public.material_received_information
      const insertQuery = `
        INSERT INTO public.material_received_information (
          purchase_id,
          rate,
          status,
          geo_tagged_images,
          material_received_qty_mt,
          balance,
          material_received_planned_date,
          material_received_actual_date,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          COALESCE($7::timestamptz, CURRENT_TIMESTAMP),
          COALESCE($8::timestamptz, CURRENT_TIMESTAMP),
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      const insertValues = [
        purchaseId,
        parsedRate,
        finalStatus,
        JSON.stringify(geo_tagged_images),
        parsedQty,
        parsedBalance,
        material_receive_date_planned || null,
        material_receive_date_actual || null,
      ];
      await client.query(insertQuery, insertValues);

      // 4. Update order status in public.purchases
      let orderStatus = PURCHASE_ORDER_STAGES.partial_order_receive_stage;
      if (finalStatus === "Complete") {
        orderStatus = PURCHASE_ORDER_STAGES.complete_order_receive_stage;
      }

      const updateQuery = `
        UPDATE public.purchases
        SET order_status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const updateRes = await client.query(updateQuery, [orderStatus, purchaseId]);
      const updatedPurchase = updateRes.rows[0];

      // 5. Fetch all material received entries for this purchase order
      const entriesQuery = `
        SELECT
          m.id,
          m.purchase_id,
          m.rate,
          m.status,
          m.material_received_qty_mt,
          m.material_received_qty_mt AS material_recieved_qty,
          m.balance,
          m.material_received_planned_date,
          m.material_received_planned_date AS material_receive_date_planned,
          m.material_received_actual_date,
          m.material_received_actual_date AS material_receive_date_actual,
          m.geo_tagged_images->>'kanta_parchi_url' AS kanta_parchi_url,
          m.geo_tagged_images->>'loaded_vehicle_image_url' AS loaded_vehicle_image_url,
          m.geo_tagged_images->>'driver_photo_url' AS driver_photo_url,
          m.geo_tagged_images,
          m.quality_information,
          m.created_at
        FROM public.material_received_information m
        WHERE m.purchase_id = $1
        ORDER BY m.created_at ASC
      `;
      const entriesRes = await client.query(entriesQuery, [purchaseId]);
      updatedPurchase.material_received_entries = entriesRes.rows;

      await client.query("COMMIT");
      return updatedPurchase;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error in addMaterialReceiveEntry service:", err.message);
      throw err;
    } finally {
      client.release();
    }
  };
}

export default new PurchaseService();
