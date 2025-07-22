import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { StatusCodes } from "http-status-codes";
import { Vendor, VendorId } from "../../model/reprice_result";
import { Net32Product } from "../../types/net32";
import * as sqlHelper from "../../utility/mySqlHelper";
import { ProductDetailsListItem } from "../../utility/mySqlMapper";
import * as axiosHelper from "../../utility/axiosHelper";
import { repriceProductV2 } from "../../utility/reprice_algo/v2/v2";
import { AxiosResponse } from "axios";
import { repriceProduct } from "../../utility/reprice_algo/algo_v1";
import { FrontierProduct } from "../../types/frontier";
import createError from "http-errors";
import {
  VendorIdLookup,
  VendorNameLookup,
} from "../../utility/reprice_algo/v2/types";
import { RepriceModel } from "../../model/repriceModel";

export async function v2AlgoTest(
  req: Request<{ mpid: string }, any, any, any>,
  res: Response,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(StatusCodes.BAD_REQUEST, "Validation error", {
      errors: errors.array(),
    });
  }
  const { mpid } = req.params;

  let prod: ProductDetailsListItem | undefined =
    await sqlHelper.GetItemListById(mpid);
  if (!prod) {
    res.status(StatusCodes.BAD_REQUEST).json("No product found");
    return;
  }
  const net32Products = await getNet32Products(mpid, prod);
  const prioritySequence = getPrioritySequence();
  const internalProducts = getInternalProducts(prod, prioritySequence);

  const prioritySequenceFiltered = prioritySequence.filter((x) =>
    net32Products.some((y) => y.vendorId === VendorIdLookup[x.name]),
  );

  let results: RepriceModel[] = [];

  for (const priority of prioritySequenceFiltered) {
    const result = await repriceProduct(
      mpid,
      net32Products,
      internalProducts.find(
        (x) => x.ownVendorName === priority.name,
      ) as unknown as FrontierProduct,
      priority.name,
    );
    if (result) {
      results.push(result.cronResponse.repriceData);
    }
  }
  const v2Response = repriceProductV2(
    mpid,
    net32Products,
    internalProducts,
    results,
  );

  res.status(StatusCodes.OK).json(v2Response);
}

async function getNet32Products(mpId: string, prod: ProductDetailsListItem) {
  const cronId = getCronId(prod);
  const searchRequest = process.env.GET_SEARCH_RESULTS!.replace("{mpId}", mpId);
  const net32resp: AxiosResponse<Net32Product[]> = await axiosHelper.getAsync(
    searchRequest,
    cronId,
  );
  return net32resp.data.map((x) => ({
    ...x,
    vendorId:
      typeof x.vendorId === "number" ? x.vendorId : parseInt(x.vendorId),
  }));
}

function getCronId(prod: ProductDetailsListItem) {
  if (prod.tradentDetails) return prod.tradentDetails.cronId;
  if (prod.frontierDetails) return prod.frontierDetails.cronId;
  if (prod.mvpDetails) return prod.mvpDetails.cronId;
  if (prod.topDentDetails) return prod.topDentDetails.cronId;
  if (prod.firstDentDetails) return prod.firstDentDetails.cronId;
  throw new Error("No cronId found");
}

function getPrioritySequence() {
  return [
    { name: Vendor.TRADENT },
    { name: Vendor.FRONTIER },
    { name: Vendor.MVP },
    { name: Vendor.TOPDENT },
    { name: Vendor.FIRSTDENT },
  ];
}

function getInternalProducts(
  prod: ProductDetailsListItem,
  prioritySequence: { name: string }[],
) {
  return prioritySequence
    .map((x, i) => {
      switch (x.name) {
        case Vendor.FRONTIER:
          return {
            ...prod.frontierDetails,
            ownVendorId: VendorId.FRONTIER,
            ownVendorName: Vendor.FRONTIER,
            floorPrice: prod.frontierDetails?.floorPrice
              ? parseFloat(prod.frontierDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.frontierDetails?.maxPrice
              ? parseFloat(prod.frontierDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case Vendor.MVP:
          return {
            ...prod.mvpDetails,
            ownVendorId: VendorId.MVP,
            ownVendorName: Vendor.MVP,
            floorPrice: prod.mvpDetails?.floorPrice
              ? parseFloat(prod.mvpDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.mvpDetails?.maxPrice
              ? parseFloat(prod.mvpDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case Vendor.TRADENT:
          return {
            ...prod.tradentDetails,
            ownVendorId: VendorId.TRADENT,
            ownVendorName: Vendor.TRADENT,
            floorPrice: prod.tradentDetails?.floorPrice
              ? parseFloat(prod.tradentDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.tradentDetails?.maxPrice
              ? parseFloat(prod.tradentDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case Vendor.FIRSTDENT:
          return {
            ...prod.firstDentDetails,
            ownVendorId: VendorId.FIRSTDENT,
            ownVendorName: Vendor.FIRSTDENT,
            floorPrice: prod.firstDentDetails?.floorPrice
              ? parseFloat(
                  prod.firstDentDetails.floorPrice as unknown as string,
                )
              : 0,
            maxPrice: prod.firstDentDetails?.maxPrice
              ? parseFloat(prod.firstDentDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case Vendor.TOPDENT:
          return {
            ...prod.topDentDetails,
            ownVendorId: VendorId.TOPDENT,
            ownVendorName: Vendor.TOPDENT,
            floorPrice: prod.topDentDetails?.floorPrice
              ? parseFloat(prod.topDentDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.topDentDetails?.maxPrice
              ? parseFloat(prod.topDentDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        default:
          throw new Error(`Unknown vendor: ${x.name}`);
      }
    })
    .filter((x) => x !== null && x.activated);
}
