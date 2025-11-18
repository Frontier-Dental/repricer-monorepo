import express, { Request, Response } from "express";
import _ from "lodash";
import * as _codes from "http-status-codes";
import * as repriceBase from "../utility/reprice-algo/reprice-base";
import * as dbHelper from "../utility/mongo/db-helper";
import * as axiosHelper from "../utility/axios-helper";
import * as filterMapper from "../utility/filter-mapper";
import * as historyHelper from "../utility/history-helper";
import * as debugProxyHelper from "../utility/debug-proxy-helper";
import * as mySqlHelper from "../utility/mysql/mysql-helper";
import * as uuid from "uuid";
import { applicationConfig } from "../utility/config";
import * as sqlV2Service from "../utility/mysql/mysql-v2";

export const debugController = express.Router();

debugController.get(
  "/debug/reprice/:key",
  async (req: Request, res: Response) => {
    const productId = req.params.key;
    let productDetails = await mySqlHelper.GetItemListById(productId); //await dbHelper.FindProductById(productId);
    let contextCronName = null;
    if (productDetails!.tradentDetails) {
      //productDetails.tradentDetails.is_nc_needed = true;
      //productDetails.tradentDetails.compareWithQ1 = true;
      (productDetails as any).tradentDetails.skipReprice = false;
      (productDetails as any).tradentDetails.allowReprice = false;
      contextCronName = (productDetails as any).tradentDetails.cronName;
    }
    if (productDetails!.frontierDetails) {
      (productDetails as any).frontierDetails.skipReprice = false;
      (productDetails as any).frontierDetails.allowReprice = false;
      contextCronName = (productDetails as any).frontierDetails.cronName;
    }
    if (productDetails!.mvpDetails) {
      (productDetails as any).mvpDetails.skipReprice = false;
      (productDetails as any).mvpDetails.allowReprice = false;
      contextCronName = (productDetails as any).mvpDetails.cronName;
    }
    if (productDetails!.topDentDetails) {
      (productDetails as any).topDentDetails.skipReprice = false;
      (productDetails as any).topDentDetails.allowReprice = false;
      contextCronName = (productDetails as any).topDentDetails.cronName;
    }
    if (productDetails!.firstDentDetails) {
      (productDetails as any).firstDentDetails.skipReprice = false;
      (productDetails as any).firstDentDetails.allowReprice = false;
      contextCronName = (productDetails as any).firstDentDetails.cronName;
    }
    if (productDetails!.triadDetails) {
      (productDetails as any).triadDetails.skipReprice = false;
      (productDetails as any).triadDetails.allowReprice = false;
      contextCronName = (productDetails as any).triadDetails.cronName;
    }
    let cronSettingsResponse =
      await sqlV2Service.GetCronSettingsDetailsByName(contextCronName);
    if (
      !cronSettingsResponse ||
      (cronSettingsResponse && cronSettingsResponse.length == 0)
    ) {
      const slowCronDetails = await dbHelper.GetSlowCronDetails();
      cronSettingsResponse = [
        slowCronDetails.find((x: any) => x.CronName == contextCronName),
      ];
    }
    await repriceBase.Execute(
      "TEST-DEBUG",
      [productDetails],
      new Date(),
      cronSettingsResponse,
      false,
    );
    res
      .status(_codes.StatusCodes.OK)
      .json(`Successfully executed Reprice for : ${productId}`);
  },
);

debugController.get(
  "/debug/fetch-data/:key/:cronId",
  async (req: Request, res: Response) => {
    const mpid = req.params.key;
    const cronId = req.params.cronId;
    const url = applicationConfig.GET_SEARCH_RESULTS.replace("{mpId}", mpid);
    console.log(`Calling debug/fetch-data for MPID : ${mpid} || URL : ${url}`);
    var axiosResponse = await axiosHelper.getAsync(url, cronId, null);
    res.status(_codes.StatusCodes.OK).send(axiosResponse.data);
  },
);

debugController.get(
  "/debug/update_products_v1",
  async (req: Request, res: Response) => {
    const query = { "frontierDetails.badgeIndicator": "BADGE_ONLY" };
    const requiredProducts = await dbHelper.ExecuteProductQuery(query);
    if (requiredProducts) {
      for (let prod of requiredProducts) {
        console.log(`Updating Execution Priority for ${prod.mpId}`);
        await dbHelper.ExecuteProductUpdate(prod.mpId, {
          "frontierDetails.executionPriority": 1,
        });
        if (prod.tradentDetails) {
          await dbHelper.ExecuteProductUpdate(prod.mpId, {
            "tradentDetails.executionPriority": 2,
          });
          if (prod.mvpDetails) {
            await dbHelper.ExecuteProductUpdate(prod.mpId, {
              "mvpDetails.executionPriority": 3,
            });
          }
        } else if (prod.mvpDetails) {
          dbHelper.ExecuteProductUpdate(prod.mpId, {
            "mvpDetails.executionPriority": 2,
          });
        }
      }
    }
    res
      .status(_codes.StatusCodes.OK)
      .json(
        `Successfully Updated Execution Priority For : ${requiredProducts?.length} products`,
      );
  },
);

debugController.post(
  "/debug/update_cron/:cronName",
  async (req: Request, res: Response) => {
    const requiredCronName = req.params.cronName.trim();
    const products = req.body;
    const cronSettingsResponse: any[] =
      await sqlV2Service.GetCronSettingsDetailsByName(requiredCronName);
    if (cronSettingsResponse && cronSettingsResponse.length > 0) {
      const cronId = _.first(cronSettingsResponse).CronId as any;
      for (let prod of products) {
        console.log(`Updating ${requiredCronName} for ${prod}`);
        let dbQuery: any = {};
        dbQuery["tradentDetails.cronId"] = cronId;
        dbQuery["tradentDetails.cronName"] = requiredCronName;
        dbQuery["frontierDetails.cronId"] = cronId;
        dbQuery["frontierDetails.cronName"] = requiredCronName;
        dbQuery["mvpDetails.cronId"] = cronId;
        dbQuery["mvpDetails.cronName"] = requiredCronName;
        dbHelper.ExecuteProductUpdate(prod, dbQuery);
      }
      res
        .status(_codes.StatusCodes.OK)
        .json(
          `Successfully Updated Cron : ${requiredCronName} for ${products.length} products. Please verify after sometime..`,
        );
    } else
      res
        .status(_codes.StatusCodes.BAD_REQUEST)
        .json(`Unable to find cron details for  : ${requiredCronName}`);
  },
);

debugController.get(
  "/debug/executeFilterCron/:cronName",
  async (req: Request, res: Response) => {
    const requiredCronName = req.params.cronName.trim();
    const cronSettingsResponse =
      await dbHelper.GetFilterCronDetailsByName(requiredCronName);
    await filterMapper.FilterProducts(cronSettingsResponse);
    res.status(_codes.StatusCodes.OK).send("Success!!");
  },
);

debugController.get(
  "/debug/filterProductsWithFloor/:cronId",
  async (req: Request, res: Response) => {
    let resultantOutput: any[] = [];
    const filterQuery = {
      $or: [
        { "tradentDetails.activated": true },
        { "mvpDetails.activated": true },
        { "frontierDetails.activated": true },
      ],
    };
    const cronId = req.params.cronId;
    const listOfActiveProducts =
      await dbHelper.GetProductListByQuery(filterQuery);
    console.log(
      `Got ${listOfActiveProducts?.length} active Products to process`,
    );
    let counter = 1;
    if (listOfActiveProducts && listOfActiveProducts.length > 0) {
      for (const prod of listOfActiveProducts) {
        const url = applicationConfig.GET_SEARCH_RESULTS.replace(
          "{mpId}",
          prod.mpId,
        );
        const net32Resp = await axiosHelper.getAsync(
          url,
          cronId,
          counter as unknown as string,
        );
        if (net32Resp && net32Resp.data && net32Resp.data.length > 0) {
          const tradentOption = net32Resp.data.find(
            (x: any) => x.vendorId == 17357,
          );
          const frontierOption = net32Resp.data.find(
            (x: any) => x.vendorId == 20722,
          );
          const mvpOption = net32Resp.data.find(
            (x: any) => x.vendorId == 20755,
          );
          if (prod.tradentDetails) {
            for (const pb of tradentOption.priceBreaks) {
              if (pb.unitPrice < parseFloat(prod.tradentDetails.floorPrice)) {
                let op: any = {};
                op.mpid = prod.mpId;
                op.vendor = tradentOption.vendorId;
                op.price = pb.unitPrice;
                op.floorPrice = parseFloat(prod.tradentDetails.floorPrice);
                op.priceBreak = pb.minQty;
                resultantOutput.push(op);
              }
            }
          }
          if (prod.frontierDetails) {
            for (const pb of frontierOption.priceBreaks) {
              if (pb.unitPrice < parseFloat(prod.frontierDetails.floorPrice)) {
                let op: any = {};
                op.mpid = prod.mpId;
                op.vendor = frontierOption.vendorId;
                op.price = pb.unitPrice;
                op.floorPrice = parseFloat(prod.frontierDetails.floorPrice);
                op.priceBreak = pb.minQty;
                resultantOutput.push(op);
              }
            }
          }
          if (prod.mvpDetails) {
            for (const pb of mvpOption.priceBreaks) {
              if (pb.unitPrice < parseFloat(prod.mvpDetails.floorPrice)) {
                let op: any = {};
                op.mpid = prod.mpId;
                op.vendor = mvpOption.vendorId;
                op.price = pb.unitPrice;
                op.floorPrice = parseFloat(prod.mvpDetails.floorPrice);
                op.priceBreak = pb.minQty;
                resultantOutput.push(op);
              }
            }
          }
        }
        counter++;
      }
    }
    console.log(`Completed Fetching Records....`);
    const fileName = `${uuid.v4().toString()}_Output.json`;
    const filePath = `../../history`;
    await historyHelper.Write(resultantOutput, fileName, filePath, null);
    res.status(_codes.StatusCodes.OK).send(resultantOutput);
  },
);

debugController.get(
  "/debug/get-data/:key/:proxyProviderId",
  async (req: Request, res: Response) => {
    const mpid = req.params.key;
    const proxyParam = parseInt(req.params.proxyProviderId);
    const proxyProvId = getProxyParamValue(proxyParam);
    const proxyProviderDetailsResponse =
      await sqlV2Service.GetProxyConfigByProviderId(proxyProvId);
    let proxyProviderDetails = getContextProxyProvider(
      proxyProviderDetailsResponse,
      proxyParam,
    );
    const url = applicationConfig.GET_SEARCH_RESULTS.replace("{mpId}", mpid);
    console.log(`Calling debug/get-data for MPID : ${mpid} || URL : ${url}`);
    if (!proxyProviderDetails || proxyProviderDetails.length == 0) {
      proxyProviderDetails = [{ proxyProvider: proxyProvId }];
    }
    var axiosResponse = await debugProxyHelper.GetData(
      url,
      _.first(proxyProviderDetails),
      proxyParam,
    );
    console.log(`Returning response for get-data for ${mpid}`);
    res.status(_codes.StatusCodes.OK).send(axiosResponse);
  },
);

debugController.get(
  "/debug/resetSlowCronSettings/",
  async (req: Request, res: Response) => {
    const cronId = "b597ffd1ce4d463088ce12a6f05b55d6";
    const cronName = "SCG-1";
    const query = {
      $or: [
        { "tradentDetails.cronId": cronId },
        { "frontierDetails.cronId": cronId },
        { "mvpDetails.cronId": cronId },
      ],
    };
    const productListDetails = await dbHelper.GetProductListByQuery(query);
    if (productListDetails && productListDetails.length > 0) {
      for (let product of productListDetails) {
        console.log(`Updating Details for ${product.mpId}`);
        let dbQuery: any = {};
        dbQuery["isSlowActivated"] = true;
        if (product.tradentDetails) {
          dbQuery["tradentDetails.cronId"] = "1659197d96d1453fbb8838f5680251bb";
          dbQuery["tradentDetails.cronName"] = "Cron-2";
          dbQuery["tradentDetails.parentCronId"] = null;
          dbQuery["tradentDetails.parentCronName"] = null;
          dbQuery["tradentDetails.slowCronName"] = cronName;
          dbQuery["tradentDetails.slowCronId"] = cronId;
        }
        if (product.frontierDetails) {
          dbQuery["frontierDetails.cronId"] =
            "1659197d96d1453fbb8838f5680251bb";
          dbQuery["frontierDetails.cronName"] = "Cron-2";
          dbQuery["frontierDetails.parentCronId"] = null;
          dbQuery["frontierDetails.parentCronName"] = null;
          dbQuery["frontierDetails.slowCronName"] = cronName;
          dbQuery["frontierDetails.slowCronId"] = cronId;
        }
        if (product.mvpDetails) {
          dbQuery["mvpDetails.cronId"] = "1659197d96d1453fbb8838f5680251bb";
          dbQuery["mvpDetails.cronName"] = "Cron-2";
          dbQuery["mvpDetails.parentCronId"] = null;
          dbQuery["mvpDetails.parentCronName"] = null;
          dbQuery["mvpDetails.slowCronName"] = cronName;
          dbQuery["mvpDetails.slowCronId"] = cronId;
        }
        dbHelper.ExecuteProductUpdate(product.mpId, dbQuery);
      }
    }
    res.status(_codes.StatusCodes.OK).send("Success!!");
  },
);

debugController.get(
  "/debug/execute_422/:key/:vendor",
  async (req: Request, res: Response) => {
    const productId = req.params.key;
    const vendorName = req.params.vendor;
    const productDetails = await dbHelper.FindProductById(productId);
    let cronSettingDetailsResponse = await sqlV2Service.GetCronSettingsList();
    let slowCronDetails = await dbHelper.GetSlowCronDetails();
    cronSettingDetailsResponse = _.concat(
      cronSettingDetailsResponse,
      slowCronDetails,
    );
    const contextCronId = getContextCronId(productDetails, vendorName);
    await repriceBase.RepriceErrorItem(
      productDetails,
      new Date(),
      cronSettingDetailsResponse.find((x: any) => x.CronId == contextCronId),
      vendorName,
    );
    res
      .status(_codes.StatusCodes.OK)
      .send(
        `Success for repricing 422 product ${productId} || ${vendorName} !!`,
      );
  },
);

function getProxyParamValue(value: any) {
  let returnValue = 123242;
  switch (value) {
    case 10:
    case 11:
    case 12:
      returnValue = 1;
      break;
    default:
      returnValue = value;
      break;
  }
  return returnValue;
}

function getContextProxyProvider(dbResponse: any, proxyParam: any) {
  switch (proxyParam) {
    case 11:
      return dbResponse.find((x: any) => x.ipType == 1);
    case 12:
      return dbResponse.find((x: any) => x.ipType == 2);
    default:
      return dbResponse;
  }
}

function getContextCronId(productDetails: any, vendorName: string) {
  switch (vendorName) {
    case "TRADENT":
      return productDetails.tradentDetails
        ? productDetails.tradentDetails.cronId
        : null;
    case "FRONTIER":
      return productDetails.frontierDetails
        ? productDetails.frontierDetails.cronId
        : null;
    case "MVP":
      return productDetails.mvpDetails
        ? productDetails.mvpDetails.cronId
        : null;
    case "TOPDENT":
      return productDetails.topDentDetails
        ? productDetails.topDentDetails.cronId
        : null;
    case "FIRSTDENT":
      return productDetails.firstDentDetails
        ? productDetails.firstDentDetails.cronId
        : null;
    case "TRIAD":
      return productDetails.triadDetails
        ? productDetails.triadDetails.cronId
        : null;
    default:
      return null;
  }
}
