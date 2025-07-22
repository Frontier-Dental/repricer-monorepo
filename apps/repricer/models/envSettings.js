const mongoose = require("mongoose");

const envSchema = new mongoose.Schema({
  ownVendorId: { type: String, required: false },
  excludedSisterVendors: { type: String, required: false },
  delay: { type: Number, required: false },
  source: { type: String, required: false },
});

const EnvSettings = mongoose.model("envSettings", envSchema);

module.exports = EnvSettings;
