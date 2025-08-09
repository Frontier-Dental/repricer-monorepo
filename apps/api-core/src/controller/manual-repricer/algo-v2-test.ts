import { AxiosResponse } from "axios";
import { Request, Response } from "express";
import { validationResult } from "express-validator";
import createError from "http-errors";
import { StatusCodes } from "http-status-codes";
import { Net32Product } from "../../types/net32";
import * as axiosHelper from "../../utility/axios-helper";
import { applicationConfig } from "../../utility/config";
import { checkIfProductIsIn422 } from "../../utility/feed-helper";
import * as sqlHelper from "../../utility/mysql/mysql-helper";
import { ProductDetailsListItem } from "../../utility/mysql/mySql-mapper";
import { getShippingThreshold } from "../../utility/reprice-algo/v2/shipping-threshold";
import {
  Net32AlgoProduct,
  VendorIdLookup,
  VendorName,
} from "../../utility/reprice-algo/v2/types";
import {
  getAllOwnVendorIds,
  getAllOwnVendorNames,
  getInternalProducts,
} from "../../utility/reprice-algo/v2/utility";
import { repriceProductV2 } from "../../utility/reprice-algo/v2/v2_algorithm";
import { findOrCreateV2AlgoSettingsForVendors } from "../../utility/mysql/v2-algo-settings";

export async function v2AlgoTest(
  req: Request<{ mpid: string }, { products: Net32Product[] }, any, any>,
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
  const net32Products: Net32Product[] =
    req.body.products || (await getNet32Products(mpid, prod));
  const prioritySequence = getAllOwnVendorNames();
  const internalProducts = getInternalProducts(prod, prioritySequence);

  const prioritySequenceFiltered = prioritySequence.filter((x) =>
    net32Products.some((y) => y.vendorId === VendorIdLookup[x.name]),
  );

  const productsWith422Presence = await Promise.all(
    internalProducts.map(async (x) => {
      const is422 = await checkIfProductIsIn422(
        parseInt(mpid, 10),
        x.ownVendorName as VendorName,
      );
      return {
        ...x,
        is422,
      };
    }),
  );

  const vendorSettings = await findOrCreateV2AlgoSettingsForVendors(
    parseInt(mpid, 10),
    internalProducts
      .filter(
        (x) =>
          !productsWith422Presence.find(
            (y) => y.ownVendorId === x.ownVendorId && y.is422,
          ),
      )
      .map((x) => x.ownVendorId),
  );

  console.log(vendorSettings);

  const { html } = repriceProductV2(
    parseInt(mpid, 10),
    net32Products.map((p) => ({
      ...p,
      freeShippingThreshold: getShippingThreshold(
        parseInt(p.vendorId as string),
      ),
    })) as Net32AlgoProduct[],
    productsWith422Presence.filter((x) => !x.is422),
    getAllOwnVendorIds(),
    vendorSettings, // vendorSettings - not needed for testing
    productsWith422Presence.filter((x) => x.is422),
  );

  res.status(StatusCodes.OK).json({ html });
}

async function getNet32Products(mpId: string, prod: ProductDetailsListItem) {
  const cronId = getCronId(prod);
  const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace(
    "{mpId}",
    mpId,
  );
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
