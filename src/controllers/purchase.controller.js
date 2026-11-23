import purchaseService from "../services/purchase.service.js";
import { HTTP_STATUS } from "../utils/constants.js";
import uploadFileToS3 from "../utils/helpers/uploadSOToS3.js";

class PurchaseController {
  // GET: Fetch vendors
  getVendorsData = async (req, res, next) => {
    try {
      const vendorsData = await purchaseService.getVendorsData();
      return res.status(200).json({ success: true, data: vendorsData });
    } catch (err) {
      next(err);
    }
  };

  // POST: Create purchase entry
  createPurchase = async (req, res, next) => {
    try {
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
      } = req.body;

      // Basic validation
      if (!vendor_id) {
        return res.status(400).json({ success: false, message: "Vendor is required." });
      }
      if (!material || !material.trim()) {
        return res.status(400).json({ success: false, message: "Material is required." });
      }
      if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
        return res.status(400).json({ success: false, message: "Valid quantity is required." });
      }
      if (!rate || isNaN(rate) || Number(rate) <= 0) {
        return res.status(400).json({ success: false, message: "Valid rate is required." });
      }

      const createdPurchase = await purchaseService.createPurchase({
        purchase_type: purchase_type || null,
        vendor_id: parseInt(vendor_id, 10),
        material: material.trim(),
        purity: purity ? String(purity).trim() : null,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate),
        material_receive_date: material_receive_date || null,
        payment_terms:
          payment_terms !== undefined && payment_terms !== "" ? parseInt(payment_terms, 10) : null,
        purchased_by: purchased_by || req.user?.username || null,
        remarks: remarks ? remarks.trim() : null,
      });

      return res.status(201).json({
        success: true,
        message: "Purchase record created successfully.",
        data: createdPurchase,
      });
    } catch (err) {
      next(err);
    }
  };

  // GET: Fetch all purchases
  getPurchases = async (req, res, next) => {
    try {
      const purchases = await purchaseService.getPurchases();
      return res.status(200).json({ success: true, data: purchases });
    } catch (err) {
      next(err);
    }
  };

  getPOCreationRequests = async (req, res, next) => {
    try {
      const poCreationRequests = await purchaseService.getPOCreationRequests();
      return res.status(200).json({ success: true, data: poCreationRequests });
    } catch (err) {
      next(err);
    }
  };

  completePOCreationFromTally = async (req, res, next) => {
    try {
      const result = await purchaseService.completePOCreationFromTally(req.body);
      return res.status(HTTP_STATUS.OK).json(result);
    } catch (err) {
      next(err);
    }
  };

  getCompletePOCreationFromTallyData = async (req, res, next) => {
    try {
      const page = parseInt(req.body.page || req.query.page, 10) || 1;
      const pageSize = parseInt(req.body.pageSize || req.query.pageSize, 10) || 10;
      const search = (req.body.search || req.query.search || "").trim();

      const { rows, totalItems } = await purchaseService.getCompletePOCreationFromTallyData({
        page,
        pageSize,
        search,
      });

      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: rows,
        pagination: {
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize) || 1,
          currentPage: page,
          pageSize,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getDEOAssignedWorkData = async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.body.page || req.query.page, 10) || 1);

      const pageSize = Math.max(
        1,
        Math.min(100, parseInt(req.body.pageSize || req.query.pageSize, 10) || 10)
      );

      const search = (req.body.search || req.query.search || "").trim();

      const { rows, totalItems } = await purchaseService.getDEOAssignedWorkData({
        page,
        pageSize,
        search,
      });

      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: rows,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
          hasNextPage: page * pageSize < totalItems,
          hasPreviousPage: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getDEOWorkHistoryData = async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.body.page || req.query.page, 10) || 1);

      const pageSize = Math.max(
        1,
        Math.min(100, parseInt(req.body.pageSize || req.query.pageSize, 10) || 10)
      );

      const search = (req.body.search || req.query.search || "").trim();

      const { rows, totalItems } = await purchaseService.getDEOWorkHistoryData({
        page,
        pageSize,
        search,
      });

      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: rows,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
          hasNextPage: page * pageSize < totalItems,
          hasPreviousPage: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getDEOQualityConfirmationData = async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.body.page || req.query.page, 10) || 1);

      const pageSize = Math.max(
        1,
        Math.min(100, parseInt(req.body.pageSize || req.query.pageSize, 10) || 10)
      );

      const search = (req.body.search || req.query.search || "").trim();

      const { rows, totalItems } = await purchaseService.getDEOQualityConfirmationData({
        page,
        pageSize,
        search,
      });

      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: rows,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
          hasNextPage: page * pageSize < totalItems,
          hasPreviousPage: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getDEOPendingQualityConfirmationData = async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.body.page || req.query.page, 10) || 1);

      const pageSize = Math.max(
        1,
        Math.min(100, parseInt(req.body.pageSize || req.query.pageSize, 10) || 10)
      );

      const search = (req.body.search || req.query.search || "").trim();

      const { rows, totalItems } = await purchaseService.getDEOPendingQualityConfirmationData({
        page,
        pageSize,
        search,
      });

      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: rows,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
          hasNextPage: page * pageSize < totalItems,
          hasPreviousPage: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Add a new material receiving entry to public.material_received_information
   */
  addMaterialReceiveEntry = async (req, res, next) => {
    try {
      const purchaseId = parseInt(req.body.purchase_id || req.body.id, 10);
      if (!purchaseId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: "error",
          message: "purchase_id is required",
        });
      }
      const {
        material_receive_date_planned,
        material_receive_date_actual,
        material_received_qty,
        rate,
        balance,
        status,
      } = req.body;
      const files = req.files || {};
      // 1. Upload files to S3 using your uploadFileToS3 helper
      let kanta_parchi_url = null;
      let loaded_vehicle_image_url = null;
      let driver_photo_url = null;
      const companyName = process.env.COMPANY_NAME || "default-company";
      if (files.kanta_parchi?.[0]) {
        kanta_parchi_url = await uploadFileToS3(
          files.kanta_parchi[0],
          `${companyName}/purchase-orders/${purchaseId}/deo/kanta-parchi-document`
        );
      }
      if (files.loaded_vehicle_image?.[0]) {
        loaded_vehicle_image_url = await uploadFileToS3(
          files.loaded_vehicle_image[0],
          `${companyName}/purchase-orders/${purchaseId}/deo/loaded-vehicle-image`
        );
      }
      if (files.driver_photo?.[0]) {
        driver_photo_url = await uploadFileToS3(
          files.driver_photo[0],
          `${companyName}/purchase-orders/${purchaseId}/deo/driver-photo`
        );
      }
      // 2. Pass the resolved S3 URLs to the service
      const updatedPurchase = await purchaseService.addMaterialReceiveEntry({
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
        user: req.user,
      });
      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        message: "Material receiving entry added successfully",
        data: updatedPurchase,
      });
    } catch (err) {
      next(err);
    }
  };
  /**
   * Submit Quality Inspection for a material receiving entry
   */
  submitQualityInspection = async (req, res, next) => {
    try {
      const receivingId = parseInt(req.body.receiving_id || req.body.id, 10);
      const purchaseId = parseInt(req.body.purchase_id, 10);

      if (!receivingId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: "error",
          message: "receiving_id is required",
        });
      }

      const {
        status,
        purity_received,
        order_cancel,
        replacement_raised,
        replacement_type,
        replaced_quantity_mt,
      } = req.body;

      if (!status || !["Okay", "Not Okay"].includes(status)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: "error",
          message: "Valid status ('Okay' or 'Not Okay') is required",
        });
      }

      let quality_report_pdf = null;
      if (req.file) {
        const companyName = process.env.COMPANY_NAME || "Vinayak Enterprises";
        quality_report_pdf = await uploadFileToS3(
          req.file,
          `${companyName}/purchase-orders/${purchaseId || receivingId}/quality-reports`
        );
      }

      let not_okay_details = null;
      if (status === "Not Okay") {
        const isReplacementRaised =
          replacement_raised === true ||
          replacement_raised === "true" ||
          replacement_raised === 1 ||
          replacement_raised === "1";

        not_okay_details = {
          order_cancel:
            order_cancel === true ||
            order_cancel === "true" ||
            order_cancel === 1 ||
            order_cancel === "1",
          replacement_raised: isReplacementRaised,
          replacement_raised_at: isReplacementRaised ? new Date().toISOString() : null,
          replacement_type: isReplacementRaised ? (replacement_type || "Partial") : null,
          replaced_quantity_mt:
            isReplacementRaised && replaced_quantity_mt !== undefined && replaced_quantity_mt !== ""
              ? parseFloat(replaced_quantity_mt)
              : null,
        };
      }

      const updatedRecord = await purchaseService.submitQualityInspection({
        receivingId,
        purchaseId,
        status,
        purity_received,
        quality_report_pdf,
        not_okay_details,
        user: req.user,
      });

      return res.status(HTTP_STATUS.OK).json({
        status: "success",
        message: "Quality inspection submitted successfully",
        data: updatedRecord,
      });
    } catch (err) {
      next(err);
    }
  };
}

export default new PurchaseController();
