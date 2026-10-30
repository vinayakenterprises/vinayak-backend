import pool from "../config/database.js";

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
}

export default new PurchaseService();
