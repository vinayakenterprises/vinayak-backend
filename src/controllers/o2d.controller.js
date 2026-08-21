import o2dService from "../services/o2d.service.js";
import uploadPdfToS3 from "../utils/helpers/uploadSOToS3.js";

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
        data: customersList[0],
        userDetails: customersList[1],
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

  getCrmAndSalesPerson = async (req, res, next) => {
    try {
      const { crm, sales_person } = req.body;

      if (!crm && !sales_person) {
        return res.status(400).json({
          status: "error",
          message: "Please Provide CRM or Sales Person",
        });
      }

      const customerDetails = await o2dService.getCrmAndSalesPerson(
        crm,
        sales_person,
      );

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

  updateCrmAndSalesPerson = async (req, res, next) => {
    try {
      const { id, crm, sales_person } = req.body;

      const updatedCustomerDetails = await o2dService.updateCrmAndSalesPerson(
        id,
        crm,
        sales_person,
      );

      if (!updatedCustomerDetails) {
        return res.status(404).json({
          status: "error",
          message: "Customer record not found or already deleted",
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
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getCnDnIssueData(userId);

      return res.status(200).json({
        status: "success",
        message: "CN/DN Issue Data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getCnDnWorkHistory = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getCnDnWorkHistory(userId);

      return res.status(200).json({
        status: "success",
        message: "CN/DN Work History retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getInterestNoteIssueData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getInterestNoteIssueData(userId);

      return res.status(200).json({
        status: "success",
        message: "Interest Note Issue Data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getInterestNoteIssueWorkHistory = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getInterestNoteIssueWorkHistory(userId);

      return res.status(200).json({
        status: "success",
        message: "Interest Note Issue Work History retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getAdminDashboardCardsData = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const order = await o2dService.getAdminDashboardCardsData(userId);

      return res.status(200).json({
        status: "success",
        message: "Admin Dashboard Cards Data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getActiveSaleOrdersAdminDashboard = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;

      const { start_date, end_date } = req.body;
      const order = await o2dService.getActiveSaleOrdersAdminDashboard(
        userId,
        start_date,
        end_date,
      );
      return res.status(200).json({
        status: "success",
        message:
          "Active Sale Orders Admin Dashboard Data retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  getOverdueReportData = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.getOverdueReportData(id, userId);

      res.status(200).json({
        status: "success",
        message: "Overdue Report Data retrieved successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  updateOverdueSummaryReportInformation = async (req, res, next) => {
    try {
      const { id } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder =
        await o2dService.updateOverdueSummaryReportInformation(
          id,
          userId,
          req.body,
        );

      res.status(200).json({
        status: "success",
        message: "Overdue Summary Report Information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  testApiForTallyIntegration = async (req, res, next) => {
    try {
      console.log("req.body", req.body);
      return res.status(200).json({
        status: "success",
        message: "Tally integration test API called successfully",
        data: req.body,
      });
    } catch (error) {
      next(error);
    }
  };

  receiveSoOrdersFromTally = async (req, res, next) => {
    try {
      console.log("req.body:", req.body);

      let pdfUrl = null;

      // 1. Upload PDF to S3 if attached
      if (req.files?.["pdf-file"]?.[0]) {
        const pdfFile = req.files["pdf-file"][0];
        const year = new Date().getFullYear();
        const s3Path = `sales-orders/${year}/tally_batch_${Date.now()}`;

        pdfUrl = await uploadPdfToS3(pdfFile, s3Path);
        console.log("PDF uploaded to S3: ", pdfUrl);
      }

      // 2. Flexibly parse the JSON payload
      let salesOrdersData = req.body;

      if (typeof req.body.so_orders_data === "string") {
        salesOrdersData = JSON.parse(req.body.so_orders_data);
      } else if (typeof req.body.salesOrders === "string") {
        salesOrdersData = { salesOrders: JSON.parse(req.body.salesOrders) };
      }

      // 3. Validation Guard
      if (!salesOrdersData || !Array.isArray(salesOrdersData.salesOrders)) {
        return res.status(400).json({
          status: "fail",
          message:
            "Invalid payload: 'salesOrders' array is missing or invalid.",
        });
      }

      // 4. Pass parsed data and S3 PDF URL to the service
      const updatedOrder = await o2dService.receiveSoOrdersFromTally(
        salesOrdersData,
        pdfUrl,
      );

      return res.status(200).json({
        status: "success",
        message: "SO orders and PDF received from Tally successfully",
        // data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  receiveInvoiceDetailsFromTally = async (req, res, next) => {
    try {
      // console.log("req.body:", req.body);

      const {
        actual_dispatch_date,
        invoice_number,
        quantity,
        total_invoice_amount,
      } = req.body;

      if (
        !actual_dispatch_date ||
        !invoice_number ||
        !quantity ||
        !total_invoice_amount
      ) {
        return res.status(400).json({
          status: "fail",
          message:
            "Invalid payload: 'actual_dispatch_date', 'invoice_number', 'quantity', or 'total_invoice_amount' is missing or invalid.",
        });
      }

      // 4. Pass parsed data and S3 PDF URL to the service
      const updatedOrder = await o2dService.receiveInvoiceDetailsFromTally(
        actual_dispatch_date,
        invoice_number,
        quantity,
        total_invoice_amount,
      );

      return res.status(200).json({
        status: "success",
        message: "Invoice details received from Tally successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  updateInvoicePdfUrl = async (req, res, next) => {
    try {
      const { order_id, invoice_number, invoice_url } = req.body;
      const userId = req.user?.id || null;

      // Validate request body
      if (!order_id || !invoice_number || !invoice_url) {
        return res.status(400).json({
          status: "error",
          message:
            "order_id, invoice_number, and invoice_url are required fields.",
        });
      }

      const updatedOrder = await o2dService.updateInvoicePdfUrl(
        order_id,
        invoice_number,
        invoice_url,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Invoice PDF URL updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  getCreditDebitNoteFromTally = async (req, res, next) => {
    try {
      const {
        document_type,
        credit_debit_note_number,
        credit_debit_note_amount,
        credit_debit_note_quantity,
      } = req.body;

      if (
        !document_type ||
        !credit_debit_note_number ||
        !credit_debit_note_amount ||
        !credit_debit_note_quantity
      ) {
        return res.status(400).json({
          status: "fail",
          message:
            "Invalid payload: 'document_type', 'credit_debit_note_number', 'credit_debit_note_amount', or 'credit_debit_note_quantity' is missing or invalid.",
        });
      }


      let pdfUrl = null;

      // 1. Upload PDF to S3 if attached
      if (req.files?.["pdf-file"]?.[0]) {
        const pdfFile = req.files["pdf-file"][0];
        const year = new Date().getFullYear();
        const s3Path = `credit-notes/${year}/tally_batch_${Date.now()}`;

        pdfUrl = await uploadPdfToS3(pdfFile, s3Path);
        console.log("PDF uploaded to S3: ", pdfUrl);
      }

      if (!pdfUrl) {
        return res.status(400).json({
          status: "fail",
          message: "PDF file is required.",
        });
      }

      const updatedOrder = await o2dService.getCreditDebitNoteFromTally(
        document_type,
        credit_debit_note_number,
        credit_debit_note_amount,
        credit_debit_note_quantity,
        pdfUrl,
      );

      return res.status(200).json({
        status: "success",
        message: "Credit Note details retrieved successfully",
        // data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

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

  getSpecificSaleOrderInformation = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const { id } = req.body;
      const order = await o2dService.getSpecificSaleOrderInformation(
        userId,
        id,
      );
      return res.status(200).json({
        status: "success",
        message: "Sale order information retrieved successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  splitOrderIntoMultipleOrders = async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const { order_id } = req.body;

      if (!order_id) {
        return res.status(400).json({
          status: "error",
          message: "order_id is required",
        });
      }

      const order = await o2dService.splitOrderIntoMultipleOrders(
        order_id,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "Sale order information retrieved successfully",
        data: order,
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

  updatePoRelated = async (req, res, next) => {
    try {
      const { id, ...po_data } = req.body;
      const userId = req.user?.id || null;

      const updatedOrder = await o2dService.updatePoRelated(
        id,
        po_data,
        userId,
      );

      return res.status(200).json({
        status: "success",
        message: "PO information updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new O2dController();
