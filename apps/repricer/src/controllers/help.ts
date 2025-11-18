import axios from "axios";
import child_process from "child_process";
import { Request, Response } from "express";
import fs from "fs";
import _ from "lodash";
import path from "path";
import util from "util";
import { v4 as uuidv4 } from "uuid";
import * as httpHelper from "../utility/http-wrappers";
import * as mongoMiddleware from "../services/mongo";
import * as mySqlMiddleware from "../services/mysql";
import ProductModel from "../models/product";
import * as secretDetailsResx from "../../resources/SecretKeyMapping.json";
import cronMapping from "../../resources/cronMapping.json";
import * as configIpResx from "../../resources/serverIp.json";
import * as sqlMapper from "../utility/mapper/mysql-mapper";
import * as sessionHelper from "../utility/session-helper";
import {
  GetConfigurations,
  GetCronSettingsList,
  InsertOrUpdateCronSettings,
  UpdateCronSettingsList,
  GetSlowCronDetails,
} from "../services/mysql-v2";

export async function getLogsById(req: Request, res: Response) {
  const idx = req.params.id;
  const getResponse = await mongoMiddleware.GetLogsById(idx);
  return res.json({
    status: true,
    message: getResponse,
  });
}

export async function getProductDetails(req: Request, res: Response) {
  const idx = req.params.id;
  const getResponse = await mySqlMiddleware.GetFullProductDetailsById(
    parseInt(idx.trim()),
  );
  return res.json({
    status: true,
    message: getResponse,
  });
}

export async function doHealthCheck(req: Request, res: Response) {
  const getResponse = await mongoMiddleware.GetDefaultUserLogin();
  if (getResponse.userName.toLowerCase() != null) {
    return res.status(200).json({
      status: "OK",
      message: "System health check is successful",
    });
  } else {
    return res.status(500).json({
      status: "DOWN",
      message: "System health check has failed",
    });
  }
}

export async function doIpHealthCheck(req: Request, res: Response) {
  let healthResp: any[] = [];
  if (configIpResx && configIpResx.length > 0) {
    for (const $ of configIpResx) {
      console.log(`Checking health for IP : ${$.ip} || PORT : ${$.port} `);
      let check: any = { ip: $.ip, port: $.port };
      var config = {
        method: "get",
        timeout: 1000 * 2,
        url: "https://www.net32.com/rest/neo/pdp/129614/vendor-options",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
          "Content-Type": "application/json",
        },
        proxy: {
          protocol: "http",
          host: $.ip,
          port: $.port,
          auth: {
            username: "Tradent",
            password: "Lyo0P84L1",
          },
        },
      };
      try {
        const response = await axios(config);
        if (response && response.status == 200) {
          check.net32ReturnStatusCode = response.status;
          check.ipHealth = `Green`;
        } else {
          check.net32ReturnStatusCode = response.status;
          check.ipHealth = `Red`;
        }
      } catch (ex) {
        console.log(ex);
        check.net32ReturnStatusCode = 9999;
        check.ipHealth = `Red`;
      }
      healthResp.push(check as never);
    }
  }
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
}

export async function pingCheck(req: Request, res: Response) {
  let healthResp: any = [];
  if (configIpResx && configIpResx.length > 0) {
    for (const $ of configIpResx) {
      console.log(`Pinging IP : ${$.ip} `);
      healthResp.push((await ping($.ip, $.port)) as never);
    }
  }
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
}

export async function troubleshoot(req: Request, res: Response) {
  const cronSettingsResult = await GetCronSettingsList();
  const configItems = await GetConfigurations();
  const contextItem = configItems.find(
    (x: any) => x.proxyProvider == 1 && x.ipType == 0,
  );
  const port = contextItem ? contextItem.port : "N/A";
  const listOfIps = _.map(cronSettingsResult, "FixedIp");
  res.render("pages/help/index", {
    model: listOfIps.join(";"),
    groupName: "troubleshoot",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function debugIp(req: Request, res: Response) {
  let healthResp: any = [];
  const { listOfIps } = req.body;
  if (listOfIps && listOfIps.length > 0) {
    for (const ip of listOfIps) {
      if (ip && ip != "") {
        console.log(`Pinging IP : ${ip} `);
        healthResp.push((await ping(ip, "N/A")) as never);
      }
    }
  }
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
}

export async function debugIpV2(req: Request, res: Response) {
  let healthResp: any = [];
  const { listOfIps } = req.body;
  if (listOfIps && listOfIps.length > 0) {
    for (const ip of listOfIps) {
      if (ip && ip != "") {
        console.log(`Pinging IP : ${ip} `);
        healthResp.push((await ping(ip, "N/A")) as never);
      }
    }
  }
  healthResp = await mapCronDetails(healthResp);
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
}

export async function loadProductDetails(req: Request, res: Response) {
  const mpId = req.params.id;
  let productDetails: any = new ProductModel("");
  productDetails.mpId = mpId;
  let tradentDetails: any = await httpHelper.native_get(
    `http://159.203.57.169:3000/help/ProductDetails/${mpId}`,
  );
  let frontierDetails: any = await httpHelper.native_get(
    `http://142.93.159.114:3000/help/ProductDetails/${mpId}`,
  );
  let mvpDetails: any = await httpHelper.native_get(
    `http://157.230.58.34:3000/help/ProductDetails/${mpId}`,
  );

  productDetails.tradentDetails = await getVendorDetails(
    tradentDetails.data.message[0],
  );
  productDetails.frontierDetails = await getVendorDetails(
    frontierDetails.data.message[0],
  );
  productDetails.mvpDetails = await getVendorDetails(
    mvpDetails.data.message[0],
  );
  if (productDetails.tradentDetails) {
    if (productDetails.frontierDetails) {
      productDetails.frontierDetails.cronId =
        productDetails.tradentDetails.cronId;
      productDetails.frontierDetails.cronName =
        productDetails.tradentDetails.cronName;
    }
    if (productDetails.mvpDetails) {
      productDetails.mvpDetails.cronId = productDetails.tradentDetails.cronId;
      productDetails.mvpDetails.cronName =
        productDetails.tradentDetails.cronName;
    }
  }
  await mongoMiddleware.InsertOrUpdateProduct(productDetails, req);
  return res.status(200).json({
    status: `SUCCESS`,
    product: productDetails,
  });
}

export async function createCrons(req: Request, res: Response) {
  const countOfCrons = parseInt(req.params.count);
  const existingCronDetails = await GetCronSettingsList();
  const generalCronDetails = _.filter(
    existingCronDetails,
    (x) => x.IsHidden != true,
  );
  const contextCron = _.first(generalCronDetails);
  if (!contextCron) {
    throw new Error("No cron found");
  }
  let newCronList = cronMapping;
  for (let count = 1; count <= countOfCrons; count++) {
    const $id = uuidv4().split("-").join("");
    let cron = _.cloneDeep(contextCron);
    _.unset(cron, "_id");
    cron.CronName = `Cron-${generalCronDetails.length + count}`;
    cron.CreatedTime = new Date();
    cron.UpdatedTime = new Date();
    cron.CronStatus = false;
    cron.CronId = $id;
    //await mongoMiddleware.InsertCronSettings(cron);
    newCronList.push({
      cronId: $id,
      cronVariable: `_E${generalCronDetails.length + count}Cron`,
    });
    console.log(`Inserted ${cron.CronName} with Id : ${cron.CronId}`);
  }

  // Write ResourceFile
  if (newCronList.length > 0) {
    const filePath = path.resolve(__dirname, "../resources/cronMapping.json");
    (fs as any).writeFileSync(
      filePath,
      JSON.stringify(newCronList, null, 4),
      "utf8",
      () => {
        console.log(`File Written Successfully !`);
      },
    );
  }
  return res.json({
    status: true,
    message: newCronList,
  });
}

export async function alignExecutionPriority(req: Request, res: Response) {
  const productDetailsList = await mongoMiddleware.GetAllProductDetails();
  if (productDetailsList) {
    _.forEach(productDetailsList, (productDetails) => {
      if (
        productDetails.tradentDetails &&
        (!productDetails.tradentDetails.executionPriority ||
          productDetails.tradentDetails.executionPriority == null)
      ) {
        mongoMiddleware.UpdateExecutionPriority(productDetails.mpId, 0, 1, req);
      }
      if (
        productDetails.frontierDetails &&
        (!productDetails.frontierDetails.executionPriority ||
          productDetails.frontierDetails.executionPriority == null)
      ) {
        mongoMiddleware.UpdateExecutionPriority(productDetails.mpId, 1, 2, req);
      }
      if (
        productDetails.mvpDetails &&
        (!productDetails.mvpDetails.executionPriority ||
          productDetails.mvpDetails.executionPriority == null)
      ) {
        mongoMiddleware.UpdateExecutionPriority(productDetails.mpId, 2, 3, req);
      }
    });
  }
  return res.status(200).json({
    status: `SUCCESS`,
    product: `Done updation of Products ${productDetailsList.length}`,
  });
}

async function ping(hostname: any, port: any) {
  let check: any = null;
  let pingResponse: any = null;
  pingResponse = await execPing(hostname);
  check = await getCheck(pingResponse, hostname, port);
  if (check && check.ipStatus == "RED") {
    // Retry 1 time after 1 second after failure
    await delay(1000);
    pingResponse = await execPing(hostname);
    check = await getCheck(pingResponse, hostname, port);
  }
  return check;
}

async function mapCronDetails(healthResp: any) {
  const cronSettingsList = await GetCronSettingsList();
  _.forEach(healthResp, (h) => {
    h.cronName = getCronName(h.ip, cronSettingsList);
  });
  return healthResp;
}

function getCronName(ip: any, list: any) {
  const relatedCron = list.find((cron: any) => cron.FixedIp == ip);
  return relatedCron && relatedCron.CronName ? relatedCron.CronName : "N/A";
}

async function execPing(hostname: any) {
  const controller = new AbortController();
  const { signal } = controller;
  const exec = (util as any).promisify(child_process.exec, { signal });
  return await exec(`ping -c 3 ${hostname}`);
}

async function getCheck(pingResponse: any, hostname: any, port: any) {
  let check: any = { ip: hostname, port: port };
  if (pingResponse && pingResponse.stdout) {
    const validStdOut = pingResponse.stdout.replaceAll("\r\n", "");
    const checkStr = `64 bytes from ${hostname}`;
    check.pingResponse = validStdOut;
    check.ipStatus = validStdOut.indexOf(checkStr) > -1 ? "GREEN" : "RED";
  } else {
    check.pingResponse = 9998;
    check.ipHealth = `BLACK`;
  }
  return check;
}

async function getVendorDetails(obj: any) {
  if (obj) {
    let vendorData = _.cloneDeep(obj);
    _.unset(vendorData, "_id");
    _.unset(vendorData, "__v");
    vendorData.last_cron_time = null;
    vendorData.last_update_time = null;
    vendorData.last_attempted_time = null;
    vendorData.next_cron_time = null;
    vendorData.lastExistingPrice = null;
    vendorData.lastSuggestedPrice = null;
    vendorData.lowest_vendor = null;
    vendorData.lowest_vendor_price = null;
    vendorData.last_cron_message = null;
    vendorData.lastCronRun = null;
    vendorData.insertReason = null;
    vendorData.lastUpdatedBy = null;
    return vendorData;
  }
  return null;
}

export async function updateCronSecretKey(req: Request, res: Response) {
  let cronSettingsList: any = await GetCronSettingsList();
  for (let $ of cronSettingsList) {
    if ($.CronName != "Cron-422") {
      $.SecretKey = await getSecretKeyDetails($.CronName);
    }
  }
  await UpdateCronSettingsList(cronSettingsList, req);
  return res.status(200).json({
    status: `SUCCESS`,
    cronDetails: cronSettingsList,
  });
}

async function getSecretKeyDetails(cronName: any) {
  let secretDetails: any = [];
  const vendorName = ["TRADENT", "FRONTIER", "MVP", "FIRSTDENT", "TOPDENT"];
  for (const v of vendorName) {
    let vDetail: any = {};
    vDetail.vendorName = v;
    vDetail.secretKey = secretDetailsResx.find(
      (x) =>
        x.CronName.toUpperCase() == cronName.trim().toUpperCase() &&
        x.Vendor == v,
    )?.SecretKey;
    secretDetails.push(vDetail);
  }
  return secretDetails;
}

/** SQL MIGRATION UTILITIES */
export async function migrateCronSettingsToSql(req: Request, res: Response) {
  const cronTypes = req.body.cronTypes;
  let cronSettingsList: any = [];
  const auditInfo = await sessionHelper.GetAuditInfo(req);
  for (const cronType of cronTypes) {
    switch (cronType) {
      case "REGULAR":
        cronSettingsList = await mongoMiddleware.GetCronSettingsList();
        if (cronSettingsList && cronSettingsList.length > 0) {
          for (let cronSetting of cronSettingsList) {
            cronSetting.CronType = cronType;
            const cronSettingEntity = await sqlMapper.mapCronSettingToEntity(
              cronSetting,
              auditInfo,
            );
            const cronSettingSecretKeys =
              await sqlMapper.mapCronSettingSecretKeysToEntity(cronSetting);
            const alternateProxyProviders =
              await sqlMapper.mapAlternateProxyProvidersToEntity(cronSetting);
            await InsertOrUpdateCronSettings(
              cronSettingEntity,
              cronSettingSecretKeys,
              alternateProxyProviders,
            );
          }
        }
        break;
      case "SLOW":
        cronSettingsList = await GetSlowCronDetails();
        if (cronSettingsList && cronSettingsList.length > 0) {
          for (let cronSetting of cronSettingsList) {
            cronSetting.CronType = cronType;
            const cronSettingEntity = await sqlMapper.mapCronSettingToEntity(
              cronSetting,
              auditInfo,
            );
            const cronSettingSecretKeys =
              await sqlMapper.mapCronSettingSecretKeysToEntity(cronSetting);
            const alternateProxyProviders =
              await sqlMapper.mapAlternateProxyProvidersToEntity(cronSetting);
            await InsertOrUpdateCronSettings(
              cronSettingEntity,
              cronSettingSecretKeys,
              alternateProxyProviders,
            );
          }
        }
      default:
        break;
    }
  }
  return res.status(200).json({
    status: `SUCCESS`,
    message: `Successfully migrated cron settings to SQL for cron type ${cronTypes.join(", ")}`,
  });
}
const delay = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));
