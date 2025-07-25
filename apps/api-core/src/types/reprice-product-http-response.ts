import { RepriceAsyncResponse } from "../model/reprice-async-response";

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
