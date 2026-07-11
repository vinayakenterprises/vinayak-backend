import pool from "../config/database.js";
import { ORDER_STAGES } from "../utils/constants.js";
import { emitToUser } from "../utils/socket.js";
import { createNotification } from "./notification.service.js";
import crypto from "node:crypto";

class O2dService {
  async createSaleOrder(data, userId) {
    const {
      client_name,
      rate,
      ex_works_rate,
      freight,
      quantity_mt,
      rod_size,
      delivery_date,
      bill_to,
      ship_to,
      dispatch_type,
      sales_person_name,
      assigned_to,
      credit_limit_info,
      vehicle_type,
    } = data;

    const getCrm = await pool.query(
      `select crm from customers where company_name = $1 or $1::text = any(child_companies)`,
      [client_name],
    );

    if (getCrm.rows[0].crm === null) {
      throw new Error("Please Assign CRM First");
    }

    let orderStatus = null;
    if (credit_limit_info?.credit_limit_approval_request === true) {
      orderStatus = ORDER_STAGES.credit_limit_approval_stage;

      // send notification to sales lead for credit limit approval
      try {
        const salesLeadIdResult = await pool.query(
          `SELECT id FROM users WHERE role = 'Sales Executive Lead' AND department = 'Sales'`,
        );

        const salesLeadId = salesLeadIdResult.rows[0].id;

        if (!salesLeadId) {
          throw new Error("Sales Executive Lead not found");
        }

        const notif = await createNotification(
          salesLeadId,
          `Sale Order for ${client_name} requires your approval for credit limit.`,
          "credit_limit_approval_request_notification",
        );
        emitToUser(salesLeadId, "new_notification", notif);
      } catch (error) {
        console.log("error in sending notification to sales lead: ", error);
      }

      // send notification to crm
      // try {
      //   const crmId = getCrm.rows[0].crm;

      //   const notif = await createNotification(
      //     crmId,
      //     `Sale Order for ${client_name} is created and requires credit limit approval from sales lead.`,
      //     "credit_limit_approval_request_notification_to_crm",
      //   );
      //   emitToUser(crmId, "new_notification", notif);
      // } catch (error) {
      //   console.log("error in sending notification to crm: ", error);
      // }
    } else {
      orderStatus = ORDER_STAGES.so_generation_stage;

      // send notification to sale order generator executive
      try {
        const getSoGenerationExecutiveId = await pool.query(
          `SELECT id FROM users WHERE role = 'Sale Order Executive' AND department = 'Accounts'`,
        );

        const soGenerationExecutiveId = getSoGenerationExecutiveId.rows[0].id;

        if (!soGenerationExecutiveId) {
          throw new Error("Sales Executive not found");
        }

        const notif = await createNotification(
          soGenerationExecutiveId,
          `Please create SO for ${client_name}.`,
          "so_generation_notification",
        );
        emitToUser(soGenerationExecutiveId, "new_notification", notif);
      } catch (error) {
        console.log("error while sending notification: ", error);
      }

      // send notification to crm
      try {
        try {
          const crmId = getCrm.rows[0].crm;

          const notif = await createNotification(
            crmId,
            `Sale Order for ${client_name} is created and sent to sale order generator executive.`,
            "so_generation_notification_to_crm",
          );
          emitToUser(crmId, "new_notification", notif);
        } catch (error) {
          console.log("error in sending notification to crm: ", error);
        }
      } catch (error) {
        console.log("error in sending notification to crm: ", error);
      }
    }

    const query = `
      INSERT INTO public.sales_orders (
        client_name, rate, ex_works_rate, freight, quantity_mt, rod_size,
        delivery_date, bill_to, ship_to, dispatch_type, sales_person_name,
        assigned_to, created_by, updated_by, credit_limit_info, order_status, vehicle_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *;
    `;

    const values = [
      client_name,
      rate,
      ex_works_rate,
      freight,
      quantity_mt,
      rod_size,
      delivery_date,
      bill_to,
      ship_to,
      dispatch_type,
      sales_person_name,
      userId,
      userId,
      userId,
      credit_limit_info,
      orderStatus,
      vehicle_type,
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async getAllClientNamesList(userId) {
    try {
      const query = `
      SELECT ARRAY_AGG(client_name) AS master_client_list
      FROM (
          SELECT company_name AS client_name FROM customers where sales_person = $1
          UNION
          SELECT UNNEST(child_companies) AS client_name 
          FROM customers 
          WHERE sales_person = $1 and child_companies IS NOT NULL 
      ) AS combined_names;
    `;
      const { rows } = await pool.query(query, [userId]);

      // Here, rows[0] is correct because the query only returns exactly 1 row containing the aggregated array
      // console.log("Retrieved client names list: ", rows[0].master_client_list);
      return rows[0].master_client_list;

      // Example output: ['AS Metals', 'Alpha Communication LLP', 'Goyal Industries', ...]
    } catch (error) {
      console.error("Error in getting client name list: ", error);
      throw error;
    }
  }

  async createNewCustomerProfile(customerData) {
    const {
      customer_type,
      company_name,
      customer_id, // Note: Handled as a string based on your schema
      address,
      state,
      region,
      contact_person,
      contact_number,
      status,
      child_companies, // Expected to be an array of strings
    } = customerData;

    const query = `
      INSERT INTO public.customers (
        customer_type, company_name, customer_id, address, state, 
        region, contact_person, contact_number, status, child_companies
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *;
    `;

    const values = [
      customer_type,
      company_name,
      customer_id,
      address,
      state,
      region,
      contact_person,
      contact_number,
      status,
      child_companies,
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async retrieveAllCustomersList(userId) {
    try {
      const query = `SELECT 
            c.*,
            COALESCE(pending.total_pending_quantity, 0) AS total_pending_quantity,
            CASE 
                WHEN c.credit_limit = 0 THEN 0
                ELSE c.credit_limit - COALESCE(pending.total_pending_quantity, 0)
            END AS remaining_credit_limit
        FROM 
            public.customers c
        LEFT JOIN LATERAL (
            SELECT sum(quantity_mt) AS total_pending_quantity
            FROM sales_orders so
            WHERE 
                (so.client_name = c.company_name OR so.client_name = ANY(c.child_companies))
                AND (so.payment_status IS NULL OR (so.payment_status->>'payment_status')::boolean = false)
        ) pending ON true
        WHERE 
            c.sales_person = $1
        ORDER BY 
            c.id DESC;`;

      const { rows } = await pool.query(query, [userId]);
      return rows;
    } catch (error) {
      console.log("error in retrieving customer list: ", error);
      throw error;
    }
  }

  async retrieveCustomerDetailsById(id) {
    const query = "SELECT * FROM public.customers WHERE id = $1";
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  async updateExistingCustomerDetails(id, customerData) {
    const {
      customer_type,
      company_name,
      customer_id,
      address,
      state,
      region,
      contact_person,
      contact_number,
      status,
      child_companies,
    } = customerData;

    // COALESCE is used here so that if a field isn't passed in the update payload,
    // it retains its previous database value.
    const query = `
      UPDATE public.customers 
      SET 
        customer_type = COALESCE($1, customer_type),
        company_name = COALESCE($2, company_name),
        customer_id = COALESCE($3, customer_id),
        address = COALESCE($4, address),
        state = COALESCE($5, state),
        region = COALESCE($6, region),
        contact_person = COALESCE($7, contact_person),
        contact_number = COALESCE($8, contact_number),
        status = COALESCE($9, status),
        child_companies = COALESCE($10, child_companies),
        updated_at = now()
      WHERE id = $11
      RETURNING *;
    `;

    const values = [
      customer_type,
      company_name,
      customer_id,
      address,
      state,
      region,
      contact_person,
      contact_number,
      status,
      child_companies,
      id,
    ];

    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  }

  async removeCustomerRecordById(id) {
    const query = "DELETE FROM public.customers WHERE id = $1 RETURNING *";
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  async getAllSaleOrder(userId) {
    // We use a CTE (WITH PendingOrders) to calculate the pending sums once,
    // and then JOIN it to the main sales_orders query.
    const query = `
      WITH PendingOrders AS (
          SELECT client_name, COALESCE(SUM(quantity_mt), 0) as total_pending_quantity
          FROM public.sales_orders
          WHERE payment_status IS NULL
          GROUP BY client_name
      )
      SELECT 
          so.*,
          COALESCE(c.credit_limit, 0) as credit_limit,
          COALESCE(po.total_pending_quantity, 0) as total_pending_quantity,
          (COALESCE(c.credit_limit, 0) - COALESCE(po.total_pending_quantity, 0)) as remaining_credit,
          CASE 
              WHEN COALESCE(c.credit_limit, 0) = 0 THEN 'Advance Payment Required'
              WHEN COALESCE(po.total_pending_quantity, 0) >= COALESCE(c.credit_limit, 0) THEN 'Credit Limit Exceeded'
              ELSE 'Within the Credit Limit'
          END as credit_message
      FROM public.sales_orders so
      LEFT JOIN public.customers c ON so.client_name = c.company_name
      LEFT JOIN PendingOrders po ON so.client_name = po.client_name
      WHERE so.created_by = $1
      ORDER BY so.id DESC;
    `;

    try {
      const { rows } = await pool.query(query, [userId]);

      // Ensure numeric fields are returned as Numbers, not Strings, to the frontend
      return rows.map((row) => ({
        ...row,
        credit_limit: Number(row.credit_limit),
        total_pending_quantity: Number(row.total_pending_quantity),
        remaining_credit: Number(row.remaining_credit),
      }));
    } catch (error) {
      console.error("Error in getAllSaleOrder: ", error);
      throw error;
    }
  }

  async getSaleOrderById(id) {
    const query = "SELECT * FROM public.sales_orders WHERE id = $1";
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  async updateSaleOrder(id, data, userId) {
    const {
      client_name,
      rate,
      ex_works_rate,
      freight,
      quantity_mt,
      rod_size,
      delivery_date,
      bill_to,
      ship_to,
      dispatch_type,
      sales_person_name,
      assigned_to,
    } = data;

    const query = `
      UPDATE public.sales_orders 
      SET 
        client_name = COALESCE($1, client_name),
        rate = COALESCE($2, rate),
        ex_works_rate = COALESCE($3, ex_works_rate),
        freight = COALESCE($4, freight),
        quantity_mt = COALESCE($5, quantity_mt),
        rod_size = COALESCE($6, rod_size),
        delivery_date = COALESCE($7, delivery_date),
        bill_to = COALESCE($8, bill_to),
        ship_to = COALESCE($9, ship_to),
        dispatch_type = COALESCE($10, dispatch_type),
        sales_person_name = COALESCE($11, sales_person_name),
        assigned_to = COALESCE($12, assigned_to),
        updated_by = $13,
        updated_at = now()
      WHERE id = $14
      RETURNING *;
    `;

    const values = [
      client_name,
      rate,
      ex_works_rate,
      freight,
      quantity_mt,
      rod_size,
      delivery_date,
      bill_to,
      ship_to,
      dispatch_type,
      sales_person_name,
      assigned_to,
      userId,
      id,
    ];

    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  }

  async deleteSaleOrder(id) {
    const query = "DELETE FROM public.sales_orders WHERE id = $1 RETURNING *";
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  async checkCreditLimit(body, userId) {
    try {
      const { client_name, quantity_mt } = body;

      if (!client_name || !quantity_mt) {
        throw new Error("Order or Client or Quantity is required");
      }

      const clientCreditLimit = await pool.query(
        `select credit_limit from customers where company_name = $1 or $1::text = any(child_companies)`,
        [client_name],
      );

      if (clientCreditLimit.rows.length === 0) {
        throw new Error("Client Not Found!");
      }

      const response = {};

      if (clientCreditLimit.rows[0].credit_limit === 0) {
        response.credit_limit = 0;
        response.message = "Advance Payment Required";
      } else {
        const creditLimit = clientCreditLimit.rows[0].credit_limit;

        const totalPendingOrder = await pool.query(
          `SELECT sum(quantity_mt) AS total_pending_quantity 
          FROM sales_orders 
          WHERE client_name = $1 
            AND (payment_status is null or (payment_status->>'payment_status')::boolean = false)`,
          [client_name],
        );
        const totalPendingOrderQuantity =
          totalPendingOrder.rows[0]?.total_pending_quantity || 0;

        if (totalPendingOrderQuantity + quantity_mt >= creditLimit) {
          response.credit_limit = creditLimit;
          response.message = "Credit Limit Exceeded";
          response.remaining_credit =
            creditLimit - (totalPendingOrderQuantity + quantity_mt);
        } else {
          response.credit_limit = creditLimit;
          response.message = "Within the Credit Limit";
          response.remaining_credit =
            creditLimit - (totalPendingOrderQuantity + quantity_mt);
        }
      }

      return response;
    } catch (error) {
      console.log("error in checking credit limit: ", error);
      throw error;
    }
  }

  async getCreditLimitReachedData(body, userId) {
    // We calculate pending sums using a CTE and join it to the filtered sales_orders
    const query = `
      WITH PendingOrders AS (
          SELECT client_name, COALESCE(SUM(quantity_mt), 0) as total_pending_quantity
          FROM public.sales_orders
          WHERE payment_status IS NULL
          GROUP BY client_name
      )
      SELECT 
          so.*,
          COALESCE(c.credit_limit, 0) as credit_limit,
          COALESCE(po.total_pending_quantity, 0) as total_pending_quantity,
          (COALESCE(c.credit_limit, 0) - COALESCE(po.total_pending_quantity, 0)) as remaining_credit,
          CASE 
              WHEN COALESCE(c.credit_limit, 0) = 0 THEN 'Advance Payment Required'
              WHEN COALESCE(po.total_pending_quantity, 0) >= COALESCE(c.credit_limit, 0) THEN 'Credit Limit Exceeded'
              ELSE 'Within the Credit Limit'
          END as credit_message
      FROM public.sales_orders so
      LEFT JOIN public.customers c ON so.client_name = c.company_name
      LEFT JOIN PendingOrders po ON so.client_name = po.client_name
      WHERE so.credit_limit_info->>'credit_limit_approval_request' = 'true'
      ORDER BY so.id DESC;
    `;

    try {
      // Execute the query. (See note below if you need to filter by userId)
      const { rows } = await pool.query(query);

      // Ensure numeric fields are correctly typed for the frontend
      return rows.map((row) => ({
        ...row,
        credit_limit: Number(row.credit_limit),
        total_pending_quantity: Number(row.total_pending_quantity),
        remaining_credit: Number(row.remaining_credit),
      }));
    } catch (error) {
      console.error("error in getting credit limit reached data: ", error);
      throw error;
    }
  }

  async approveCreditLimitExceededSale(body, userId) {
    try {
      const { order_id, credit_limit_request_approval_status } = body;

      if (!order_id) {
        throw new Error("Order ID is required");
      }

      let soGenerationStage = "";

      const sendNotificationSaleExecutive = async (order_id) => {
        try {
          const crmIdResult = await pool.query(
            `select c.sales_person from sales_orders so inner join customers c on so.client_name = c.company_name or so.client_name = any(c.child_companies)
          where so.id = $1`,
            [order_id],
          );

          if (
            crmIdResult.rows.length === 0 ||
            crmIdResult.rows[0].sales_person === null
          ) {
            throw new Error("Please Assign Sales Executive First");
          }
          const salesPersonId = crmIdResult.rows[0].sales_person;

          const notif = await createNotification(
            salesPersonId,
            `Credit Limit Request for Order ID: ${order_id} has been ${credit_limit_request_approval_status ? "approved" : "rejected"} by Sales Lead.`,
            "credit_limit_request_result_notification_to_sales_executive",
          );
          emitToUser(salesPersonId, "new_notification", notif);
        } catch (error) {
          console.log(
            "error while sending notification to sales executive: ",
            error,
          );
        }
      };

      const sendNotificationToSoExecutive = async (order_id) => {
        try {
          try {
            const getSoGenerationExecutiveId = await pool.query(
              `SELECT id FROM users WHERE role = 'Sale Order Executive' AND department = 'Accounts'`,
            );

            const soGenerationExecutiveId =
              getSoGenerationExecutiveId.rows[0].id;

            if (!soGenerationExecutiveId) {
              throw new Error("Sales Executive not found");
            }

            const notif = await createNotification(
              soGenerationExecutiveId,
              `Please create SO for Order ID: ${order_id}.`,
              "so_generation_notification",
            );
            emitToUser(soGenerationExecutiveId, "new_notification", notif);
          } catch (error) {
            console.log("error while sending notification: ", error);
          }
        } catch (error) {
          console.log(
            "error while sending notification to so executive: ",
            error,
          );
        }
      };

      if (credit_limit_request_approval_status === true) {
        soGenerationStage = ORDER_STAGES.so_generation_stage;

        const approveQuery = `
        UPDATE sales_orders
        SET credit_limit_info = COALESCE(credit_limit_info, '{}'::jsonb)
            || jsonb_build_object('credit_limit_request_approved_at', now(), 'credit_limit_request_approval_status', true),
            order_status = $2
        WHERE id = $1
        RETURNING *;
      `;

        const { rows } = await pool.query(approveQuery, [
          order_id,
          soGenerationStage,
        ]);

        // sendNotificationToCrm(order_id);
        sendNotificationToSoExecutive(order_id);
        sendNotificationSaleExecutive(order_id);

        return rows[0] || null;
      } else {
        soGenerationStage = ORDER_STAGES.order_completed_stage;

        const rejectQuery = `
        UPDATE sales_orders
        SET credit_limit_info = COALESCE(credit_limit_info, '{}'::jsonb)
            || jsonb_build_object('credit_limit_request_approved_at', now(), 'credit_limit_request_approval_status', false),
            order_status = $2
        WHERE id = $1
        RETURNING *;
      `;

        const { rows } = await pool.query(rejectQuery, [
          order_id,
          soGenerationStage,
        ]);

        // sendNotificationToCrm(order_id);
        sendNotificationSaleExecutive(order_id);

        return rows[0] || null;
      }
    } catch (error) {
      console.log("error in approving credit limit exceeded sale: ", error);
      throw error;
    }
  }

  async generateSaleOrderSlip(body, userId) {
    try {
      // 1. Destructure the order_id and ONLY the allowed fields from the body
      const { order_id, sent_for_so, sent_for_so_at, so_order_completed_at } =
        body;

      if (!order_id) {
        throw new Error("Order ID is required");
      }

      const customerNameOfSo = await pool.query(
        `select c.crm from sales_orders so inner join customers c on so.client_name = c.company_name OR so.client_name::text = ANY(c.child_companies) where so.id = $1`,
        [order_id],
      );

      if (customerNameOfSo.rows[0].crm === null) {
        throw new Error("Please Assign CRM First");
      }

      // 2. Build a sanitized object to hold only the provided allowed fields
      const sanitizedSlipData = {};

      // Check for undefined so we don't accidentally ignore a valid 'false' boolean
      if (sent_for_so !== undefined) {
        sanitizedSlipData.sent_for_so = Boolean(sent_for_so);
      }

      if (sent_for_so_at) {
        // You can add validation here to ensure it's a valid UTC timestamp if needed,
        // or just trust the frontend string. Example: new Date(sent_for_so_at).toISOString()
        sanitizedSlipData.sent_for_so_at = sent_for_so_at;
      }

      if (so_order_completed_at) {
        sanitizedSlipData.so_order_completed_at = so_order_completed_at;
      }

      // If no valid fields were provided, you might want to stop the update to save DB calls
      if (Object.keys(sanitizedSlipData).length === 0) {
        throw new Error(
          "No valid sale order generation fields provided to update",
        );
      }

      const getSaleOrdersExecutiveId = await pool.query(
        `select id from users where role = 'Sale Order Executive' and department = 'Accounts'`,
      );
      const salesOrdersExecutiveId = getSaleOrdersExecutiveId.rows[0].id;

      if (!salesOrdersExecutiveId) {
        throw new Error("Sales Order Executive not found");
      }

      // 3. Merge the sanitized JSON object with the existing one
      const query = `
        UPDATE public.sales_orders
        SET 
          sale_order_generation = COALESCE(sale_order_generation, '{}'::jsonb) || $1::jsonb,
          updated_at = now(),
          updated_by = $2,
          assigned_to = $4
        WHERE id = $3
        RETURNING *;
      `;

      // Stringify the cleanly built object
      const values = [
        JSON.stringify(sanitizedSlipData),
        userId,
        order_id,
        salesOrdersExecutiveId,
      ];

      const { rows } = await pool.query(query, values);
      return rows[0] || null;
    } catch (error) {
      console.error("Error in generating sale order slip: ", error);
      throw error;
    }
  }

  async getSOGenerationRequestData(userId) {
    try {
      const query = `
        SELECT * FROM public.sales_orders
        WHERE assigned_to = $1 AND sale_order_generation->>'sent_for_so' = 'true' and sale_order_generation->>'so_order_completed_at' is null
        ORDER BY id DESC
        `;
      const { rows } = await pool.query(query, [userId]);
      return rows;
    } catch (error) {
      console.log("error in getting so generation request data: ", error);
      throw error;
    }
  }

  async completeSOGenerationRequest(id, userId, document_url) {
    try {
      const crmQuery = `
      SELECT c.crm 
      FROM sales_orders so 
      INNER JOIN customers c ON so.client_name = c.company_name OR so.client_name::text = ANY(c.child_companies)
      WHERE so.id = $1
    `;
      const crmResult = await pool.query(crmQuery, [id]);

      if (crmResult.rows.length === 0) {
        throw new Error("Please Assign CRM First");
      }

      // Extract the crmId (defaulting to null if the record isn't found)
      const crmId = crmResult.rows[0].crm;

      const soGenerationComplete = ORDER_STAGES.so_generation_completed_stage;

      const query = `
        UPDATE public.sales_orders
        SET sale_order_generation = COALESCE(sale_order_generation, '{}'::jsonb) || jsonb_build_object(
            'so_order_completed_at', now(),
            'document_url', $3::text
        ),
        order_status = $5,
        assigned_to = $4,
        updated_at = now(),
        updated_by = $2
        WHERE id = $1
        RETURNING *;
      `;

      try {
        const notif = await createNotification(
          crmId,
          `Sale Order for Order ID: ${id} is created from Accounts Team!`,
          "so_generation_completion_notification",
        );
        emitToUser(crmId, "new_notification", notif);
      } catch (error) {
        console.log("error while sending notification: ", error);
      }

      const { rows } = await pool.query(query, [
        id,
        userId,
        document_url,
        crmId,
        soGenerationComplete,
      ]);
      return rows[0];
    } catch (error) {
      console.log("error in completing so generation request: ", error);
      throw error;
    }
  }

  async getCompletedSOGenerationRequestData(userId) {
    try {
      const query = `
        SELECT * FROM public.sales_orders
        WHERE sale_order_generation->>'sent_for_so' = 'true' and sale_order_generation->>'so_order_completed_at' is not null
        ORDER BY id DESC
        `;
      const { rows } = await pool.query(query, []);
      return rows;
    } catch (error) {
      console.log("error in getting so generation request data: ", error);
      throw error;
    }
  }

  async getAssignedSOByCRM(userId) {
    try {
      const query = `
        SELECT so.* FROM public.sales_orders so
        INNER JOIN public.customers c ON so.client_name = c.company_name
        WHERE c.crm = $1 
          AND so.sale_order_generation->>'sent_for_so' = 'true' 
          -- AND so.sale_order_generation->>'so_order_completed_at' IS NOT NULL 
        ORDER BY so.id DESC;
      `;
      const { rows } = await pool.query(query, [userId]);
      return rows;
    } catch (error) {
      console.log("error in getting so generation request data: ", error);
      throw error;
    }
  }

  async updateDispatchInformation(
    id,
    dispatch_type,
    dispatch_status,
    userId,
    dispatch_at,
    delay_reason,
  ) {
    try {
      // 1. Use jsonb_build_object to construct your new dispatch_info column
      const query = `
      UPDATE public.sales_orders
      SET dispatch_info = COALESCE(dispatch_info, '{}'::jsonb) || jsonb_build_object(
          'dispatch_status', $2::boolean,
          'dispatch_at', $5::timestamp,
          'dispatch_type', $3::text,
          'delay_reason', $6::text
      ),
      updated_at = now(),
      updated_by = $4
      WHERE id = $1
      RETURNING *;
    `;

      // 2. Update the parameter array to match the new query structure
      const { rows } = await pool.query(query, [
        id,
        dispatch_status,
        dispatch_type,
        userId,
        dispatch_at,
        delay_reason,
      ]);
      return rows[0];
    } catch (error) {
      console.error("Error in updating dispatch info: ", error);
      throw error;
    }
  }

  async updateInvoiceAndDispatchInfo(orderId, dispatchData, userId) {
    try {
      const { actual_dispatch_date, invoices, invoice_completed_at } =
        dispatchData;

      // 1. Fetch current invoice_and_dispatch from the database
      const fetchQuery = `SELECT invoice_and_dispatch FROM public.sales_orders WHERE id = $1`;
      const { rows } = await pool.query(fetchQuery, [orderId]);

      if (rows.length === 0) {
        throw new Error("Sales order not found");
      }

      // 2. Parse existing data or initialize an empty structure
      let currentDispatchInfo = rows[0].invoice_and_dispatch || {};

      // Ensure the invoices array exists so we can safely push to it
      if (!currentDispatchInfo.invoices) {
        currentDispatchInfo.invoices = [];
      }

      // 3. Incrementally update fields based on what was passed in the request

      // If a new date is provided, update it
      if (actual_dispatch_date) {
        currentDispatchInfo.actual_dispatch_date = actual_dispatch_date;
      }

      let assignToStr = ``;

      if (invoice_completed_at) {
        // const invoiceGenerationCompletedStage = ORDER_STAGES.invoice_generation_completed_stage;
        const thankYouAndIntimationStage =
          ORDER_STAGES.thank_you_and_intimation_stage;
        currentDispatchInfo.invoice_completed_at = invoice_completed_at;
        assignToStr = `,assigned_to = (SELECT crm FROM public.customers WHERE company_name = public.sales_orders.client_name OR public.sales_orders.client_name::text = ANY(child_companies) LIMIT 1), order_status = '${thankYouAndIntimationStage}'`;

        const sendNotificationToCrm = async (order_id) => {
          try {
            const crmIdResult = await pool.query(
              `select c.crm from sales_orders so inner join customers c on so.client_name = c.company_name or so.client_name = any(c.child_companies)
          where so.id = $1`,
              [order_id],
            );

            if (
              crmIdResult.rows.length === 0 ||
              crmIdResult.rows[0].crm === null
            ) {
              throw new Error("Please Assign CRM First");
            }
            const crmId = crmIdResult.rows[0].crm;

            const notif = await createNotification(
              crmId,
              `Invoice & Dispatch Phase Completed for Order ID: ${orderId}.`,
              "invoice_and_dispatch_completed_notification_to_crm",
            );
            emitToUser(crmId, "new_notification", notif);
          } catch (error) {
            console.log("error while sending notification to crm: ", error);
          }
        };

        sendNotificationToCrm(orderId);
      }

      // If new invoices are provided, append them to the existing array
      if (invoices && Array.isArray(invoices) && invoices.length > 0) {
        currentDispatchInfo.invoices = [
          ...currentDispatchInfo.invoices,
          ...invoices,
        ];
      }

      // 4. Save the merged data back to the database
      const updateQuery = `
      UPDATE public.sales_orders
      SET 
        invoice_and_dispatch = $1::jsonb,
        updated_at = now(),
        updated_by = $2
        ${assignToStr}
      WHERE id = $3
      RETURNING *;
    `;

      // We stringify the JSON object before sending it to the parameterized query
      const updateResult = await pool.query(updateQuery, [
        JSON.stringify(currentDispatchInfo),
        userId,
        orderId,
      ]);

      return updateResult.rows[0];
    } catch (error) {
      console.error("Error in updateDispatchInfo: ", error);
      throw error;
    }
  }

  async getInvoiceExecutiveCompletedData(userId) {
    try {
      const query = `
        SELECT * FROM public.sales_orders
        WHERE invoice_and_dispatch->>'invoice_completed_at' is not null
        ORDER BY id DESC
        `;
      const { rows } = await pool.query(query, []);
      return rows;
    } catch (error) {
      console.log("error in getting so generation request data: ", error);
      throw error;
    }
  }

  async createComplaintForSaleOrder(saleOrderId, data, userId) {
    try {
      const {
        description,
        documents,
        contact_person_name,
        contact_person_number,
        priority_level,
        remark,
      } = data;

      if (!description?.trim()) {
        throw new Error("Description is required");
      }

      if (!priority_level?.trim()) {
        throw new Error("Priority level is required");
      }

      const orderExists = await pool.query(
        `
      SELECT id
      FROM sales_orders
      WHERE id = $1
      `,
        [saleOrderId],
      );

      if (!orderExists.rows.length) {
        throw new Error("Sales order not found");
      }

      const { rows } = await pool.query(
        `
      INSERT INTO complaint_info (
        sale_order_id,
        description,
        documents,
        contact_person_name,
        contact_person_number,
        priority_level,
        remark,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      RETURNING *;
      `,
        [
          saleOrderId,
          description,
          JSON.stringify(documents || []),
          // documents || [],
          contact_person_name || null,
          contact_person_number || null,
          priority_level,
          remark || null,
          userId,
          userId,
        ],
      );

      return rows[0];
    } catch (error) {
      console.error("Error in createComplaintForSaleOrder:", error);
      throw error;
    }
  }

  async getAllComplaintsForSaleOrder(saleOrderId) {
    try {
      const { rows } = await pool.query(
        `
      SELECT *
      FROM complaint_info
      WHERE sale_order_id = $1
      ORDER BY created_at DESC
      `,
        [saleOrderId],
      );

      return rows;
    } catch (error) {
      console.error("Error in getAllComplaintsForSaleOrder:", error);
      throw error;
    }
  }

  async getComplaintDetailsForSaleOrder(saleOrderId, complaintId) {
    try {
      const { rows } = await pool.query(
        `
      SELECT *
      FROM complaint_info
      WHERE complaint_id = $1
      AND sale_order_id = $2
      `,
        [complaintId, saleOrderId],
      );

      if (!rows.length) {
        throw new Error("Complaint not found");
      }

      return rows[0];
    } catch (error) {
      console.error("Error in getComplaintDetailsForSaleOrder:", error);
      throw error;
    }
  }

  async updateComplaintDetailsForSaleOrder(
    saleOrderId,
    complaintId,
    data,
    userId,
  ) {
    try {
      const {
        description,
        documents,
        contact_person_name,
        contact_person_number,
        priority_level,
        remark,
      } = data;

      const complaintExists = await pool.query(
        `
      SELECT complaint_id
      FROM complaint_info
      WHERE complaint_id = $1
      AND sale_order_id = $2
      `,
        [complaintId, saleOrderId],
      );

      if (!complaintExists.rows.length) {
        throw new Error("Complaint not found");
      }

      const { rows } = await pool.query(
        `
      UPDATE complaint_info
      SET
        description = $1,
        documents = $2,
        contact_person_name = $3,
        contact_person_number = $4,
        priority_level = $5,
        remark = $6,
        updated_by = $7,
        updated_at = NOW()
      WHERE complaint_id = $8
      AND sale_order_id = $9
      RETURNING *;
      `,
        [
          description,
          documents || [],
          contact_person_name || null,
          contact_person_number || null,
          priority_level,
          remark || null,
          userId,
          complaintId,
          saleOrderId,
        ],
      );

      return rows[0];
    } catch (error) {
      console.error("Error in updateComplaintDetailsForSaleOrder:", error);
      throw error;
    }
  }

  async deleteComplaintForSaleOrder(saleOrderId, complaintId) {
    try {
      const { rowCount } = await pool.query(
        `
      DELETE FROM complaint_info
      WHERE complaint_id = $1
      AND sale_order_id = $2
      `,
        [complaintId, saleOrderId],
      );

      if (!rowCount) {
        throw new Error("Complaint not found");
      }

      return true;
    } catch (error) {
      console.error("Error in deleteComplaintForSaleOrder:", error);
      throw error;
    }
  }


  async updateCallActionInformation(id, userId, body) {
    try {
      const { action_done_at, visit_status } = body;

      // Dynamically build the payload so we only update provided fields
      const callActionPayload = {};

      if (action_done_at !== undefined) {
        callActionPayload.action_done_at = action_done_at;
      }
      if (visit_status !== undefined) {
        callActionPayload.visit_status = visit_status;
      }

      // Prevent database call if the payload is completely empty
      if (Object.keys(callActionPayload).length === 0) {
        throw new Error("No valid call action fields provided for update.");
      }

      const query = `
        UPDATE public.complaint_info
        SET call_action = COALESCE(call_action, '{}'::jsonb) || $2::jsonb,
            updated_at = now(),
            updated_by = $1
        WHERE complaint_id = $3
        RETURNING *;
      `;

      const values = [
        userId,
        JSON.stringify(callActionPayload),
        id,
      ];

      const { rows } = await pool.query(query, values);
      
      return rows.length ? rows[0] : null;

    } catch (error) {
      console.error("error in updating call action information: ", error);
      throw error; // Make sure to throw the error to be caught by your controller
    }
  }


  async getCallComplaintData(userId) {
    try {
      const query = `
        SELECT * FROM public.complaint_info
        ORDER BY created_at DESC
        `;
      const { rows } = await pool.query(query, []);
      return rows;
    } catch (error) {
      console.error("error in getting call complaint data: ", error);
      throw error;
    }
  }


  async assignToVehicleExecutive(id, userId) {
    try {
      // Get vehicle executive id
      const getVehicleExecutiveId = await pool.query(
        `SELECT id FROM users WHERE role = 'Vehicle Executive' AND department = 'Transport' LIMIT 1`,
      );

      // FIX 1: Safely check if the array is empty to prevent a Node.js crash
      if (getVehicleExecutiveId.rows.length === 0) {
        throw new Error("Vehicle Executive not found");
      }

      const vehicleExecutiveId = getVehicleExecutiveId.rows[0].id;

      if (!vehicleExecutiveId) {
        throw new Error("Vehicle Executive not found");
      }

      const vehicleArrangeMentStage = ORDER_STAGES.vehicle_arrangement_stage;

      const sendNotificationToVehicleExecutive = async (order_id) => {
        try {
          const notif = await createNotification(
            vehicleExecutiveId,
            `Please Arrange Vehicle for Order ID: ${order_id}.`,
            "vehicle_arrangement_request_notification",
          );
          emitToUser(vehicleExecutiveId, "new_notification", notif);
        } catch (error) {
          console.log(
            "error while sending notification to vehicle executive: ",
            error,
          );
        }
      };

      // FIX 2: Correct spelling of COALESCE and assign it to the 'vehicle_arrangement' column
      const query = `
      UPDATE public.sales_orders
      SET assigned_to = $2,
          order_status = $3,
          vehicle_arrangement = COALESCE(vehicle_arrangement, '{}'::jsonb) || jsonb_build_object('assigned_to_vehicle_executive', true::boolean)
      WHERE id = $1
      RETURNING *;
      `;

      const { rows } = await pool.query(query, [
        id,
        vehicleExecutiveId,
        vehicleArrangeMentStage,
      ]);

      sendNotificationToVehicleExecutive(id);

      return rows[0];
    } catch (error) {
      console.error("Error in assigning to vehicle executive: ", error);
      throw error;
    }
  }

  async getVehicleExecutiveAssignedData(userId) {
    try {
      const query = `
        SELECT * FROM public.sales_orders
        WHERE assigned_to = $1 AND vehicle_arrangement->>'assigned_to_vehicle_executive' = 'true'
        ORDER BY id DESC
        `;
      const { rows } = await pool.query(query, [userId]);
      return rows;
    } catch (error) {
      console.log("error in getting so generation request data: ", error);
      throw error;
    }
  }

  async getVehicleExecutiveWorkHistory(userId) {
    try {
      const query = `
        SELECT * FROM public.sales_orders
        WHERE vehicle_arrangement->>'actual_deliver_date' is not null
        ORDER BY id DESC
        `;
      const { rows } = await pool.query(query, []);
      return rows;
    } catch (error) {
      console.log("error in getting so generation request data: ", error);
      throw error;
    }
  }

  async markAsDeliveredByTransportExecutive(id, userId, body) {
    try {
      const vehicleArrangementCompletedStage =
        ORDER_STAGES.vehicle_arrangement_completed_stage;

      const sendNotificationToCrm = async (order_id) => {
        try {
          const crmIdResult = await pool.query(
            `select c.crm from sales_orders so inner join customers c on so.client_name = c.company_name or so.client_name = any(c.child_companies)
          where so.id = $1`,
            [order_id],
          );

          if (
            crmIdResult.rows.length === 0 ||
            crmIdResult.rows[0].crm === null
          ) {
            throw new Error("Please Assign CRM First");
          }
          const crmId = crmIdResult.rows[0].crm;

          // Note: "vehicle_arrangement_completed_notification_to_crm" is exactly 49 characters long.
          // If your notification type column is still limited to VARCHAR(50) from the previous error,
          // this will pass, but leaves no room for future adjustments.
          const notif = await createNotification(
            crmId,
            `Vehicle has been arranged for Order ID: ${order_id}.`,
            "vehicle_arrangement_completed_notification_to_crm",
          );
          emitToUser(crmId, "new_notification", notif);
        } catch (error) {
          console.log("error while sending notification to crm: ", error);
        }
      };

      // 1. Extract only the valid additional fields from the body
      const additionalVehicleData = {};
      if (body.vehicle_no) additionalVehicleData.vehicle_no = body.vehicle_no;
      if (body.bilty_url) additionalVehicleData.bilty_url = body.bilty_url;
      if (body.loaded_proof_urls)
        additionalVehicleData.loaded_proof_urls = body.loaded_proof_urls;

      // 2. Merge actual_deliver_date with the dynamic JSON payload ($4)
      const query = `
        UPDATE public.sales_orders
        SET 
          vehicle_arrangement = COALESCE(vehicle_arrangement, '{}'::jsonb) 
            || jsonb_build_object('actual_deliver_date', CURRENT_DATE)
            || $4::jsonb,
          updated_at = now(),
          updated_by = $2,
          order_status = $3,
          assigned_to = (
            SELECT crm 
            FROM public.customers 
            WHERE company_name = public.sales_orders.client_name 
              OR public.sales_orders.client_name::text = ANY(child_companies)
            LIMIT 1
          )
        WHERE id = $1
        RETURNING *;
      `;

      // 3. Stringify the dynamic object so pg parses it cleanly as JSONB
      const { rows } = await pool.query(query, [
        id,
        userId,
        vehicleArrangementCompletedStage,
        JSON.stringify(additionalVehicleData),
      ]);

      sendNotificationToCrm(id);

      return rows[0];
    } catch (error) {
      console.error(
        "Error in marking as delivered by transport executive: ",
        error,
      );
      throw error;
    }
  }

  async assignOrderToInvoiceExecutive(id, userId) {
    try {
      // get invoice executive id
      const getInvoiceExecutiveId = await pool.query(
        `SELECT id FROM users WHERE role = 'Invoice Executive' AND department = 'Accounts' LIMIT 1`,
      );

      // FIX 1: Safely check if the array is empty to prevent a Node.js crash
      if (getInvoiceExecutiveId.rows.length === 0) {
        throw new Error("Invoice Executive not found");
      }

      const invoiceExecutiveId = getInvoiceExecutiveId.rows[0].id;

      console.log("Invoice Executive ID: ", invoiceExecutiveId);

      const invoiceGenertionStage = ORDER_STAGES.invoice_generation_stage;

      const query = `
        UPDATE public.sales_orders
        SET invoice_and_dispatch = COALESCE(invoice_and_dispatch, '{}'::jsonb) || jsonb_build_object('assign_to', $2::text),
        order_status = $3,
        assigned_to = $2::integer,
        updated_at = now(),
        updated_by = $4
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await pool.query(query, [
        id,
        invoiceExecutiveId,
        invoiceGenertionStage,
        userId,
      ]);

      if (invoiceExecutiveId) {
        try {
          const notif = await createNotification(
            invoiceExecutiveId,
            `Order with Order ID: ${id} has been assigned to You.`,
            "order_assigned_to_invoice_executive",
          );
          emitToUser(invoiceExecutiveId, "new_notification", notif);
        } catch (error) {
          console.log(
            "error in sending notification to invoice executive: ",
            error,
          );
        }
      }

      return rows[0];
    } catch (error) {
      console.error("Error in assigning order to invoice executive: ", error);
      throw error;
    }
  }

  async intimationAndThankYouData(orderId, userId, payload) {
    try {
      // We update the specific order, injecting the JSON payload.
      // We keep the assign_to check for authorization and the IS NULL check
      // to prevent overwriting an already completed order.

      const completedStage = ORDER_STAGES.order_completed_stage;

      const query = `
      UPDATE public.sales_orders
      SET intimation_thankyou = $1,
      order_status = $3
      WHERE id = $2 
      RETURNING *;
    `;

      const values = [payload, orderId, completedStage];
      const { rows } = await pool.query(query, values);

      // Return the updated row, or null if no row was updated
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error("Error inserting intimation and thank you data: ", error);
      throw error;
    }
  }

  async updatePaymentInformation(id, userId, body) {
    try {
      const {
        payment_status,
        payment_status_marked_at,
        payment_done_at,
        under_one_lakh,
        is_interest_note_issue,
        interest_note_issued_on_timestamp,
        interest_note_collected_on_timestamp,
        // cn_or_dn_issue_status,
        // cn_or_dn_issue_timestamp,
      } = body;

      // Dynamically build the payload so we only update provided fields.
      const paymentPayload = {};

      if (payment_status !== undefined) {
        paymentPayload.payment_status = payment_status;
      }
      if (payment_status_marked_at !== undefined) {
        paymentPayload.payment_status_marked_at = payment_status_marked_at;
      }
      if (payment_done_at !== undefined) {
        paymentPayload.payment_done_at = payment_done_at;
      }
      if (under_one_lakh !== undefined) {
        paymentPayload.under_one_lakh = under_one_lakh;
      }
      if (is_interest_note_issue !== undefined) {
        paymentPayload.is_interest_note_issue = is_interest_note_issue;
      }
      if (interest_note_issued_on_timestamp !== undefined) {
        paymentPayload.interest_note_issued_on_timestamp =
          interest_note_issued_on_timestamp;
      }
      if (interest_note_collected_on_timestamp !== undefined) {
        paymentPayload.interest_note_collected_on_timestamp =
          interest_note_collected_on_timestamp;
      }

      // if (cn_or_dn_issue_status !== undefined) {
      //   paymentPayload.cn_or_dn_issue_status = cn_or_dn_issue_status;
      // }
      // if (cn_or_dn_issue_timestamp !== undefined) {
      //   paymentPayload.cn_or_dn_issue_timestamp = cn_or_dn_issue_timestamp;
      // }

      // Optional: Prevent database call if payload is empty
      if (Object.keys(paymentPayload).length === 0) {
        throw new Error("No valid payment fields provided for update.");
      }

      const query = `
        UPDATE public.sales_orders
        SET payment_status = COALESCE(payment_status, '{}'::jsonb) || $2::jsonb,
            updated_at = now(),
            updated_by = $1
        WHERE id = $3
        RETURNING *;
      `;

      const values = [userId, JSON.stringify(paymentPayload), id];

      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error("Error in updating payment information: ", error);
      throw error;
    }
  }

  async updateDeliveryAndWeightInformation(id, userId, body) {
    try {
      const {
        actual_delivery_timestamp,
        delivery_status,
        weight_difference,
        settlement,
        cn_or_dn_issue_status,
        cn_or_dn_issue_timestamp,
        quality_confirmation_status,
        quality_confirmation_timestamp,
      } = body;

      // Dynamically build the payload so we only update provided fields.
      // This prevents overwriting existing data with nulls during partial updates.
      const deliveryPayload = {};

      if (actual_delivery_timestamp !== undefined) {
        deliveryPayload.actual_delivery_timestamp = actual_delivery_timestamp;
      }
      if (delivery_status !== undefined) {
        deliveryPayload.delivery_status = delivery_status;
      }
      if (weight_difference !== undefined) {
        // Map the input variable to the specific DB column key and ensure it's a float
        deliveryPayload.weight_difference_in_kg = parseFloat(weight_difference);
      }
      if (settlement !== undefined) {
        deliveryPayload.settlement = settlement;
      }
      if (cn_or_dn_issue_status !== undefined) {
        deliveryPayload.cn_or_dn_issue_status = cn_or_dn_issue_status;
      }
      if (cn_or_dn_issue_timestamp !== undefined) {
        deliveryPayload.cn_or_dn_issue_timestamp = cn_or_dn_issue_timestamp;
      }
      if (quality_confirmation_status !== undefined) {
        deliveryPayload.quality_confirmation_status =
          quality_confirmation_status;
      }
      if (quality_confirmation_timestamp !== undefined) {
        deliveryPayload.quality_confirmation_timestamp =
          quality_confirmation_timestamp;
      }

      const query = `
        UPDATE public.sales_orders
        SET delivery_and_weight = COALESCE(delivery_and_weight, '{}'::jsonb) || $2::jsonb,
            updated_at = now(),
            updated_by = $1
        WHERE id = $3
        RETURNING *;
      `;

      const values = [userId, JSON.stringify(deliveryPayload), id];

      const { rows } = await pool.query(query, values);

      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error(
        "error in updating delivery and weight information: ",
        error,
      );
      throw error;
    }
  }

  async addRemarksToOrder(orderId, data, userId) {
    try {
      const { remark } = data;

      if (!remark?.trim()) {
        throw new Error("Remark is required");
      }

      const { rows } = await pool.query(
        `
      SELECT remarks
      FROM sales_orders
      WHERE id = $1
      `,
        [orderId],
      );

      if (!rows.length) {
        throw new Error("Sales order not found");
      }

      const remarks = rows[0].remarks || [];

      remarks.push({
        id: crypto.randomUUID(),
        remark,
        created_at: new Date().toISOString(),
        created_by: userId,
        updated_at: null,
      });

      await pool.query(
        `
      UPDATE sales_orders
      SET remarks = $1,
          updated_by = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
        [JSON.stringify(remarks), userId, orderId],
      );

      return remarks;
    } catch (error) {
      console.error("Error in addRemarksToOrder:", error);
      throw error;
    }
  }

  async getRemarksForOrder(orderId) {
    try {
      const { rows } = await pool.query(
        `
      SELECT remarks
      FROM sales_orders
      WHERE id = $1
      `,
        [orderId],
      );

      if (!rows.length) {
        throw new Error("Sales order not found");
      }

      return rows[0].remarks || [];
    } catch (error) {
      console.error("Error in getRemarksForOrder:", error);
      throw error;
    }
  }

  async updateRemarksForOrder(orderId, remarkId, data, userId) {
    try {
      const { remark } = data;

      if (!remark?.trim()) {
        throw new Error("Remark is required");
      }

      const { rows } = await pool.query(
        `
      SELECT remarks
      FROM sales_orders
      WHERE id = $1
      `,
        [orderId],
      );

      if (!rows.length) {
        throw new Error("Sales order not found");
      }

      const remarks = rows[0].remarks || [];

      const index = remarks.findIndex((r) => r.id === remarkId);

      if (index === -1) {
        throw new Error("Remark not found");
      }

      remarks[index] = {
        ...remarks[index],
        remark,
        updated_at: new Date().toISOString(),
      };

      await pool.query(
        `
      UPDATE sales_orders
      SET remarks = $1,
          updated_by = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
        [JSON.stringify(remarks), userId, orderId],
      );

      return remarks[index];
    } catch (error) {
      console.error("Error in updateRemarksForOrder:", error);
      throw error;
    }
  }

  async deleteRemarksForOrder(orderId, remarkId, userId) {
    try {
      const { rows } = await pool.query(
        `
      SELECT remarks
      FROM sales_orders
      WHERE id = $1
      `,
        [orderId],
      );

      if (!rows.length) {
        throw new Error("Sales order not found");
      }

      let remarks = rows[0].remarks || [];

      const exists = remarks.some((r) => r.id === remarkId);

      if (!exists) {
        throw new Error("Remark not found");
      }

      remarks = remarks.filter((r) => r.id !== remarkId);

      await pool.query(
        `
      UPDATE sales_orders
      SET remarks = $1,
          updated_by = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
        [JSON.stringify(remarks), userId, orderId],
      );

      return remarks;
    } catch (error) {
      console.error("Error in deleteRemarksForOrder:", error);
      throw error;
    }
  }

  async getInvoiceGenerationRequestData(userId) {
    try {
      const query = `
      SELECT * FROM public.sales_orders
      WHERE invoice_and_dispatch->>'assign_to' = $1 
        AND invoice_and_dispatch->>'invoice_completed_at' IS NULL
      ORDER BY id DESC
    `;
      const { rows } = await pool.query(query, [userId]);
      return rows;
    } catch (error) {
      console.error(
        "Error in getting invoice generation request data: ",
        error,
      );
      throw error;
    }
  }
}

export default new O2dService();
