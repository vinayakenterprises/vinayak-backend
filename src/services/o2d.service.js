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
    } = data;

    const query = `
      INSERT INTO public.sales_orders (
        client_name, rate, ex_works_rate, freight, quantity_mt, rod_size,
        delivery_date, bill_to, ship_to, dispatch_type, sales_person_name,
        assigned_to, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
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

  async getAllSaleOrder() {
    const query = "SELECT * FROM public.sales_orders ORDER BY id DESC";
    const { rows } = await pool.query(query);
    return rows;
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
        SELECT * FROM public.sales_orders
        WHERE assigned_to = $1 AND sale_order_generation->>'sent_for_so' = 'true' and sale_order_generation->>'so_order_completed_at' is not null ORDER BY id DESC`;
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



}

export default new O2dService();
