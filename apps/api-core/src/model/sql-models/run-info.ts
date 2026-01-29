import moment from "moment";
import { applicationConfig } from "../../utility/config";

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

  constructor(_cronName: any, _cronId: any, _runId: any, _keyGenId: any, _runType: any, _productCount: any, _eligibleCount: any, _successCount: any, _failureCount: any) {
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
  GetSuccessCountQuery() {
    return `UPDATE ${applicationConfig.SQL_RUNINFO} SET ScrapedSuccessCount=? WHERE Id=?`;
  }
  GetFailureCountQuery() {
    return `UPDATE ${applicationConfig.SQL_RUNINFO} SET ScrapedFailureCount=? WHERE Id=?`;
  }
  GetRunEndTimeQuery() {
    return `UPDATE ${applicationConfig.SQL_RUNINFO} SET RunEndTime=? WHERE Id=?`;
  }
  GetCompletedProductCountQuery() {
    return `UPDATE ${applicationConfig.SQL_RUNINFO} SET CompletedProductCount=? WHERE Id=?`;
  }
}
