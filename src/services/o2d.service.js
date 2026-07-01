import pool from "../config/database.js";

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
    } = data;

    const query = `
      INSERT INTO public.sales_orders (
        client_name, rate, ex_works_rate, freight, quantity_mt, rod_size,
        delivery_date, bill_to, ship_to, dispatch_type, sales_person_name,
        assigned_to, created_by, updated_by, credit_limit_info
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
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
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async getAllClientNamesList() {
    try {
      const query = `
      SELECT ARRAY_AGG(client_name) AS master_client_list
      FROM (
          SELECT company_name AS client_name FROM customers
          UNION
          SELECT UNNEST(child_companies) AS client_name 
          FROM customers 
          WHERE child_companies IS NOT NULL
      ) AS combined_names;
    `;
      const { rows } = await pool.query(query);

      // Here, rows[0] is correct because the query only returns exactly 1 row containing the aggregated array
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

  async retrieveAllCustomersList() {
    const query = "SELECT * FROM public.customers ORDER BY id DESC";
    const { rows } = await pool.query(query);
    return rows;
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
          `select sum(quantity_mt) as total_pending_quantity from sales_orders where client_name = $1 and payment_status is null`,
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
      const { order_id } = body;

      if (!order_id) {
        throw new Error("Order ID is required");
      }

      const approveQuery = `
        UPDATE sales_orders
        SET credit_limit_info = COALESCE(credit_limit_info, '{}'::jsonb)
            || jsonb_build_object('credit_limit_request_approved_at', now())
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await pool.query(approveQuery, [order_id]);
      return rows[0] || null;
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

      const query = `
        UPDATE public.sales_orders
        SET sale_order_generation = COALESCE(sale_order_generation, '{}'::jsonb) || jsonb_build_object(
            'so_order_completed_at', now(),
            'document_url', $3::text
        ),
        assigned_to = $4,
        updated_at = now(),
        updated_by = $2
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await pool.query(query, [
        id,
        userId,
        document_url,
        crmId,
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
          AND so.sale_order_generation->>'so_order_completed_at' IS NOT NULL 
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
      const { actual_dispatch_date, invoices } = dispatchData;

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

      // FIX 2: Correct spelling of COALESCE and assign it to the 'vehicle_arrangement' column
      const query = `
      UPDATE public.sales_orders
      SET assigned_to = $2, 
          vehicle_arrangement = COALESCE(vehicle_arrangement, '{}'::jsonb) || jsonb_build_object('assigned_to_vehicle_executive', true::boolean)
      WHERE id = $1
      RETURNING *;
    `;

      const { rows } = await pool.query(query, [id, vehicleExecutiveId]);
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

  async markAsDeliveredByTransportExecutive(id, userId) {
    try {
      const query = `
        UPDATE public.sales_orders
        SET 
          vehicle_arrangement = COALESCE(vehicle_arrangement, '{}'::jsonb) || jsonb_build_object('actual_deliver_date', CURRENT_DATE),
          updated_at = now(),
          updated_by = $2,
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

      const { rows } = await pool.query(query, [id, userId]);
      return rows[0];
    } catch (error) {
      console.error(
        "Error in marking as delivered by transport executive: ",
        error,
      );
      throw error;
    }
  }
}

export default new O2dService();
