import mongoose from "mongoose";

const manualLogsSchema = new mongoose.Schema(
  {
    time: Date,
    logs: Array,
  },
  { timestamps: true },
);

export default mongoose.model("ManualLog", manualLogsSchema);
