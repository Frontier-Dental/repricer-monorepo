import csv from "csv-parser";
import { Request, Response } from "express";
import fs from "fs";
import { Parser } from "json2csv";
import _ from "lodash";
import moment from "moment";
import * as httpMiddleware from "../middleware/http-wrappers";
import * as mongoMiddleware from "../middleware/mongo";
import * as mySqlMiddleware from "../middleware/mysql";

export async function ResetSlowCronUpdate(req: Request, res: Response) {
  const query = {
    $or: [
      { "tradentDetails.cronId": "b597ffd1ce4d463088ce12a6f05b55d6" },
      { "frontierDetails.cronId": "b597ffd1ce4d463088ce12a6f05b55d6" },
      { "mvpDetails.cronId": "b597ffd1ce4d463088ce12a6f05b55d6" },
    ],
  };
  let impactedProductList = await mongoMiddleware.GetProductListByQuery(query);
  if (impactedProductList && impactedProductList.length > 0) {
    for (let product of impactedProductList) {
      if (product.tradentDetails) {
        product.tradentDetails.cronId = product.tradentDetails.parentCronId;
        product.tradentDetails.cronName = product.tradentDetails.parentCronName;
        product.tradentDetails.parentCronId = null;
        product.tradentDetails.parentCronName = null;
      }
      if (product.frontierDetails) {
        product.frontierDetails.cronId = product.frontierDetails.parentCronId;
        product.frontierDetails.cronName =
          product.frontierDetails.parentCronName;
        product.frontierDetails.parentCronId = null;
        product.frontierDetails.parentCronName = null;
      }
      if (product.mvpDetails) {
        product.mvpDetails.cronId = product.mvpDetails.parentCronId;
        product.mvpDetails.cronName = product.mvpDetails.parentCronName;
        product.mvpDetails.parentCronId = null;
        product.mvpDetails.parentCronName = null;
      }
      console.log(`Resetting General Cron Details for ${product.mpId}`);
      await mongoMiddleware.InsertOrUpdateProduct(product, req);
    }
  }
  return res.json({
    status: true,
    message: `Updated All Product : Count ${impactedProductList.length}`,
  });
}

export async function RefillParentCronDetails(req: Request, res: Response) {
  const payload = _.map(req.body, "mpId");
  let results: any[] = [];
  const cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  if (payload && payload.length > 0) {
    for (const mpId of payload) {
      let product = _.first(await mongoMiddleware.FindProductById(mpId)) as any;
      const contextCronDetails: any = await getContextCronDetails(
        product,
        cronSettingsResponse,
      );
      if (contextCronDetails && contextCronDetails.cronName) {
        if (product.tradentDetails) {
          product.tradentDetails.cronId = contextCronDetails.cronId;
          product.tradentDetails.cronName = contextCronDetails.cronName;
          product.tradentDetails.parentCronId = null;
          product.tradentDetails.parentCronName = null;
        }
        if (product.frontierDetails) {
          product.frontierDetails.cronId = contextCronDetails.cronId;
          product.frontierDetails.cronName = contextCronDetails.cronName;
          product.frontierDetails.parentCronId = null;
          product.frontierDetails.parentCronName = null;
        }
        if (product.mvpDetails) {
          product.mvpDetails.cronId = contextCronDetails.cronId;
          product.mvpDetails.cronName = contextCronDetails.cronName;
          product.mvpDetails.parentCronId = null;
          product.mvpDetails.parentCronName = null;
        }
        console.log(
          `Resetting General Cron Details for ${product.mpId} with context cron : ${contextCronDetails.cronName}`,
        );
        await mongoMiddleware.InsertOrUpdateProduct(product, req);
        results.push({
          productId: mpId,
          cronName: contextCronDetails.cronName,
        });
      } else {
        results.push({ productId: mpId, cronName: "" });
      }
    }
  }
  return res.json({
    status: true,
    message: `Updated All Product : Count - ${payload.length}`,
    data: results,
  });
}

export async function CorrectSlowCronDetails(req: Request, res: Response) {
  const payload = req.body;
  let results: any[] = [];
  if (payload && payload.length > 0) {
    for (const mpId of payload) {
      console.log(`Resetting Slow Cron Details for ${mpId}`);
      const mongoResult = await mongoMiddleware.InsertOrUpdateProductWithQuery(
        mpId.toString(),
        { $set: { isSlowActivated: false } },
        // req,
      );
      results.push({ productId: mpId, result: mongoResult });
    }
  }
  return res.json({
    status: true,
    message: `Updated All Product : Count - ${payload.length}`,
    data: results,
  });
}

export async function ScrapeProduct(req: Request, res: Response) {
  const mpId = req.params.mpid;
  const proxyProvId = req.params.proxyProviderId;
  const requestUrl = `${process.env.GET_DATA_URL}/${mpId}/${proxyProvId}`;
  const axiosResponse = await httpMiddleware.native_get(requestUrl);
  return res.json(axiosResponse!.data);
}

export async function MapVendorToRoot(req: Request, res: Response) {
  const mpIdList = req.body;
  if (mpIdList && mpIdList.length > 0) {
    const regCronData = await mongoMiddleware.GetCronSettingsList();
    for (const $ of mpIdList) {
      $.CronId = regCronData.find(
        (x: any) => x.CronName == $.CronName.trim(),
      ).CronId;
      await mySqlMiddleware.MapVendorToRoot($);
    }
  }
  return res.json(`Mapped Vendor to Product for ${mpIdList.length} products`);
}

export async function GetFloorBelowProducts(req: Request, res: Response) {
  const filePath = "C:\\Users\\ghosh\\Desktop\\POST.csv";
  const results: any[] = (await readCSV(filePath)) as any;
  const filterResults: any[] = [];
  if (results && results.length > 0) {
    for (const item of results) {
      const unitPrice = parseFloat(item.UnitPrice);
      const traFloor =
        item["TRA_FloorPrice"] != "NULL"
          ? parseFloat(item["TRA_FloorPrice"])
          : -1;
      const froFloor =
        item["FRO_FloorPrice"] != "NULL"
          ? parseFloat(item["FRO_FloorPrice"])
          : -1;
      const mvpFloor =
        item["MVP_FloorPrice"] != "NULL"
          ? parseFloat(item["MVP_FloorPrice"])
          : -1;
      if (unitPrice < traFloor) {
        if (
          !filterResults.some(
            (item) => item.MPID == item["Mpid"] && item.VENDOR == "TRADENT",
          )
        )
          filterResults.push({
            MPID: item["Mpid"],
            VENDOR: "TRADENT",
            UNIT_PRICE: unitPrice,
            FLOOR_PRICE: item["TRA_FloorPrice"],
          });
      }
      if (unitPrice < froFloor) {
        if (
          !filterResults.some(
            (item) => item.MPID == item["Mpid"] && item.VENDOR == "FRONTIER",
          )
        ) {
          filterResults.push({
            MPID: item["Mpid"],
            VENDOR: "FRONTIER",
            UNIT_PRICE: unitPrice,
            FLOOR_PRICE: item["FRO_FloorPrice"],
          });
        }
      }
      if (unitPrice < mvpFloor) {
        if (
          !filterResults.some(
            (item) => item.MPID == item["Mpid"] && item.VENDOR == "MVP",
          )
        ) {
          filterResults.push({
            MPID: item["Mpid"],
            VENDOR: "MVP",
            UNIT_PRICE: unitPrice,
            FLOOR_PRICE: item["MVP_FloorPrice"],
          });
        }
      }
    }
  }
  if (filterResults && filterResults.length > 0) {
    const parser = new Parser();
    const csv = parser.parse(filterResults);
    await fs.writeFileSync("output.csv", csv);
    console.log("CSV file generated successfully!");
  }
  return res.json(`GetFloorBelowProducts done`);
}

export async function DeleteHistory(req: Request, res: Response) {
  const { startDate, endDate } = req.body;
  const _startDate = new Date(startDate);
  const _endDate = new Date(endDate);
  let currentDate = _startDate;
  while (currentDate <= _endDate) {
    console.log(
      `Deleting History for Date : ${moment(currentDate).format("YYYY-MM-DD HH:mm:ss")}`,
    );
    const apiResponseQuery = `delete from table_history_apiResponse where RefTime < ?`;
    const historyQuery = `delete from table_history where RefTime < ?`;
    const apiUpdated = await mySqlMiddleware.ExecuteQuery(apiResponseQuery, [
      currentDate,
    ]);
    const historyUpdated = await mySqlMiddleware.ExecuteQuery(historyQuery, [
      currentDate,
    ]);
    console.log(
      `Deleted Records : EFFECTIVE DATE : ${currentDate} || ${JSON.stringify(apiUpdated)} || ${JSON.stringify(historyUpdated)}`,
    );
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return res.json(
    `DeleteHistory done for StartDate : ${startDate} | EndDate : ${endDate}`,
  );
}

export async function DeleteProdHistory(req: Request, res: Response) {
  const { startDate, endDate } = req.body;
  let _startDate = new Date(startDate);
  const _endDate = new Date(endDate);
  startDeletingHistoryFromProduction(_startDate, _endDate);
  return res.json(
    `DeleteHistory done from Live for StartDate : ${startDate} | EndDate : ${endDate}`,
  );
}

async function readCSV(filePath: any) {
  const results: any = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

async function getContextCronDetails(product: any, cronSettingsResponse: any) {
  let data: any = {};
  const excludedCronName = "Cron-422";
  if (product.tradentDetails) {
    if (product.tradentDetails.cronId) {
      data.cronId = product.tradentDetails.cronId;
      data.cronName = product.tradentDetails.cronName;
    } else {
      const lastCronRun = product.tradentDetails.lastCronRun;
      const lastUpdatedBy = product.tradentDetails.lastUpdatedBy;
      if (lastCronRun && lastCronRun != excludedCronName) {
        data.cronName = lastCronRun;
        data.cronId = cronSettingsResponse.find(
          (x: any) => x.CronName == lastCronRun,
        ).CronId;
      } else if (lastUpdatedBy && lastUpdatedBy != excludedCronName) {
        data.cronName = lastUpdatedBy;
        data.cronId = cronSettingsResponse.find(
          (x: any) => x.CronName == lastUpdatedBy,
        ).CronId;
      }
    }
    return data;
  }
  if (product.frontierDetails) {
    if (product.frontierDetails.cronId) {
      data.cronId = product.frontierDetails.cronId;
      data.cronName = product.frontierDetails.cronName;
    } else {
      const lastCronRun = product.frontierDetails.lastCronRun;
      const lastUpdatedBy = product.frontierDetails.lastUpdatedBy;
      if (lastCronRun && lastCronRun != excludedCronName) {
        data.cronName = lastCronRun;
        data.cronId = cronSettingsResponse.find(
          (x: any) => x.CronName == lastCronRun,
        ).CronId;
      } else if (lastUpdatedBy && lastUpdatedBy != excludedCronName) {
        data.cronName = lastUpdatedBy;
        data.cronId = cronSettingsResponse.find(
          (x: any) => x.CronName == lastUpdatedBy,
        ).CronId;
      }
    }
    return data;
  }
  if (product.mvpDetails) {
    if (product.mvpDetails.cronId) {
      data.cronId = product.mvpDetails.cronId;
      data.cronName = product.mvpDetails.cronName;
    } else {
      const lastCronRun = product.mvpDetails.lastCronRun;
      const lastUpdatedBy = product.mvpDetails.lastUpdatedBy;
      if (lastCronRun && lastCronRun != excludedCronName) {
        data.cronName = lastCronRun;
        data.cronId = cronSettingsResponse.find(
          (x: any) => x.CronName == lastCronRun,
        ).CronId;
      } else if (lastUpdatedBy && lastUpdatedBy != excludedCronName) {
        data.cronName = lastUpdatedBy;
        data.cronId = cronSettingsResponse.find(
          (x: any) => x.CronName == lastUpdatedBy,
        ).CronId;
      }
    }
    return data;
  }
}

async function startDeletingHistoryFromProduction(
  _startDate: any,
  _endDate: any,
) {
  while (_startDate < _endDate) {
    const startDateStr = moment(_startDate).format("YYYY-MM-DD 00:00:00");
    const nextDay = _startDate;
    nextDay.setDate(_startDate.getDate() + 1);
    const nextDayStr = moment(nextDay).format("YYYY-MM-DD 00:00:00");
    console.log(
      `Deleting History from LIVE : START DATE : ${startDateStr} || END DATE : ${nextDayStr}`,
    );
    //Call the Delete API & Wait for Response
    const payload = {
      startDate: startDateStr,
      endDate: nextDayStr,
    };
    await httpMiddleware.native_post(
      "http://159.89.121.57:3000/debug/delete_history",
      payload,
    );
    _startDate = nextDay;
  }
}
