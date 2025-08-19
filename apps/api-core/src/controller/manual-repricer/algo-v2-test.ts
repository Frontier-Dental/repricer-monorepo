import { AxiosResponse } from "axios";
import { Request, Response } from "express";
import { validationResult } from "express-validator";
import createError from "http-errors";
import { StatusCodes } from "http-status-codes";
import { Net32Product } from "../../types/net32";
import * as axiosHelper from "../../utility/axios-helper";
import { applicationConfig } from "../../utility/config";
import * as sqlHelper from "../../utility/mysql/mysql-helper";
import { ProductDetailsListItem } from "../../utility/mysql/mySql-mapper";
import { getAllOwnVendorNames } from "../../utility/reprice-algo/v2/utility";
import { repriceProductV2Wrapper } from "../../utility/reprice-algo/v2/wrapper";
import { v4 } from "uuid";

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

  const results = await repriceProductV2Wrapper(
    net32Products,
    prod,
    getAllOwnVendorNames(),
    "MANUAL",
    v4(),
  );

  res.status(StatusCodes.OK).json(results);
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
