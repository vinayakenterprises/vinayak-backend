export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};


export const ORDER_STAGES = {
    credit_limit_approval_stage: "Credit Limit Approval Stage",
    so_generation_stage: "So Generation Stage",
    order_completed_stage: "Order Completed",
    so_generation_completed_stage: "So Generation Completed",
    vehicle_arrangement_stage: "Vehicle Arrangement Stage",
}