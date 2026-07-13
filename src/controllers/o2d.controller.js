import o2dService from "../services/o2d.service.js";

class O2dController {
  createSaleOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order = await o2dService.createSaleOrder(req.body, userId);

      return res.status(201).json({
        status: "success",
        message: "Sales order created successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllClientNamesList = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      let clientName = await o2dService.getAllClientNamesList(userId);

      if (!clientName) {
        clientName = [];
      }

      const staticClientNameList = [];

      return res.status(200).json({
        status: "success",
        message: "Client name retrieved successfully",
        data: clientName.concat(staticClientNameList),
      });
    } catch (error) {
      next(error);
    }
  };

  createNewCustomerProfile = async (req, res, next) => {
    try {
      const newCustomerProfile = await o2dService.createNewCustomerProfile(
        req.body,
      );

      return res.status(201).json({
        status: "success",
        message: "New customer profile created successfully",
        data: newCustomerProfile,
      });
    } catch (error) {
      next(error);
    }
  };

  retrieveAllCustomersList = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const customersList = await o2dService.retrieveAllCustomersList(userId);

      return res.status(200).json({
        status: "success",
        message: "All customers retrieved successfully",
        data: customersList,
      });
    } catch (error) {
      next(error);
    }
  };

  retrieveCustomerDetailsById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const customerDetails = await o2dService.retrieveCustomerDetailsById(id);

      if (!customerDetails) {
        return res.status(404).json({
          status: "error",
          message: "Customer record not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Customer details retrieved successfully",
        data: customerDetails,
      });
    } catch (error) {
      next(error);
    }
  };

  updateExistingCustomerDetails = async (req, res, next) => {
    try {
      const { id } = req.params;

      const updatedCustomerDetails =
        await o2dService.updateExistingCustomerDetails(id, req.body);

      if (!updatedCustomerDetails) {
        return res.status(404).json({
          status: "error",
          message: "Customer record not found or could not be updated",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Customer details updated successfully",
        data: updatedCustomerDetails,
      });
    } catch (error) {
      next(error);
    }
  };

  removeCustomerRecordById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const deletedCustomerRecord =
        await o2dService.removeCustomerRecordById(id);

      if (!deletedCustomerRecord) {
        return res.status(404).json({
          status: "error",
          message: "Customer record not found or already deleted",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Customer record deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getAllSaleOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      if (!userId) {
        return res
          .status(401)
          .json({ status: "error", message: "Unauthorized" });
      }

      const orders = await o2dService.getAllSaleOrder(userId);

      return res.status(200).json({
        status: "success",
        message: "Sales orders retrieved successfully",
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  };

  getSaleOrderById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await o2dService.getSaleOrderById(id);

      if (!order) {
        return res.status(404).json({
          status: "error",
          message: "Sales order not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Sales order retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSaleOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.updateSaleOrder(
        id,
        req.body,
        userId,
      );

      if (!updatedOrder) {
        return res.status(404).json({
          status: "error",
          message: "Sales order not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Sales order updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSaleOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const deletedOrder = await o2dService.deleteSaleOrder(id);

      if (!deletedOrder) {
        return res.status(404).json({
          status: "error",
          message: "Sales order not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Sales order deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  checkCreditLimit = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.checkCreditLimit(req.body, userId);

      return res.status(200).json({
        status: "success",
        message: "Credit limit checked successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getCreditLimitReachedData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getCreditLimitReachedData(
        req.body,
        userId,
      );
      return res.status(200).json({
        status: "success",
        message: "Credit limit reached data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  approveCreditLimitExceededSale = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.approveCreditLimitExceededSale(
        req.body,
        userId,
      );
      return res.status(200).json({
        status: "success",
        message: "Credit limit exceeded sale approved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  generateSaleOrderSlip = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.generateSaleOrderSlip(req.body, userId);

      return res.status(200).json({
        status: "success",
        message: "Sales order slip generated successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getSOGenerationRequestData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getSOGenerationRequestData(userId);

      return res.status(200).json({
        status: "success",
        message:
          "Sales order slip generation request data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  completeSOGenerationRequest = async (req, res, next) => {
    try {
      const { id, document_url } = req.body;
      const role = req.user?.role;
      const userId = req.user?.id;

      const order = await o2dService.completeSOGenerationRequest(
        id,
        userId,
        document_url,
      );

      return res.status(200).json({
        status: "success",
        message: "Sales order slip generation request completed successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getCompletedSOGenerationRequestData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order =
        await o2dService.getCompletedSOGenerationRequestData(userId);
      return res.status(200).json({
        status: "success",
        message: "Sales order slip generation request completed successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getAssignedSOByCRM = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order = await o2dService.getAssignedSOByCRM(userId);
      return res.status(200).json({
        status: "success",
        message: "Sales order slip generation request completed successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDispatchInformation = async (req, res, next) => {
    try {
      // 1. Extract both status and type from the request body
      const { id, dispatch_status, dispatch_type, dispatch_at, delay_reason } =
        req.body;
      const userId = req.user?.id || null;

      // 2. Pass the new parameters to the service
      const updatedOrder = await o2dService.updateDispatchInformation(
        id,
        dispatch_type,
        dispatch_status,
        userId,
        dispatch_at,
        delay_reason,
      );

      return res.status(200).json({
        status: "success",
        message: "Dispatch information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  updateInvoiceAndDispatchInfo = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const { order_id, actual_dispatch_date, invoices, invoice_completed_at } =
        req.body;

      if (!order_id) {
        return res.status(400).json({
          status: "error",
          message: "order_id is required",
        });
      }

      const updatedOrder = await o2dService.updateInvoiceAndDispatchInfo(
        order_id,
        { actual_dispatch_date, invoices, invoice_completed_at },
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Dispatch information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  getInvoiceExecutiveCompletedData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order = await o2dService.getInvoiceExecutiveCompletedData(userId);
      return res.status(200).json({
        status: "success",
        message: "Invoice executive completed data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  createComplaintForSaleOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const saleOrderId = req.params.id;

      const complaint = await o2dService.createComplaintForSaleOrder(
        saleOrderId,
        req.body,
        userId,
      );

      return res.status(201).json({
        status: "success",
        message: "Complaint created successfully",
        data: complaint,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllComplaintsForSaleOrder = async (req, res, next) => {
    try {
      const saleOrderId = req.params.id;

      const complaints =
        await o2dService.getAllComplaintsForSaleOrder(saleOrderId);

      return res.status(200).json({
        status: "success",
        message: "Complaints fetched successfully",
        data: complaints,
      });
    } catch (error) {
      next(error);
    }
  };

  getComplaintDetailsForSaleOrder = async (req, res, next) => {
    try {
      const { id, complaintId } = req.params;

      const complaint = await o2dService.getComplaintDetailsForSaleOrder(
        id,
        complaintId,
      );

      return res.status(200).json({
        status: "success",
        message: "Complaint details fetched successfully",
        data: complaint,
      });
    } catch (error) {
      next(error);
    }
  };

  updateComplaintDetailsForSaleOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const { id, complaintId } = req.params;

      const complaint = await o2dService.updateComplaintDetailsForSaleOrder(
        id,
        complaintId,
        req.body,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Complaint updated successfully",
        data: complaint,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteComplaintForSaleOrder = async (req, res, next) => {
    try {
      const { id, complaintId } = req.params;

      await o2dService.deleteComplaintForSaleOrder(id, complaintId);

      return res.status(200).json({
        status: "success",
        message: "Complaint deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  updateCallActionInformation = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.updateCallActionInformation(
        id,
        userId,
        req.body,
      );

      return res.status(200).json({
        status: "success",
        message: "Call Action Information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  getCallComplaintData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const complaint = await o2dService.getCallComplaintData(userId);

      return res.status(200).json({
        status: "success",
        message: "Call Complaint Data retrieved successfully",
        data: complaint,
      });
    } catch (error) {
      next(error);
    }
  };

  updatePlantVisitInformation = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;
      const updatedOrder = await o2dService.updatePlantVisitInformation(
        id,
        userId,
        req.body,
      );
      return res.status(200).json({
        status: "success",
        message: "Plant Visit Information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  updateComplaintClosureInformation = async (req, res, next) => {
    try {
      const { complaint_id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.updateComplaintClosureInformation(
        complaint_id,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Complaint Closure Information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };


  getCnDnIssueData = async (req, res, next) => {
    try{
      const userId = req.user?.id || null;

      const order = await o2dService.getCnDnIssueData(userId);

      return res.status(200).json({
        status: "success",
        message: "CN/DN Issue Data retrieved successfully",
        data: order,
      });
    }catch(error){
      next(error);
    }
  }

  getCnDnWorkHistory = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getCnDnWorkHistory(userId);

      return res.status(200).json({
        status: "success",
        message: "CN/DN Work History retrieved successfully",
        data: order,
      });
    }catch(error){
      next(error);
    }
  }

  assignToVehicleExecutive = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.assignToVehicleExecutive(
        id,
        userId,
      );
      return res.status(200).json({
        status: "success",
        message: "Vehicle Executive assigned successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  getVehicleExecutiveAssignedData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order = await o2dService.getVehicleExecutiveAssignedData(userId);
      return res.status(200).json({
        status: "success",
        message: "Vehicle Executive assigned data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getVehicleExecutiveWorkHistory = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order = await o2dService.getVehicleExecutiveWorkHistory(userId);
      return res.status(200).json({
        status: "success",
        message: "Vehicle Executive work history retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsDeliveredByTransportExecutive = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.markAsDeliveredByTransportExecutive(
        id,
        userId,
        req.body,
      );
      return res.status(200).json({
        status: "success",
        message: "Delivered by transport executive marked successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  assignOrderToInvoiceExecutive = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.assignOrderToInvoiceExecutive(
        id,
        userId,
      );
      return res.status(200).json({
        status: "success",
        message: "Order assigned to invoice executive successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  intimationAndThankYouData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      // Assuming orderId and screenshot_url are sent in the request body
      const { orderId, screenshot_url } = req.body;

      if (!orderId) {
        return res.status(400).json({
          status: "error",
          message: "orderId is required",
        });
      }

      // Generate the current UTC timestamp on the server
      const payload = {
        completed_at: new Date().toISOString(),
        screenshot_url: screenshot_url || "",
      };

      const updatedOrder = await o2dService.intimationAndThankYouData(
        orderId,
        userId,
        payload,
      );

      if (!updatedOrder) {
        return res.status(404).json({
          status: "error",
          message:
            "Order not found, not assigned to you, or already completed.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Intimation and thank you data saved successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  updatePaymentInformation = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.updatePaymentInformation(
        id,
        userId,
        req.body,
      );

      return res.status(200).json({
        status: "success",
        message: "Payment information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDeliveryAndWeightInformation = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.updateDeliveryAndWeightInformation(
        id,
        userId,
        req.body,
      );

      return res.status(200).json({
        status: "success",
        message: "Delivery and weight information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  addRemarksToOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const orderId = req.params.id;

      const result = await o2dService.addRemarksToOrder(
        orderId,
        req.body,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Remark added successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getRemarksForOrder = async (req, res, next) => {
    try {
      const orderId = req.params.id;

      const remarks = await o2dService.getRemarksForOrder(orderId);

      return res.status(200).json({
        status: "success",
        message: "Remarks fetched successfully",
        data: remarks,
      });
    } catch (error) {
      next(error);
    }
  };

  updateRemarksForOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;

      const { id, remarkId } = req.params;

      const result = await o2dService.updateRemarksForOrder(
        id,
        remarkId,
        req.body,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Remark updated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteRemarksForOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;

      const { id, remarkId } = req.params;

      await o2dService.deleteRemarksForOrder(id, remarkId, userId);

      return res.status(200).json({
        status: "success",
        message: "Remark deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getInvoiceGenerationRequestData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const order = await o2dService.getInvoiceGenerationRequestData(userId);
      return res.status(200).json({
        status: "success",
        message: "Invoice generation request data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new O2dController();
