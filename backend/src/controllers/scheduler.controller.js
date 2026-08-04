const ReportSchedule = require("../models/reportSchedule.model");

exports.createSchedule = async (req, res, next) => {
  try {
    const { reportType, frequency, recipients, config } = req.body;

    const schedule = new ReportSchedule({
      reportType,
      frequency,
      recipients,
      config,
      tenantId: req.tenantId,
    });

    await schedule.save();
    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
};

exports.getSchedules = async (req, res, next) => {
  try {
    const schedules = await ReportSchedule.find({ tenantId: req.tenantId }).sort("-createdAt");
    res.status(200).json(schedules);
  } catch (error) {
    next(error);
  }
};

exports.deleteSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await ReportSchedule.findOneAndDelete({ _id: id, tenantId: req.tenantId });
    
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    
    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    next(error);
  }
};
