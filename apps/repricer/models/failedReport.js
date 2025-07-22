class FailedReport {
  constructor(_mpId, _vendor, _error, _cronRunId, _cronTime) {
    this.mpId = _mpId;
    this.vendor = _vendor;
    this.cronRunId = _cronRunId;
    this.cronTime = _cronTime;
    this.error = _error;
  }
}
module.exports = FailedReport;
