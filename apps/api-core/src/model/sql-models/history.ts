import { HistoricalPrice } from "../history";

export class HistoryModel {
  RefTime: Date;
  MpId: string | number;
  ChannelName: string;
  ExistingPrice: any;
  MinQty: number;
  Position: number | null;
  LowestVendor: string | null;
  LowestPrice: number | null;
  SuggestedPrice: number | null;
  RepriceComment: string | null;
  MaxVendor: string | null;
  MaxVendorPrice: number | null;
  OtherVendorList: string;
  LinkedApiResponse: number;
  ContextCronName: string;
  TriggeredByVendor: any;
  RepriceResult: any;

  constructor(
    history: HistoricalPrice,
    mpid: string | number,
    refTime: Date,
    apiResponseLinkedId: any,
  ) {
    this.RefTime = refTime;
    this.MpId = typeof mpid === "string" ? parseInt(mpid) : mpid;
    this.ChannelName = history.vendorName;
    this.ExistingPrice = history.existingPrice;
    this.MinQty =
      typeof history.minQty === "string"
        ? parseInt(history.minQty)
        : history.minQty;
    this.Position =
      typeof history.rank === "string" ? parseInt(history.rank) : history.rank;
    this.LowestVendor = history.lowestVendor;
    this.LowestPrice =
      history.lowestPrice === "N/A"
        ? null
        : typeof history.lowestPrice === "string"
          ? parseFloat(history.lowestPrice)
          : history.lowestPrice;
    this.SuggestedPrice =
      history.suggestedPrice === "N/A"
        ? null
        : typeof history.suggestedPrice === "string"
          ? parseFloat(history.suggestedPrice)
          : history.suggestedPrice;
    this.RepriceComment = history.repriceComment;
    this.MaxVendor = history.maxVendor;
    this.MaxVendorPrice =
      history.maxVendorPrice === "N/A"
        ? null
        : typeof history.maxVendorPrice === "string"
          ? parseFloat(history.maxVendorPrice)
          : history.maxVendorPrice;
    this.OtherVendorList = history.otherVendorList;
    this.LinkedApiResponse = apiResponseLinkedId;
    this.ContextCronName = history.contextCronName;
    this.TriggeredByVendor = history.triggeredByVendor;
    this.RepriceResult = history.repriceResult;
  }
}
