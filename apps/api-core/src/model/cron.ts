import _ from "lodash";
import { ScheduleConstants } from "./schedule-constant";

interface Product {
  scrapeOn: boolean;
  [key: string]: any;
}

interface JobModel {
  isAvailable: boolean;
  eligibleProducts: Product[] | null;
}

class JobModelClass implements JobModel {
  isAvailable: boolean;
  eligibleProducts: Product[] | null;

  constructor(_isAvailable: boolean, _eligibleProducts: Product[] | null) {
    this.isAvailable = _isAvailable;
    this.eligibleProducts = _eligibleProducts;
  }
}

function isScrappedProductFound(productList: Product[]): boolean {
  for (const prod of productList) {
    if (prod.scrapeOn == true) {
      return true;
    }
  }
  return false;
}

function GetJobModel(groupedProducts: any, modelType: string): JobModelClass {
  let returnProducts: Product[] | null = null;
  returnProducts = modelType == "GENERIC" ? groupedProducts : _.get(groupedProducts, modelType);
  if (returnProducts && returnProducts.length > 0 && isScrappedProductFound(returnProducts)) {
    return new JobModelClass(true, returnProducts);
  }
  return new JobModelClass(false, null);
}

class CronModel {
  discard: ScheduleConstants;
  E30MINModel: JobModelClass;
  EHModel: JobModelClass;
  E2HModel: JobModelClass;
  E6HModel: JobModelClass;
  E12HModel: JobModelClass;
  E1DModel: JobModelClass;
  E7DModel: JobModelClass;
  GenericModel: JobModelClass;
  isAnyCronNeeded: boolean;

  constructor(groupedProducts: any) {
    this.discard = new ScheduleConstants();
    this.E30MINModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.E30MIN);
    this.EHModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.EH);
    this.E2HModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.E2H);
    this.E6HModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.E6H);
    this.E12HModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.E12H);
    this.E1DModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.E1D);
    this.E7DModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.E7D);
    this.GenericModel = GetJobModel(groupedProducts, this.discard.jobScheduleConstants.GENERIC);
    this.isAnyCronNeeded = this.E30MINModel.isAvailable || this.EHModel.isAvailable || this.E2HModel.isAvailable || this.E6HModel.isAvailable || this.E12HModel.isAvailable || this.E1DModel.isAvailable || this.E7DModel.isAvailable || this.GenericModel.isAvailable;
  }
}

export default CronModel;
