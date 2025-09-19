import mongoose from "mongoose";

const envSchema = new mongoose.Schema({
  ownVendorId: { type: String, required: false },
  excludedSisterVendors: { type: String, required: false },
  delay: { type: Number, required: false },
  source: { type: String, required: false },
});

export default mongoose.model("envSettings", envSchema);
