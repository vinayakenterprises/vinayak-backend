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
      const clientName = await o2dService.getAllClientNamesList();

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
      const newCustomerProfile =
        await o2dService.createNewCustomerProfile(req.body);

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
      const customersList =
        await o2dService.retrieveAllCustomersList();

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
      const customerDetails =
        await o2dService.retrieveCustomerDetailsById(id);

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
        await o2dService.updateExistingCustomerDetails(
          id,
          req.body,
        );

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
      const orders = await o2dService.getAllSaleOrder();

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

}

export default new O2dController();
