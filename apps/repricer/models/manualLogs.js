const mongoose = require("mongoose");

const manualLogsSchema = new mongoose.Schema(
  {
    time: Date,
    logs: Array,
  },
  { timestamps: true },
);

const manualLogsModel = mongoose.model("ManualLog", manualLogsSchema);
module.exports = manualLogsModel;
