import mongoose from "mongoose";

const exportsSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  // object: { type: Array, required: true },
  status: { type: String },
  fromDate: { type: Date },
  toDate: { type: Date },
  exportStartedOn: { type: Date },
  exportFinishedOn: { type: Date },
  dates: { type: Number },
  rowCount: { type: Number },
  errorRowCount: { type: Number },
  lastIndex: { type: Number, default: -1 },
  progress: { type: String },
});

export default mongoose.model("exports", exportsSchema);
