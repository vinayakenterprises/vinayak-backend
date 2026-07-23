import pool from "../config/database.js";
import { createNotification } from "./notification.service.js";
import { emitToUser } from "../utils/socket.js";

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
            ORDER BY m.category_id ASC, m.id ASC;
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
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Get current material details
            const currentRes = await client.query(
                `SELECT name, category_id FROM ims_materials WHERE id = $1 AND is_deleted = FALSE`,
                [Number(id)]
            );
            if (currentRes.rows.length === 0) throw new Error(`Material with ID ${id} not found.`);
            const currentMaterial = currentRes.rows[0];

            const newName = name !== undefined ? name : currentMaterial.name;
            const newCategoryId = category_id !== undefined ? Number(category_id) : currentMaterial.category_id;

            // 2. Check for duplicate name in target category (other than this material)
            const duplicateCheck = await client.query(
                `SELECT id FROM ims_materials 
                 WHERE category_id = $1 AND name = $2 AND id <> $3 AND is_deleted = FALSE`,
                [newCategoryId, newName, Number(id)]
            );

            if (duplicateCheck.rows.length > 0) {
                // Perform a merge!
                const targetMaterialId = duplicateCheck.rows[0].id;

                // Move transactions
                await client.query(
                    `UPDATE ims_inventory_transactions SET material_id = $1 WHERE material_id = $2`,
                    [targetMaterialId, Number(id)]
                );

                // Move/Merge inventory quantities
                const sourceInventory = await client.query(
                    `SELECT quantity, status FROM ims_inventory WHERE material_id = $1 AND is_deleted = FALSE`,
                    [Number(id)]
                );

                for (const inv of sourceInventory.rows) {
                    await client.query(
                        `INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by)
                         VALUES ($1, $2, $3, 1, 1)
                         ON CONFLICT (material_id, status)
                         DO UPDATE SET 
                             quantity = ims_inventory.quantity + EXCLUDED.quantity,
                             updated_at = CURRENT_TIMESTAMP
                        `,
                        [targetMaterialId, Number(inv.quantity), inv.status]
                    );
                }

                // Delete old inventory rows
                await client.query(
                    `UPDATE ims_inventory SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE material_id = $1`,
                    [Number(id)]
                );

                // Soft-delete the source material
                await client.query(
                    `UPDATE ims_materials SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [Number(id)]
                );

                await client.query('COMMIT');

                // Return target material details
                const resultRes = await client.query(`
                    SELECT m.id, m.category_id, c.name AS category_name, m.name, m.created_at, m.updated_at 
                    FROM ims_materials m
                    JOIN ims_material_categories c ON m.category_id = c.id
                    WHERE m.id = $1
                `, [targetMaterialId]);
                return resultRes.rows[0];
            } else {
                // No duplicate, perform regular update
                await client.query(`
                    UPDATE ims_materials 
                    SET 
                        name = $1,
                        category_id = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3 AND is_deleted = FALSE
                `, [newName, newCategoryId, Number(id)]);

                await client.query('COMMIT');

                // Fetch details with category name
                const resultRes = await client.query(`
                    SELECT m.id, m.category_id, c.name AS category_name, m.name, m.created_at, m.updated_at 
                    FROM ims_materials m
                    JOIN ims_material_categories c ON m.category_id = c.id
                    WHERE m.id = $1
                `, [Number(id)]);
                return resultRes.rows[0];
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error in updating the material:", error);
            throw error;
        } finally {
            client.release();
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
        const { material_id, approved_quantity = 0, rejected_quantity = 0, updated_by, target_category_id } = data;

        if (!material_id || isNaN(Number(material_id))) throw new Error("A valid material_id is required.");

        const totalProcessed = Number(approved_quantity) + Number(rejected_quantity);
        if (totalProcessed === 0) throw new Error("You must provide either an approved or rejected quantity.");
        if (!updated_by) throw new Error("User authorization is missing.");

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Get the source material info
            const sourceMaterialRes = await client.query(
                `SELECT name, category_id FROM ims_materials WHERE id = $1 AND is_deleted = FALSE`,
                [Number(material_id)]
            );
            if (sourceMaterialRes.rows.length === 0) throw new Error("Source material not found.");
            const sourceMaterial = sourceMaterialRes.rows[0];

            let targetMaterialId = Number(material_id);

            // 2. If target_category_id is provided and differs from source category, find or create target material
            if (target_category_id && Number(target_category_id) !== sourceMaterial.category_id) {
                const targetMaterialsRes = await client.query(
                    `SELECT id, name FROM ims_materials WHERE category_id = $1 AND is_deleted = FALSE`,
                    [Number(target_category_id)]
                );

                const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z]/g, '');
                const sourceNorm = normalize(sourceMaterial.name);
                const matchedTarget = targetMaterialsRes.rows.find(m => normalize(m.name) === sourceNorm);

                if (matchedTarget) {
                    targetMaterialId = matchedTarget.id;
                } else {
                    // Create new master material in target category
                    const createMatRes = await client.query(
                        `INSERT INTO ims_materials (category_id, name, created_at, updated_at) 
                         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
                         RETURNING id`,
                        [Number(target_category_id), sourceMaterial.name]
                    );
                    targetMaterialId = createMatRes.rows[0].id;
                }
            }

            // 3. Subtract pending quantity from the source material(s)
            // Get all materials with the same normalized name
            const allMaterialsRes = await client.query(
                `SELECT id FROM ims_materials 
                 WHERE regexp_replace(lower(name), '[^a-z]', '', 'g') = regexp_replace(lower($1), '[^a-z]', '', 'g')
                   AND is_deleted = FALSE`,
                [sourceMaterial.name]
            );
            const materialIds = allMaterialsRes.rows.map(r => Number(r.id));

            const checkQuery = `
                SELECT material_id, quantity FROM ims_inventory 
                WHERE material_id = ANY($1) AND status = 'PENDING_QUALITY' AND is_deleted = FALSE
                FOR UPDATE;
            `;
            const { rows: inventoryRows } = await client.query(checkQuery, [materialIds]);
            if (inventoryRows.length === 0) throw new Error("No pending quality stock found for this material.");

            const currentPending = inventoryRows.reduce((sum, r) => sum + Number(r.quantity), 0);
            if (currentPending < totalProcessed) {
                throw new Error(`Cannot process ${totalProcessed}. Only ${currentPending} available in pending.`);
            }

            let remainingToProcess = totalProcessed;
            // Prioritize requested material_id first
            const sortedRows = [...inventoryRows].sort((a, b) => {
                if (a.material_id === Number(material_id)) return -1;
                if (b.material_id === Number(material_id)) return 1;
                return 0;
            });

            for (const row of sortedRows) {
                if (remainingToProcess <= 0) break;
                const rowQty = Number(row.quantity);
                const toSubtract = Math.min(rowQty, remainingToProcess);

                if (toSubtract > 0) {
                    await client.query(`
                        UPDATE ims_inventory 
                        SET quantity = quantity - $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
                        WHERE material_id = $3 AND status = 'PENDING_QUALITY' AND is_deleted = FALSE
                    `, [toSubtract, updated_by, row.material_id]);

                    // Log transaction for the source material (reducing pending quality)
                    await client.query(`
                        INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, created_by)
                        VALUES ($1, 'RECEIVED', $2, $3)
                    `, [row.material_id, -toSubtract, updated_by]);

                    remainingToProcess -= toSubtract;
                }
            }


            // 4. Add approved stock to target material
            if (approved_quantity > 0) {
                await client.query(`
                    INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by) 
                    VALUES ($1, $2, 'AVAILABLE', $3, $3)
                    ON CONFLICT (material_id, status) 
                    DO UPDATE SET 
                        quantity = ims_inventory.quantity + EXCLUDED.quantity,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = CURRENT_TIMESTAMP
                `, [targetMaterialId, Number(approved_quantity), updated_by]);

                await client.query(`
                    INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, created_by) 
                    VALUES ($1, 'QA_APPROVED', $2, $3)
                `, [targetMaterialId, Number(approved_quantity), updated_by]);
            }

            // 5. Add rejected stock to target material
            if (rejected_quantity > 0) {
                await client.query(`
                    INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by) 
                    VALUES ($1, $2, 'NOT_OK', $3, $3)
                    ON CONFLICT (material_id, status) 
                    DO UPDATE SET 
                        quantity = ims_inventory.quantity + EXCLUDED.quantity,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = CURRENT_TIMESTAMP
                `, [targetMaterialId, Number(rejected_quantity), updated_by]);

                await client.query(`
                    INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, created_by) 
                    VALUES ($1, 'QA_REJECTED', $2, $3)
                `, [targetMaterialId, Number(rejected_quantity), updated_by]);
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
            ORDER BY m.category_id ASC, m.id ASC;
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
                m.id AS material_id, m.name AS material_name, c.name AS category_name, c.id AS category_id,
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
            ORDER BY m.category_id ASC, m.id ASC;
        `;

        try {
            const { rows } = await pool.query(query, [startDate, endDate]);
            return rows;
        } catch (error) {
            console.error("Error fetching filtered inventory:", error);
            throw new Error("Failed to fetch inventory data.");
        }
    }

    async logPastData(data) {
        const { material_id, transaction_type, quantity, transaction_date, created_by } = data;

        if (!material_id || isNaN(Number(material_id))) throw new Error("A valid material_id is required.");
        if (quantity === undefined || isNaN(Number(quantity))) throw new Error("Quantity must be a valid number.");
        if (!transaction_date) throw new Error("A transaction date is required.");
        if (!created_by) throw new Error("User authorization is missing.");

        const validTypes = ['RECEIVED', 'QA_APPROVED', 'QA_REJECTED'];
        if (!validTypes.includes(transaction_type)) {
            throw new Error("Transaction type must be 'RECEIVED', 'QA_APPROVED', or 'QA_REJECTED'.");
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Check material exists
            const checkMaterialQuery = `SELECT id FROM ims_materials WHERE id = $1 AND is_deleted = FALSE`;
            const checkRes = await client.query(checkMaterialQuery, [Number(material_id)]);
            if (checkRes.rowCount === 0) throw new Error("The provided material_id does not exist or has been deleted.");

            // 2. Insert transaction with specific transaction_date
            const insertTxQuery = `
                INSERT INTO ims_inventory_transactions (material_id, transaction_type, quantity, transaction_date, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            const txResult = await client.query(insertTxQuery, [
                Number(material_id),
                transaction_type,
                Number(quantity),
                transaction_date,
                created_by
            ]);

            // 3. Map transaction type to inventory status
            let status = null;
            if (transaction_type === 'RECEIVED') {
                status = 'PENDING_QUALITY';
            } else if (transaction_type === 'QA_APPROVED') {
                status = 'AVAILABLE';
            } else if (transaction_type === 'QA_REJECTED') {
                status = 'NOT_OK';
            }

            // 4. Update the current inventory level
            if (status) {
                const upsertQuery = `
                    INSERT INTO ims_inventory (material_id, quantity, status, created_by, updated_by) 
                    VALUES ($1, $2, $3, $4, $4)
                    ON CONFLICT (material_id, status) 
                    DO UPDATE SET 
                        quantity = GREATEST(0, ims_inventory.quantity + EXCLUDED.quantity),
                        updated_by = EXCLUDED.updated_by,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *;
                `;
                await client.query(upsertQuery, [
                    Number(material_id),
                    Number(quantity),
                    status,
                    created_by
                ]);
            }

            await client.query('COMMIT');
            return txResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error in logPastData:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    async checkCategoryStockLevelsAndNotify() {
        const stockQuery = `
            SELECT 
                c.id AS category_id,
                c.name AS category_name,
                c.max_level,
                COALESCE(SUM(CASE WHEN i.status = 'AVAILABLE' THEN i.quantity ELSE 0 END), 0) AS category_available_stock
            FROM ims_material_categories c
            LEFT JOIN ims_materials m ON m.category_id = c.id AND m.is_deleted = FALSE
            LEFT JOIN ims_inventory i ON i.material_id = m.id AND i.is_deleted = FALSE
            WHERE c.is_deleted = FALSE
              AND TRIM(LOWER(c.name)) <> 'total bundle'
            GROUP BY c.id, c.name, c.max_level
        `;

        try {
            // 1. Fetch categories stock calculation
            const { rows: categories } = await pool.query(stockQuery);

            // 2. Filter categories that are Under Stock or Over Stock
            const alerts = [];
            for (const cat of categories) {
                const max = parseInt(cat.max_level) || 0;
                const val = parseInt(cat.category_available_stock) || 0;

                if (max > 0) {
                    if (val <= max * 0.33) {
                        alerts.push({
                            name: cat.category_name,
                            status: 'Under Stock',
                            available: val,
                            max: max
                        });
                    } else if (val > max) {
                        alerts.push({
                            name: cat.category_name,
                            status: 'Over Stock',
                            available: val,
                            max: max
                        });
                    }
                }
            }

            if (alerts.length === 0) {
                console.log("CRON: No categories are Over or Under stock.");
                return;
            }

            // 3. Fetch all Purchase Executive users
            const { rows: purchaseExecutives } = await pool.query(
                `SELECT id FROM public.users WHERE role = 'Purchase Executive'`
            );

            if (purchaseExecutives.length === 0) {
                console.log("CRON: No users with role 'Purchase Executive' found.");
                return;
            }

            // 4. Create and emit notifications
            for (const pe of purchaseExecutives) {
                for (const alert of alerts) {
                    const message = `Category "${alert.name}" is ${alert.status} at ${alert.available} MT (Max Limit: ${alert.max} MT).`;
                    const type = "stock_status_alert";

                    const notif = await createNotification(pe.id, message, type);
                    emitToUser(pe.id, "new_notification", notif);
                }
            }
            console.log(`CRON: Successfully sent ${alerts.length * purchaseExecutives.length} stock status alerts.`);
        } catch (error) {
            console.error("Error checking stock status and notifying:", error);
        }
    }

    async importPurchaseData(purchase) {

        const {
            poid,
            material_name,
            purchased_qty,
            purity,
            purchased_date,
            json
        } = purchase;

        // Validation
        if (
            !poid ||
            !material_name ||
            purchased_qty === undefined ||
            isNaN(Number(purchased_qty)) ||
            !purity ||
            !purchased_date ||
            !json
        ) {
            throw new Error("Please provide all the required data.");
        }

        const query = `
        INSERT INTO ims_purchase_history
        (
            poid,
            material_name,
            purchased_qty,
            purity,
            purchased_date,
            json_data
        )
        VALUES
        (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
        )
        RETURNING *;
    `;

        try {

            const { rows } = await pool.query(query, [
                poid,
                material_name,
                Number(purchased_qty),
                purity,
                purchased_date,
                json
            ]);

            return rows[0];

        } catch (error) {

            console.error("Error while importing purchase data:", error);

            throw error;
        }
    }

    async getPurchaseHistory() {

        const query = `
        SELECT
            id,
            poid,
            material_name,
            purchased_qty,
            purity,
            purchased_date,
            json_data,
            created_at,
            updated_at
        FROM ims_purchase_history
        WHERE is_deleted = FALSE
        ORDER BY purchased_date DESC, created_at DESC;
    `;

        try {

            const { rows } = await pool.query(query);

            return rows;

        } catch (error) {

            console.error("Error while fetching purchase history:", error);

            throw error;
        }
    }
}

export default new ImsService();