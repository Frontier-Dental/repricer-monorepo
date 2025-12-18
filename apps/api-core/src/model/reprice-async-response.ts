import { Net32Product } from "../types/net32";
import { RepriceModel } from "./reprice-model";

export class RepriceAsyncResponse {
  scrapedOn: Date;
  mpId: number | string;
  repriceData: RepriceModel;
  sourceResult: Net32Product[];

  constructor(_repriceModel: RepriceModel, _apiResponse: Net32Product[]) {
    this.scrapedOn = _repriceModel.repriceDetails ? _repriceModel.repriceDetails.updatedOn : new Date();
    this.mpId = _repriceModel.net32id;
    this.repriceData = _repriceModel;
    this.sourceResult = _apiResponse;
  }
}
