import moment from "moment";

export class RunInfo {
  CronName: any;
  CronId: any;
  RunStartTime: any;
  RunEndTime: any;
  RunId: any;
  KeyGenId: any;
  RunType: any;
  ProductCount: any;
  EligibleCount: any;
  ScrapedSuccessCount: any;
  ScrapedFailureCount: any;

  constructor(
    _cronName: any,
    _cronId: any,
    _runId: any,
    _keyGenId: any,
    _runType: any,
    _productCount: any,
    _eligibleCount: any,
    _successCount: any,
    _failureCount: any,
  ) {
    this.CronName = _cronName;
    this.CronId = _cronId;
    this.RunStartTime = new Date();
    this.RunEndTime = new Date();
    this.RunId = _runId;
    this.KeyGenId = _keyGenId;
    this.RunType = _runType;
    this.ProductCount = _productCount;
    this.EligibleCount = _eligibleCount;
    this.ScrapedSuccessCount = _successCount;
    this.ScrapedFailureCount = _failureCount;
  }
  UpdateSuccessCount() {
    this.ScrapedSuccessCount = this.ScrapedSuccessCount + 1;
  }
  UpdateFailureCount(value: any) {
    this.ScrapedFailureCount = value;
  }
  UpdateEndTime() {
    this.RunEndTime = new Date();
  }
  GetSuccessCountQuery(runInfoId: any) {
    return `UPDATE ${process.env.SQL_RUNINFO} SET ScrapedSuccessCount=${this.ScrapedSuccessCount} WHERE Id=${runInfoId}`;
  }
  GetFailureCountQuery(runInfoId: any) {
    return `UPDATE ${process.env.SQL_RUNINFO} SET ScrapedFailureCount=${this.ScrapedFailureCount} WHERE Id=${runInfoId}`;
  }
  GetRunEndTimeQuery(runInfoId: any) {
    return `UPDATE ${process.env.SQL_RUNINFO} SET RunEndTime='${moment(this.RunEndTime).format("DD-MM-YYYY HH:mm:ss")}' WHERE Id=${runInfoId}`;
  }
}
