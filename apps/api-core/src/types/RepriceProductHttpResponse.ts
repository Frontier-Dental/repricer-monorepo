import { RepriceAsyncResponse } from "../model/RepriceAsyncResponse";

export interface RepriceProductHttpResponse {
  cronResponse: RepriceAsyncResponse;
  priceUpdateResponse: {
    status: string;
    type: string;
    url: string;
    message?: string;
    [key: string]: any;
  } | null;
  historyIdentifier: any;
}
