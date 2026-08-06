import hrService from "../services/hr.service.js";

class HrController {
  createHiringRecord = async (req, res, next) => {
    try {
      const {
        position_name,
        closing_date,
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        selected_month,
        final_closed_date,
      } = req.body;

      // Determine created_at if selected_month is specified and not 'All'
      let created_at = null;
      if (selected_month && selected_month !== "All") {
        const currentMonthStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
        })
          .format(new Date())
          .substring(0, 7); // YYYY-MM
        if (selected_month !== currentMonthStr) {
          created_at = `${selected_month}-01 12:00:00`;
        }
      }

      const payload = {
        position_name: position_name?.trim(),
        closing_date,
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        selected_month,
        final_closed_date,
        created_at,
      };
      const hiringRecord = await hrService.createHiringRecord(payload);

      return res.status(201).json({
        status: "success",
        message: "Hiring record created successfully",
        data: hiringRecord,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllHiringRecords = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const hiringRecords = await hrService.getAllHiringRecords({
        startDate,
        endDate,
      });

      return res.status(200).json({
        status: "success",
        message: "Hiring records retrieved successfully",
        data: hiringRecords,
      });
    } catch (error) {
      next(error);
    }
  };

  getHiringRecordById = async (req, res, next) => {
    try {
      const hiringId = req.params.id;

      const hiringRecord = await hrService.getHiringRecordById(hiringId);

      return res.status(200).json({
        status: "success",
        message: "Hiring record retrieved successfully",
        data: hiringRecord,
      });
    } catch (error) {
      next(error);
    }
  };

  getHiringSummary = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await hrService.getHiringSummary({ startDate, endDate });

      return res.status(200).json({
        status: "success",
        message: "Hiring summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };

  updateHiringRecord = async (req, res, next) => {
    try {
      const id = req.params.id || req.body.id;
      const {
        position_name,
        closing_date,
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        selected_month,
        final_closed_date,
      } = req.body;
      const payload = {
        id,
        position_name: position_name?.trim(),
        closing_date,
        interviewees_appeared,
        offers_given,
        onboarded_candidates,
        hiring_status,
        selected_month,
        final_closed_date,
      };
      const hiringRecord = await hrService.updateHiringRecord(payload);

      return res.status(200).json({
        status: "success",
        message: "Hiring record updated successfully",
        data: hiringRecord,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteHiringRecord = async (req, res, next) => {
    try {
      const hiringId = req.params.id;
      const hiringRecord = await hrService.deleteHiringRecord(hiringId);

      return res.status(200).json({
        status: "success",
        message: "Hiring record deleted successfully",
        data: hiringRecord,
      });
    } catch (error) {
      next(error);
    }
  };

  // Hiring Tasks

  createHiringTask = async (req, res, next) => {
    try {
      const { task_name, start_date, end_date, completed, remarks } = req.body;
      const payload = {
        task_name: task_name?.trim(),
        start_date,
        end_date,
        completed,
        remarks,
      };
      const hiringTask = await hrService.createHiringTask(payload);

      return res.status(201).json({
        status: "success",
        message: "Hiring task created successfully",
        data: hiringTask,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllHiringTasks = async (req, res, next) => {
    try {
      const hiringTasks = await hrService.getAllHiringTasks();

      return res.status(200).json({
        status: "success",
        message: "Hiring tasks retrieved successfully",
        data: hiringTasks,
      });
    } catch (error) {
      next(error);
    }
  };

  getTasksByRange = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const tasks = await hrService.getTasksByRange(startDate, endDate);

      return res.status(200).json({
        status: "success",
        message: "Hiring tasks retrieved successfully",
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  };

  getTaskById = async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const task = await hrService.getTaskById(taskId);

      return res.status(200).json({
        status: "success",
        message: "Hiring task retrieved successfully",
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  updateTask = async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const { task_name, start_date, end_date, completed, remarks } = req.body;
      const payload = {
        task_name: task_name?.trim(),
        start_date,
        end_date,
        completed,
        remarks,
      };
      const task = await hrService.updateTask(taskId, payload);

      return res.status(200).json({
        status: "success",
        message: "Hiring task updated successfully",
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  getTaskSummary = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await hrService.getTaskSummary(startDate, endDate);

      return res.status(200).json({
        status: "success",
        message: "Task summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };

  updateTaskStatus = async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const { completed } = req.body;
      const task = await hrService.updateTaskStatus(taskId, completed);

      return res.status(200).json({
        status: "success",
        message: "Task status updated successfully",
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTask = async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const task = await hrService.deleteTask(taskId);

      return res.status(200).json({
        status: "success",
        message: "Hiring task deleted successfully",
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  createVisitEntry = async (req, res, next) => {
    try {
      const { planned } = req.body;

      if (!planned) {
        return res.status(400).json({
          status: "error",
          message: "planned is required",
        });
      }

      const plannedDate = new Date(planned);

      if (isNaN(plannedDate.getTime())) {
        return res.status(400).json({
          status: "error",
          message: "planned must be a valid date",
        });
      }

      const visitEntry = await hrService.createVisitEntry(planned);
      return res.status(201).json({
        status: "success",
        message: "Visit entry created successfully",
        data: visitEntry,
      });
    } catch (error) {
      next(error);
    }
  };


  getHRVisitTrackerEntries = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const visitEntries = await hrService.getHRVisitTrackerEntries(startDate, endDate);

      return res.status(200).json({
        status: "success",
        message: "Visit entries retrieved successfully",
        data: visitEntries,
      });
    } catch (error) {
      next(error);
    }
  };


  updateActualDate = async (req, res, next) => {
    try {
      const { id, actual } = req.body;

      if (!actual) {
        return res.status(400).json({
          status: "error",
          message: "actual date is required",
        });
      }

      const actualDate = new Date(actual);

      if (isNaN(actualDate.getTime())) {
        return res.status(400).json({
          status: "error",
          message: "actual must be a valid date",
        });
      }

      const visitEntry = await hrService.updateActualDate(id, actual);
      return res.status(200).json({
        status: "success",
        message: "Visit entry updated successfully",
        data: visitEntry,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new HrController();
