const _ = require("lodash");
const asyncHandler = require("express-async-handler");
var fs = require("fs");
var path = require("path");
const { v4: uuidv4 } = require("uuid");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const Item = require("../models/item");
const userModel = require("../models/user");
const configIpResx = require("../resources/serverIp.json");
const axios = require("axios");
const child_process = require("child_process");
const util = require("util");
const ProductModel = require("../models/product");
const httpHelper = require("../middleware/httpMiddleware");
const secretDetailsResx = require("../resources/SecretKeyMapping.json");
let cronMapping = require("../resources/cronMapping.json");
const mySqlMiddleware = require("../middleware/mySQLMiddleware");

const getLogsById = asyncHandler(async (req, res) => {
  try {
    const idx = req.params.id;
    const getResponse = await mongoMiddleware.GetLogsById(idx);
    return res.json({
      status: true,
      message: getResponse,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const getProductDetails = asyncHandler(async (req, res) => {
  try {
    const idx = req.params.id;
    const getResponse = await mySqlMiddleware.GetFullProductDetailsById(
      parseInt(idx.trim()),
    );
    return res.json({
      status: true,
      message: getResponse,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const doHealthCheck = asyncHandler(async (req, res) => {
  try {
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
  } catch (exception) {
    return res.status(500).json({
      status: `EXCEPTION`,
      error: exception,
    });
  }
});

const doIpHealthCheck = asyncHandler(async (req, res) => {
  try {
    let healthResp = [];
    if (configIpResx && configIpResx.length > 0) {
      for (const $ of configIpResx) {
        console.log(`Checking health for IP : ${$.ip} || PORT : ${$.port} `);
        let check = { ip: $.ip, port: $.port };
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
          check.net32ReturnStatusCode = 9999;
          check.ipHealth = `Red`;
        }
        healthResp.push(check);
      }
    }
    return res.status(200).json({
      status: `SUCCESS`,
      healthInfo: healthResp,
    });
  } catch (exception) {
    return res.status(500).json({
      status: `EXCEPTION`,
      error: exception,
    });
  }
});

const pingCheck = asyncHandler(async (req, res) => {
  let healthResp = [];
  if (configIpResx && configIpResx.length > 0) {
    for (const $ of configIpResx) {
      console.log(`Pinging IP : ${$.ip} `);
      healthResp.push(await ping($.ip, $.port));
    }
  }
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
});

const troubleshoot = asyncHandler(async (req, res) => {
  const cronSettingsResult = await mongoMiddleware.GetCronSettingsList();
  const configItems = await mongoMiddleware.GetConfigurations();
  const contextItem = configItems.find(
    (x) => x.proxyProvider == 1 && x.ipType == 0,
  );
  const port = contextItem ? contextItem.port : "N/A";
  const listOfIps = _.map(cronSettingsResult, "FixedIp");
  res.render("pages/help/index", {
    model: listOfIps.join(";"),
    groupName: "troubleshoot",
    userRole: req.session.users_id.userRole,
  });
});

const debugIp = asyncHandler(async (req, res) => {
  let healthResp = [];
  const { listOfIps } = req.body;
  if (listOfIps && listOfIps.length > 0) {
    for (const ip of listOfIps) {
      if (ip && ip != "") {
        console.log(`Pinging IP : ${ip} `);
        healthResp.push(await ping(ip, "N/A"));
      }
    }
  }
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
});

const debugIpV2 = asyncHandler(async (req, res) => {
  let healthResp = [];
  const { listOfIps } = req.body;
  if (listOfIps && listOfIps.length > 0) {
    for (const ip of listOfIps) {
      if (ip && ip != "") {
        console.log(`Pinging IP : ${ip} `);
        healthResp.push(await ping(ip, "N/A"));
      }
    }
  }
  healthResp = await mapCronDetails(healthResp);
  return res.status(200).json({
    status: `SUCCESS`,
    healthInfo: healthResp,
  });
});

const loadProductDetails = asyncHandler(async (req, res) => {
  const mpId = req.params.id;
  let productDetails = new ProductModel();
  productDetails.mpId = mpId;
  let tradentDetails = await httpHelper.native_get(
    `http://159.203.57.169:3000/help/ProductDetails/${mpId}`,
  );
  let frontierDetails = await httpHelper.native_get(
    `http://142.93.159.114:3000/help/ProductDetails/${mpId}`,
  );
  let mvpDetails = await httpHelper.native_get(
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
});

const createCrons = asyncHandler(async (req, res) => {
  try {
    const countOfCrons = parseInt(req.params.count);
    const existingCronDetails = await mongoMiddleware.GetCronSettingsList();
    const generalCronDetails = _.filter(
      existingCronDetails,
      (x) => x.IsHidden != true,
    );
    const contextCron = _.first(generalCronDetails);
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
      await mongoMiddleware.InsertCronSettings(cron);
      newCronList.push({
        cronId: $id,
        cronVariable: `_E${generalCronDetails.length + count}Cron`,
      });
      console.log(`Inserted ${cron.CronName} with Id : ${cron.CronId}`);
    }

    // Write ResourceFile
    if (newCronList.length > 0) {
      const filePath = path.resolve(__dirname, "../resources/cronMapping.json");
      fs.writeFileSync(
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
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const alignExecutionPriority = asyncHandler(async (req, res) => {
  const productDetailsList = await mongoMiddleware.GetAllProductDetails();
  if (productDetailsList) {
    _.forEach(productDetailsList, (productDetails) => {
      if (
        productDetails.tradentDetails &&
        (!productDetails.tradentDetails.executionPriority ||
          productDetails.tradentDetails.executionPriority == null)
      ) {
        mongoMiddleware.UpdateExecutionPriority(productDetails.mpId, 0, 1);
      }
      if (
        productDetails.frontierDetails &&
        (!productDetails.frontierDetails.executionPriority ||
          productDetails.frontierDetails.executionPriority == null)
      ) {
        mongoMiddleware.UpdateExecutionPriority(productDetails.mpId, 1, 2);
      }
      if (
        productDetails.mvpDetails &&
        (!productDetails.mvpDetails.executionPriority ||
          productDetails.mvpDetails.executionPriority == null)
      ) {
        mongoMiddleware.UpdateExecutionPriority(productDetails.mpId, 2, 3);
      }
    });
  }
  return res.status(200).json({
    status: `SUCCESS`,
    product: `Done updation of Products ${productDetailsList.length}`,
  });
});

async function ping(hostname, port) {
  let check = null;
  let pingResponse = null;
  try {
    pingResponse = await execPing(hostname);
    check = await getCheck(pingResponse, hostname, port);
    if (check && check.ipStatus == "RED") {
      // Retry 1 time after 1 second after failure
      await delay(1000);
      pingResponse = await execPing(hostname);
      check = await getCheck(pingResponse, hostname, port);
    }
  } catch (err) {
    pingResponse = err;
  }
  return check;
}

async function mapCronDetails(healthResp) {
  const cronSettingsList = await mongoMiddleware.GetCronSettingsList();
  _.forEach(healthResp, (h) => {
    h.cronName = getCronName(h.ip, cronSettingsList);
  });
  return healthResp;
}

function getCronName(ip, list) {
  const relatedCron = list.find((cron) => cron.FixedIp == ip);
  return relatedCron && relatedCron.CronName ? relatedCron.CronName : "N/A";
}

async function execPing(hostname) {
  const controller = new AbortController();
  const { signal } = controller;
  const exec = util.promisify(child_process.exec, { signal });
  return await exec(`ping -c 3 ${hostname}`);
}

async function getCheck(pingResponse, hostname, port) {
  let check = { ip: hostname, port: port };
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

async function getVendorDetails(obj) {
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

const updateCronSecretKey = asyncHandler(async (req, res) => {
  let cronSettingsList = await mongoMiddleware.GetCronSettingsList();
  for (let $ of cronSettingsList) {
    if ($.CronName != "Cron-422") {
      $.SecretKey = await getSecretKeyDetails($.CronName);
    }
  }
  await mongoMiddleware.UpdateCronSettingsList(cronSettingsList, req);
  return res.status(200).json({
    status: `SUCCESS`,
    cronDetails: cronSettingsList,
  });
});

async function getSecretKeyDetails(cronName) {
  let secretDetails = [];
  const vendorName = ["TRADENT", "FRONTIER", "MVP", "FIRSTDENT", "TOPDENT"];
  for (const v of vendorName) {
    let vDetail = {};
    vDetail.vendorName = v;
    vDetail.secretKey = secretDetailsResx.find(
      (x) =>
        x.CronName.toUpperCase() == cronName.trim().toUpperCase() &&
        x.Vendor == v,
    ).SecretKey;
    secretDetails.push(vDetail);
  }
  return secretDetails;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
module.exports = {
  getLogsById,
  getProductDetails,
  doHealthCheck,
  doIpHealthCheck,
  pingCheck,
  troubleshoot,
  debugIp,
  debugIpV2,
  loadProductDetails,
  updateCronSecretKey,
  createCrons,
  alignExecutionPriority,
};
