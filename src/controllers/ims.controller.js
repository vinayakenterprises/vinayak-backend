import imsService from "../services/ims.service.js";



class ImsController {
    createCategory = async (req, res, next) => {
        try {
            const category = await imsService.createCategory(req.body);

            return res.status(201).json({
                status: "success",
                message: "Material category created successfully",
                data: category,
            });

        } catch (error) {
            next(error);
        }
    }

    getAllCategories = async (req, res, next) => {
        try {
            const categories = await imsService.getAllCategories();

            return res.status(200).json({
                status: "success",
                message: "Categories retrieved successfully",
                data: categories,
            });

        } catch (error) {
            next(error);
        }
    }

    getCategoryById = async (req, res, next) => {
        try {
            const categoryId = req.params.id;

            const category = await imsService.getCategoryById(categoryId);

            return res.status(200).json({
                status: "success",
                message: "Category retrieved successfully",
                data: category,
            });

        } catch (error) {
            next(error);
        }
    };

    updateCategory = async (req, res, next) => {
        try {
            const categoryId = req.params.id;

            const updatedCategory = await imsService.updateCategory(categoryId, req.body);

            return res.status(200).json({
                status: "success",
                message: "Category updated successfully",
                data: updatedCategory,
            });

        } catch (error) {
            next(error);
        }
    };

    removeCategory = async (req, res, next) => {
        try {
            const categoryId = req.params.id;

            const deletedCategory = await imsService.removeCategory(categoryId);

            // Return standard success response
            return res.status(200).json({
                status: "success",
                message: "Category and all associated materials deleted successfully",
                data: deletedCategory,
            });

        } catch (error) {
            next(error);
        }
    };

    createMaterial = async (req, res, next) => {
        try {
            const material = await imsService.createMaterial(req.body);

            return res.status(201).json({
                status: "success",
                message: "Material created successfully",
                data: material,
            });

        } catch (error) {
            next(error);
        }
    };

    getAllMaterials = async (req, res, next) => {
        try {
            const materials = await imsService.getAllMaterials();

            return res.status(200).json({
                status: "success",
                message: "Materials retrieved successfully",
                data: materials,
            });

        } catch (error) {
            next(error);
        }
    };

    getMaterialById = async (req, res, next) => {
        try {
            const materialId = req.params.id;

            const material = await imsService.getMaterialById(materialId);

            return res.status(200).json({
                status: "success",
                message: "Material retrieved successfully",
                data: material,
            });

        } catch (error) {
            next(error);
        }
    };

    updateMaterial = async (req, res, nex) => {
        try {
            const materialId = req.params.id;

            const updatedMaterial = await imsService.updateMaterial(materialId, req.body);

            return res.status(200).json({
                status: "success",
                message: "Material updated successfully",
                data: updatedMaterial,
            });
        } catch (error) {
            next(error)
        }
    }

    removeMaterial = async (req, res, next) => {
        try {
            const materialId = req.params.id;

            const deletedMaterial = await imsService.removeMaterial(materialId);

            // Return standard JSON response
            return res.status(200).json({
                status: "success",
                message: "Material deleted successfully",
                data: deletedMaterial,
            });

        } catch (error) {
            next(error);
        }
    };

    receiveNewShipment = async (req, res, next) => {
        try {
            const payload = {
                ...req.body,
                created_by: req.user?.id
            };

            const newShipment = await imsService.receiveNewShipment(payload);

            return res.status(201).json({
                status: "success",
                message: "Shipment received and moved to Pending Quality.",
                data: newShipment,
            });

        } catch (error) {
            next(error);
        }
    };

    getPendingQualityData = async (req, res, next) => {
        try {
            const pendingData = await imsService.getPendingQualityData();

            return res.status(200).json({
                status: "success",
                message: "Pending quality data retrieved successfully",
                data: pendingData,
            });

        } catch (error) {
            next(error);
        }
    };

    processQualityCheck = async (req, res, next) => {
        try {
            const payload = {
                ...req.body,
                updated_by: req.user?.id
            };

            const result = await imsService.processQualityCheck(payload);

            return res.status(200).json({
                status: "success",
                message: result.message,
            });

        } catch (error) {
            next(error);
        }
    };

    getInventoryMatrixData = async (req, res, next) => {
        try {
            // 1. Fetch the pivoted data from the service
            const matrixData = await imsService.getInventoryMatrixData();

            // 2. Return standard JSON response
            return res.status(200).json({
                status: "success",
                message: "Inventory matrix data retrieved successfully",
                data: matrixData,
            });

        } catch (error) {
            next(error);
        }
    };

    getRejectedMaterialData = async (req, res, next) => {
        try {
            const rejectedData = await imsService.getRejectedMaterialData();

            return res.status(200).json({
                status: "success",
                message: "Rejected material data retrieved successfully",
                data: rejectedData,
            });

        } catch (error) {
            next(error);
        }
    };

    getDailySummaryMetrics = async (req, res, next) => {
        try {
            // 1. Fetch data from the service
            const metrics = await imsService.getDailySummaryMetrics();

            // 2. Return standard JSON response
            return res.status(200).json({
                status: "success",
                message: "Summary metrics retrieved successfully",
                data: metrics,
            });

        } catch (error) {
            next(error);
        }
    };

    updateDailyStockCount = async (req, res, next) => {
        try {
            const payload = {
                ...req.body,
                updated_by: req.user?.id
            };

            const updatedStock = await imsService.updateDailyStockCount(payload);

            return res.status(200).json({
                status: "success",
                message: "Stock count manually adjusted successfully.",
                data: updatedStock,
            });

        } catch (error) {
            next(error);
        }
    };

    getFilteredInventory = async (req, res, next) => {
    try {
      // Extract the query parameters sent by the React frontend
      const { filter, date, startDate, endDate } = req.query;

      // Pass the parameters to the service logic
      const matrixData = await imsService.getFilteredInventory({
        filter,
        date,
        startDate,
        endDate
      });

      return res.status(200).json({
        status: "success",
        message: `Inventory data for ${filter || 'all time'} retrieved successfully`,
        data: matrixData,
      });
      
    } catch (error) {
      next(error);
    }
  };
}

export default new ImsController();