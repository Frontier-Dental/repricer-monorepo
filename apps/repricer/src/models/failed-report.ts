export default class FailedReport {
  mpId: string;
  vendor: string;
  error: string;
  cronRunId: string;
  cronTime: Date;

  constructor(
    _mpId: string,
    _vendor: string,
    _error: string,
    _cronRunId: string,
    _cronTime: Date,
  ) {
    this.mpId = _mpId;
    this.vendor = _vendor;
    this.cronRunId = _cronRunId;
    this.cronTime = _cronTime;
    this.error = _error;
  }
}
