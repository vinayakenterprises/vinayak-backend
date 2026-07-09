import pool from "../config/database.js";

class ImsService {

    async createCategory(categoryData) {
        let { name, dailyAvg, leadTime, safetyFactor, maxLevel } = categoryData;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            throw new Error("Category name is required.");
        }

        const query = `
            INSERT INTO ims_material_categories 
                (name, daily_avg, lead_time, safety_factor, max_level) 
            VALUES 
                ($1, COALESCE($2, 0), COALESCE($3, 3), COALESCE($4, 1), COALESCE($5, 0))
            RETURNING *;
        `;

        try {
            const { rows } = await pool.query(query, [name.trim(), dailyAvg, leadTime, safetyFactor, maxLevel]);
            return rows[0];
        } catch (error) {
            console.error("Error in creating category:", error);
            throw error;
        }
    }

    async getAllCategories() {
        const query = `
            SELECT id, name, daily_avg, lead_time, safety_factor, max_level, created_at, updated_at 
            FROM ims_material_categories 
            WHERE is_deleted = FALSE
            ORDER BY id ASC;
        `;

        try {
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            console.error("Error in getting all material categories:", error);
            throw error;
        }
    }

    async getCategoryById(id) {
        if (!id || isNaN(Number(id))) throw new Error("A valid category ID is required.");

        const query = `
            SELECT id, name, daily_avg, lead_time, safety_factor, max_level, created_at, updated_at 
            FROM ims_material_categories 
            WHERE id = $1 AND is_deleted = FALSE;
        `;

        try {
            const { rows } = await pool.query(query, [id]);
            if (rows.length === 0) throw new Error(`Category with ID ${id} not found.`);
            return rows[0];
        } catch (error) {
            console.error("Error while fetching data based on category Id:", error);
            throw error;
        }
    }

    async updateCategory(id, updateData) {
        if (!id || isNaN(Number(id))) throw new Error("A valid category ID is required.");

        const { name, daily_avg, lead_time, safety_factor, max_level } = updateData;

        if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
            throw new Error("Category name cannot be empty.");
        }

        const query = `
            UPDATE ims_material_categories 
            SET 
                name = COALESCE($1, name),
                daily_avg = COALESCE($2, daily_avg),
                lead_time = COALESCE($3, lead_time),
                safety_factor = COALESCE($4, safety_factor),
                max_level = COALESCE($5, max_level),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND is_deleted = FALSE
            RETURNING *;
        `;

        try {
            const { rows } = await pool.query(query, [
                name ? name.trim() : undefined,
                daily_avg, lead_time, safety_factor, max_level, id
            ]);
            if (rows.length === 0) throw new Error(`Category with ID ${id} not found.`);
            return rows[0];
        } catch (error) {
            console.error("Error while updating the category:", error);
            throw error;
        }
    }

    async removeCategory(id) {
        if (!id || isNaN(Number(id))) throw new Error("A valid category ID is required.");

        // FIXED: Changed from DELETE FROM to UPDATE
        const query = `
            UPDATE ims_material_categories 
            SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_deleted = FALSE
            RETURNING *;
        `;

        try {
            const { rows } = await pool.query(query, [id]);
            if (rows.length === 0) throw new Error(`Category with ID ${id} not found.`);
            return rows[0];
        } catch (error) {
            console.error("Error in removing category:", error);
            throw error;
        }
    }

    async createMaterial(materialData) {
        let { category_id, name } = materialData;

        if (!category_id || isNaN(Number(category_id))) throw new Error("A valid category_id is required.");
        if (!name || typeof name !== 'string' || name.trim() === '') throw new Error("Material name is required.");

        const query = `
            INSERT INTO ims_materials (category_id, name) 
            VALUES ($1, $2) RETURNING *;
        `;

        try {
            const { rows } = await pool.query(query, [category_id, name.trim()]);
            return rows[0];
        } catch (error) {
            console.error("Error in creating material:", error);
            throw error;
        }
    }

    async getAllMaterials() {
        const query = `
            SELECT 
                m.id, m.category_id, c.name AS category_name, m.name, m.created_at, m.updated_at 
            FROM ims_materials m
            JOIN ims_material_categories c ON m.category_id = c.id
            WHERE m.is_deleted = FALSE AND c.is_deleted = FALSE
            ORDER BY c.name ASC, m.name ASC;
        `;

        try {
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            console.error("Error in getting materials:", error);
            throw error;
        }
    }

    async getMaterialById(id) {
        if (!id || isNaN(Number(id))) throw new Error("A valid material ID is required.");

        const query = `
            SELECT 
                m.id, m.category_id, c.name AS category_name, m.name, m.created_at, m.updated_at,
                COALESCE(SUM(CASE WHEN i.status = 'AVAILABLE' THEN i.quantity ELSE 0 END), 0) AS available_stock,
                COALESCE(SUM(CASE WHEN i.status = 'PENDING_QUALITY' THEN i.quantity ELSE 0 END), 0) AS pending_stock,
                COALESCE(SUM(CASE WHEN i.status = 'NOT_OK' THEN i.quantity ELSE 0 END), 0) AS rejected_stock
            FROM ims_materials m
            LEFT JOIN ims_material_categories c ON m.category_id = c.id
            LEFT JOIN ims_inventory i ON m.id = i.material_id AND i.is_deleted = FALSE
            WHERE m.id = $1 AND m.is_deleted = FALSE
            GROUP BY m.id, m.category_id, c.name, m.name, m.created_at, m.updated_at;
        `;

        try {
            const { rows } = await pool.query(query, [id]);
            if (rows.length === 0) throw new Error(`Material with ID ${id} not found.`);
            return rows[0];
        } catch (error) {
            console.error("Error in getting materials by id:", error);
            throw error;
        }
    }

    async updateMaterial(id, updateData) {
        if (!id || isNaN(Number(id))) throw new Error("A valid material ID is required.");

        const { name, category_id } = updateData;

        const query = `
            WITH updated_material AS (
                UPDATE ims_materials 
                SET 
                    name = COALESCE($1, name),
                    category_id = COALESCE($2, category_id),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3 AND is_deleted = FALSE
                RETURNING *
            )
            SELECT 
                u.id, u.category_id, c.name AS category_name, u.name, u.created_at, u.updated_at 
            FROM updated_material u
            JOIN ims_material_categories c ON u.category_id = c.id;
        `;

        try {
            const { rows } = await pool.query(query, [name, category_id, id]);
            if (rows.length === 0) throw new Error(`Material with ID ${id} not found.`);
            return rows[0];
        } catch (error) {
            console.error("Error in updating the material:", error);
            throw error;
        }
    }

    async removeMaterial(id) {
        if (!id || isNaN(Number(id))) throw new Error("A valid material ID is required.");

        const query = `
            UPDATE ims_materials 
            SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_deleted = FALSE
            RETURNING *;
        `;

        try {
            const { rows } = await pool.query(query, [id]);
            if (rows.length === 0) throw new Error(`Material with ID ${id} not found.`);
            return rows[0];
        } catch (error) {
            console.error("Error in removing material:", error);
            throw error;
        }
    }

    async receiveNewShipment(data) {
        const { material_id, quantity, created_by } = data;

        if (!material_id || isNaN(Number(material_id))) throw new Error("A valid material_id is required.");
        if (quantity === undefined || isNaN(Number(quantity)) || Number(quantity) <= 0) throw new Error("Quantity must be a positive number.");
        if (!created_by) throw new Error("User authorization is missing.");

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const checkMaterialQuery = `SELECT id FROM ims_materials WHERE id = $1 AND is_deleted = FALSE`;
            const checkRes = await client.query(checkMaterialQuery, [Number(material_id)]);
            if (checkRes.rowCount === 0) throw new Error("The provided material_id does not exist or has been deleted.");

            const upsertQuery = `
                INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by) 
                VALUES ($1, $2, 'PENDING_QUALITY', $3, $3)
                ON CONFLICT (material_id, status) 
                DO UPDATE SET 
                    quantity = ims_inventory.quantity + EXCLUDED.quantity,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *;
            `;
            const { rows } = await client.query(upsertQuery, [Number(material_id), Number(quantity), created_by]);

            const logQuery = `
                INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, created_by) 
                VALUES ($1, 'RECEIVED', $2, $3);
            `;
            await client.query(logQuery, [Number(material_id), Number(quantity), created_by]);

            await client.query('COMMIT');
            return rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error while creating new shipment:", error);
            throw new Error("An unexpected error occurred while processing the shipment.");
        } finally {
            client.release();
        }
    }

    async getPendingQualityData() {
        const query = `
            SELECT 
                i.id AS inventory_id, i.material_id, m.name AS material_name, 
                c.name AS category_name, i.quantity, i.status, i.updated_at
            FROM ims_inventory i
            JOIN ims_materials m ON i.material_id = m.id
            JOIN ims_material_categories c ON m.category_id = c.id
            WHERE i.status = 'PENDING_QUALITY' AND i.is_deleted = FALSE AND m.is_deleted = FALSE
            ORDER BY i.updated_at ASC; 
        `;

        try {
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            console.error("Error while fetching pending-quality data:", error);
            throw error;
        }
    }

    async processQualityCheck(data) {
        const { material_id, approved_quantity = 0, rejected_quantity = 0, updated_by } = data;

        if (!material_id || isNaN(Number(material_id))) throw new Error("A valid material_id is required.");

        const totalProcessed = Number(approved_quantity) + Number(rejected_quantity);
        if (totalProcessed === 0) throw new Error("You must provide either an approved or rejected quantity.");
        if (!updated_by) throw new Error("User authorization is missing.");

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const checkQuery = `
                SELECT quantity FROM ims_inventory 
                WHERE material_id = $1 AND status = 'PENDING_QUALITY' AND is_deleted = FALSE
                FOR UPDATE;
            `;
            const { rows } = await client.query(checkQuery, [material_id]);
            if (rows.length === 0) throw new Error("No pending quality stock found for this material.");

            const currentPending = Number(rows[0].quantity);
            if (currentPending < totalProcessed) {
                throw new Error(`Cannot process ${totalProcessed}. Only ${currentPending} available in pending.`);
            }

            await client.query(`
                UPDATE ims_inventory 
                SET quantity = quantity - $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
                WHERE material_id = $3 AND status = 'PENDING_QUALITY' AND is_deleted = FALSE
            `, [totalProcessed, updated_by, material_id]);

            if (approved_quantity > 0) {
                await client.query(`
                    INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by) 
                    VALUES ($1, $2, 'AVAILABLE', $3, $3)
                    ON CONFLICT (material_id, status) 
                    DO UPDATE SET 
                        quantity = ims_inventory.quantity + EXCLUDED.quantity,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = CURRENT_TIMESTAMP
                `, [material_id, Number(approved_quantity), updated_by]);

                await client.query(`
                    INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, created_by) 
                    VALUES ($1, 'QA_APPROVED', $2, $3)
                `, [material_id, Number(approved_quantity), updated_by]);
            }

            if (rejected_quantity > 0) {
                await client.query(`
                    INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by) 
                    VALUES ($1, $2, 'NOT_OK', $3, $3)
                    ON CONFLICT (material_id, status) 
                    DO UPDATE SET 
                        quantity = ims_inventory.quantity + EXCLUDED.quantity,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = CURRENT_TIMESTAMP
                `, [material_id, Number(rejected_quantity), updated_by]);

                await client.query(`
                    INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, created_by) 
                    VALUES ($1, 'QA_REJECTED', $2, $3)
                `, [material_id, Number(rejected_quantity), updated_by]);
            }

            await client.query('COMMIT');
            return { message: "Quality check processed successfully" };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error while processing quality check:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateDailyStockCount(data) {
        const { material_id, status, quantity, updated_by } = data;

        if (!material_id || isNaN(Number(material_id))) {
            throw new Error("A valid material_id is required.");
        }

        const validStatuses = ['AVAILABLE', 'PENDING_QUALITY', 'NOT_OK'];

        if (!validStatuses.includes(status)) {
            throw new Error("Status must be 'AVAILABLE', 'PENDING_QUALITY', or 'NOT_OK'.");
        }

        if (quantity === undefined || isNaN(Number(quantity)) || Number(quantity) < 0) {
            throw new Error("Quantity must be a valid non-negative number.");
        }

        if (!updated_by) {
            throw new Error("User authorization is missing.");
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Check material exists
            const materialResult = await client.query(
                `SELECT id
             FROM ims_materials
             WHERE id = $1
             AND is_deleted = FALSE`,
                [Number(material_id)]
            );

            if (materialResult.rowCount === 0) {
                throw new Error("The provided material_id does not exist or has been deleted.");
            }

            // Get current stock
            const inventoryResult = await client.query(
                `SELECT quantity
             FROM ims_inventory
             WHERE material_id = $1
             AND status = $2`,
                [Number(material_id), status]
            );

            const previousStock =
                inventoryResult.rowCount > 0
                    ? Number(inventoryResult.rows[0].quantity)
                    : 0;

            const currentStock = Number(quantity);
            const difference = currentStock - previousStock;

            // Upsert inventory
            const inventory = await client.query(
                `
            INSERT INTO ims_inventory
                (material_id, quantity, status, created_by, updated_by)
            VALUES
                ($1, $2, $3, $4, $4)
            ON CONFLICT (material_id, status)
            DO UPDATE SET
                quantity = EXCLUDED.quantity,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
            `,
                [
                    Number(material_id),
                    currentStock,
                    status,
                    updated_by
                ]
            );

            // Log transaction only if stock changed
            if (difference !== 0) {
                // 1. Log manual adjustment audit log
                await client.query(
                    `
                INSERT INTO ims_inventory_transactions
                (
                    material_id,
                    transaction_type,
                    quantity,
                    created_by
                )
                VALUES
                (
                    $1,
                    'MANUAL_ADJUSTMENT',
                    $2,
                    $3
                );
                `,
                    [
                        Number(material_id),
                        difference,
                        updated_by
                    ]
                );

                // 2. Log corresponding flow transaction for the current date
                let flowType = null;
                if (status === 'AVAILABLE') {
                    flowType = 'QA_APPROVED';
                } else if (status === 'PENDING_QUALITY') {
                    flowType = 'RECEIVED';
                } else if (status === 'NOT_OK') {
                    flowType = 'QA_REJECTED';
                }

                if (flowType) {
                    await client.query(
                        `
                    INSERT INTO ims_inventory_transactions
                    (
                        material_id,
                        transaction_type,
                        quantity,
                        created_by
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4
                    );
                    `,
                        [
                            Number(material_id),
                            flowType,
                            difference,
                            updated_by
                        ]
                    );
                }
            }

            await client.query("COMMIT");

            return inventory.rows[0];
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Error while updating daily stock count:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getInventoryMatrixData() {
        const query = `
            SELECT 
                m.id AS material_id, m.name AS material_name, c.name AS category_name,
                COALESCE(SUM(CASE WHEN i.status = 'AVAILABLE' THEN i.quantity ELSE 0 END), 0) AS available_stock,
                COALESCE(SUM(CASE WHEN i.status = 'PENDING_QUALITY' THEN i.quantity ELSE 0 END), 0) AS pending_stock,
                COALESCE(SUM(CASE WHEN i.status = 'NOT_OK' THEN i.quantity ELSE 0 END), 0) AS rejected_stock,
                COALESCE(SUM(i.quantity), 0) AS total_physical_stock
            FROM ims_materials m
            LEFT JOIN ims_material_categories c ON m.category_id = c.id AND c.is_deleted = FALSE
            LEFT JOIN ims_inventory i ON m.id = i.material_id AND i.is_deleted = FALSE
            WHERE m.is_deleted = FALSE
            GROUP BY m.id, m.name, c.name
            ORDER BY c.name ASC, m.name ASC;
        `;

        try {
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            console.error("Error while fetching Inventory data:", error);
            throw error;
        }
    }

    async getRejectedMaterialData() {
        const query = `
            SELECT 
                i.id AS inventory_id, i.material_id, m.name AS material_name, 
                c.name AS category_name, i.quantity, i.status, i.updated_at
            FROM ims_inventory i
            JOIN ims_materials m ON i.material_id = m.id
            JOIN ims_material_categories c ON m.category_id = c.id
            WHERE i.status = 'NOT_OK' AND i.is_deleted = FALSE AND m.is_deleted = FALSE
            ORDER BY i.updated_at DESC; 
        `;

        try {
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            console.error("Error while fetching rejected data:", error);
            throw error;
        }
    }

    async getDailySummaryMetrics() {
        const query = `
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'AVAILABLE' THEN quantity ELSE 0 END), 0) AS total_available_stock,
                COALESCE(SUM(CASE WHEN status = 'PENDING_QUALITY' THEN quantity ELSE 0 END), 0) AS total_pending_qa,
                COALESCE(SUM(CASE WHEN status = 'NOT_OK' THEN quantity ELSE 0 END), 0) AS total_rejected_stock
            FROM ims_inventory
            WHERE is_deleted = FALSE;
        `;

        try {
            const { rows } = await pool.query(query);
            return rows[0];
        } catch (error) {
            console.error("Error while getting summary metrics:", error);
            throw error;
        }
    }

    async getFilteredInventory(params) {
        const { startDate, endDate } = params;

        if (!startDate || !endDate) throw new Error("Both 'startDate' and 'endDate' are required.");

        const query = `
            WITH DailyFlow AS (
                SELECT 
                    material_id,
                    transaction_date,
                    SUM(CASE WHEN transaction_type = 'RECEIVED' THEN quantity ELSE 0 END) AS daily_received,
                    SUM(CASE WHEN transaction_type = 'QA_APPROVED' THEN quantity ELSE 0 END) AS daily_approved,
                    SUM(CASE WHEN transaction_type = 'QA_REJECTED' THEN quantity ELSE 0 END) AS daily_rejected
                FROM ims_inventory_transactions
                WHERE transaction_date BETWEEN $1 AND $2 AND is_deleted = FALSE
                GROUP BY material_id, transaction_date
            ),
            AggregatedDailyFlow AS (
                SELECT 
                    material_id,
                    JSON_OBJECT_AGG(transaction_date, daily_received) FILTER (WHERE transaction_date IS NOT NULL AND daily_received > 0) AS daily_flow_received,
                    JSON_OBJECT_AGG(transaction_date, daily_approved) FILTER (WHERE transaction_date IS NOT NULL AND daily_approved > 0) AS daily_flow_approved,
                    JSON_OBJECT_AGG(transaction_date, daily_rejected) FILTER (WHERE transaction_date IS NOT NULL AND daily_rejected > 0) AS daily_flow_rejected
                FROM DailyFlow
                GROUP BY material_id
            ),
            AggregatedInventory AS (
                SELECT 
                    material_id,
                    COALESCE(SUM(CASE WHEN status = 'AVAILABLE' THEN quantity ELSE 0 END), 0) AS available_stock,
                    COALESCE(SUM(CASE WHEN status = 'PENDING_QUALITY' THEN quantity ELSE 0 END), 0) AS pending_stock,
                    COALESCE(SUM(CASE WHEN status = 'NOT_OK' THEN quantity ELSE 0 END), 0) AS rejected_stock,
                    COALESCE(SUM(quantity), 0) AS current_total_stock
                FROM ims_inventory
                WHERE is_deleted = FALSE
                GROUP BY material_id
            )
            SELECT 
                m.id AS material_id, m.name AS material_name, c.name AS category_name,
                COALESCE(ai.available_stock, 0) AS available_stock,
                COALESCE(ai.pending_stock, 0) AS pending_stock,
                COALESCE(ai.rejected_stock, 0) AS rejected_stock,
                COALESCE(ai.current_total_stock, 0) AS current_total_stock,
                COALESCE(adf.daily_flow_received, '{}') AS daily_flow_received,
                COALESCE(adf.daily_flow_approved, '{}') AS daily_flow_approved,
                COALESCE(adf.daily_flow_rejected, '{}') AS daily_flow_rejected
            FROM ims_materials m
            LEFT JOIN ims_material_categories c ON m.category_id = c.id AND c.is_deleted = FALSE
            LEFT JOIN AggregatedInventory ai ON m.id = ai.material_id
            LEFT JOIN AggregatedDailyFlow adf ON m.id = adf.material_id
            WHERE m.is_deleted = FALSE
            ORDER BY c.name ASC, m.name ASC;
        `;

        try {
            const { rows } = await pool.query(query, [startDate, endDate]);
            return rows;
        } catch (error) {
            console.error("Error fetching filtered inventory:", error);
            throw new Error("Failed to fetch inventory data.");
        }
    }
}

export default new ImsService();