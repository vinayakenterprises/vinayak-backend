import purchaseService from "../services/purchase.service.js";

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
      return res
        .status(200)
        .json({ success: true, message: "PO has been registered successfully!", data: result });
    } catch (err) {
      next(err);
    }
  };
}

export default new PurchaseController();
