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

    console.log("data", data);

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
}

export default new O2dService();
