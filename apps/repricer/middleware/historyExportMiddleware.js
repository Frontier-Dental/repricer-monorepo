const _ = require("lodash");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const excelJs = require("exceljs");
const moment = require("moment");
const fs = require("fs");
const { lstatSync, readdirSync } = require("fs");
const ExportModel = require("../models/exportModel");
var path = require("path");
const httpMiddleware = require("../middleware/httpMiddleware");

module.exports.FindAllDownloads = async () => {
  try {
    return await fs
      .readdirSync("./exports", { withFileTypes: true })
      .filter((item) => !item.isDirectory())
      .map((item) => {
        return {
          name: item.name,
          createdDate: fs.statSync(`./exports/${item.name}`).mtime.getTime(),
        };
      });
  } catch (ex) {
    console.log(`Exception : While FindAllDownloads with Error : ${ex}`);
  }
};

module.exports.ExportAndSaveById = async (
  mpid,
  startDate,
  endDate,
  historyFileName,
  auditInfo,
) => {
  //Prepare Folder History Path
  const rootDirectory = process.cwd();
  //console.log(`rootDirectory || ${rootDirectory}`);
  const rootPath = rootDirectory.substring(
    0,
    rootDirectory.lastIndexOf(process.env.FILE_DELIMITER),
  );
  const historyBasePath = path.join(rootPath, process.env.HISTORY_BASE_PATH);
  const contextDirectory = path.join(historyBasePath, `/${mpid}/`);
  let contextSubFolders = [];
  console.log(
    `ExportAndSaveById for ${mpid} | ContextPath : ${contextDirectory} `,
  );
  //Get Context Folders based on Date Time Range
  if (isDirectory(contextDirectory) == true) {
    const listOfSubDirectories = getDirectories(contextDirectory);
    if (listOfSubDirectories.length > 0) {
      for (const dir of listOfSubDirectories) {
        const dateFieldStr = dir.substring(
          dir.lastIndexOf(process.env.FILE_DELIMITER) + 1,
          dir.length,
        );
        const dateField = new Date(dateFieldStr).setHours(0, 0, 0, 0);
        if (dateField >= startDate && dateField <= endDate) {
          contextSubFolders.push(dir);
        }
      }
    }
  }
  //Read through all sub-folder and go to them whose value falls between start and end date
  if (contextSubFolders.length > 0) {
    for (const idx in contextSubFolders) {
      //console.log(`Reading files for ${mpid} | Directory : ${contextSubFolders[idx]}`);
      let historyResponse = [];
      const allFiles = getAllFileNames(contextSubFolders[parseInt(idx)]);
      if (allFiles.length > 0) {
        _.forEach(allFiles, ($) => {
          const jsonFilePath = path.join(contextSubFolders[parseInt(idx)], $);
          //console.log(`Reading file ${$} | Path : ${jsonFilePath}`);
          const fileData = fs.readFileSync(jsonFilePath, "utf8");
          historyResponse = historyResponse.concat(
            flattenObject(JSON.parse(fileData), mpid, historyResponse),
          );
        });
      }
      if (historyResponse.length > 0) {
        parseInt(idx) == 0
          ? await createExcel(historyResponse, historyFileName, 1)
          : await upsertExcel(
              historyResponse,
              historyFileName,
              parseInt(idx) + 1,
            );
      }
    }
  } else {
    //create blank Excel
    await createExcel([], historyFileName, 1);
  }
  const finalPayload = new ExportModel(
    "COMPLETE",
    historyFileName,
    new Date(),
    new Date(),
    auditInfo.UpdatedBy,
  );
  await mongoMiddleware.UpdateExportStatusV2(finalPayload);
};

module.exports.ExportAndSave = async (
  startDate,
  endDate,
  historyFileName,
  auditInfo,
) => {
  const rootDirectory = process.cwd();
  //console.log(`rootDirectory || ${rootDirectory}`);
  const rootPath = rootDirectory.substring(
    0,
    rootDirectory.lastIndexOf(process.env.FILE_DELIMITER),
  );
  const historyBasePath = path.join(rootPath, process.env.HISTORY_BASE_PATH);
  const listOfSubDirectories = getDirectories(historyBasePath);
  const noOfDaysToRecord =
    getMomentDate(new Date(endDate)).diff(
      getMomentDate(new Date(startDate)),
      "days",
    ) + 1;
  console.log(
    `ExportAndSave for StartDate : ${new Date(startDate)} | EndDate : ${new Date(endDate)} | ContextPath : ${historyBasePath} `,
  );
  let datesToConsider = [];
  for (let count = 1; count <= noOfDaysToRecord; count++) {
    const contextDate = getNextDate(new Date(startDate), count);
    datesToConsider.push(moment(contextDate).format("YYYY-MM-DD"));
  }
  console.log(`Dates to Consider for History : ${datesToConsider.join(" |")}`);
  if (listOfSubDirectories.length > 0 && datesToConsider.length > 0) {
    await createExcel([], historyFileName, 1);
    await SaveAllHistoryByDate(
      datesToConsider,
      listOfSubDirectories,
      historyFileName,
    );
  } else {
    //create blank Excel
    await createExcel([], historyFileName, 1);
  }
  const finalPayload = new ExportModel(
    "COMPLETE",
    historyFileName,
    new Date(),
    new Date(),
    auditInfo.UpdatedBy,
  );
  await mongoMiddleware.UpdateExportStatusV2(finalPayload);
  console.log(
    `Completed ExportAndSave for Date ${new Date(startDate)} | ${new Date(endDate)} | ContextPath : ${historyBasePath} `,
  );
};

module.exports.ExportAndSaveByIdV2 = async (
  mpid,
  startDate,
  endDate,
  historyFileName,
  auditInfo,
) => {
  //Prepare History Export Url & payload
  const historyExportUrl = process.env.HISTORY_EXPORT_URL_BY_ID.replace(
    "{productId}",
    parseInt(mpid),
  );
  const requestPayload = {
    startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
    endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
    fileName: historyFileName,
  };
  httpMiddleware.native_post(historyExportUrl, requestPayload);
};

module.exports.ExportAndSaveV2 = async (
  startDate,
  endDate,
  historyFileName,
  auditInfo,
) => {
  const historyExportUrl = process.env.HISTORY_EXPORT_URL_FOR_ALL;
  const requestPayload = {
    startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
    endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
    fileName: historyFileName,
  };
  httpMiddleware.native_post(historyExportUrl, requestPayload);
  console.log(
    `Called ExportAndSave For All for Date ${new Date(startDate)} | ${new Date(endDate)} | ContextPath : ${historyFileName} `,
  );
};

function flattenObject(history, mpid) {
  let result = [];
  try {
    if (
      history &&
      history.historicalPrice &&
      history.historicalPrice.length > 0
    ) {
      for (let p of history.historicalPrice) {
        //let flat = _.cloneDeep(p);
        p.mpId = mpid;
        p.refTime = moment(history.refTime).format("DD-MM-YYYY HH:mm:ss");
        p.api_response = p.apiResponse ? JSON.stringify(p.apiResponse) : "N/A";
        p.apiResponse = null;
        result.push(p);
      }
    }
  } catch (exception) {
    console.log(
      `Exception in flattenObject for ${mpid} || Error : ${exception}`,
    );
  }
  return result;
}
async function createExcel(excelOutput, historyFileName, idx) {
  try {
    const workbook = new excelJs.Workbook();
    const worksheet = workbook.addWorksheet(`HistoryList-${idx}`);
    worksheet.columns = [
      { header: "Vendor Name", key: "vendorName", width: 20 },
      { header: "MPID", key: "mpId", width: 20 },
      { header: "ScrapeTime", key: "refTime", width: 20 },
      { header: "Existing Price", key: "existingPrice", width: 20 },
      { header: "Min Quantity", key: "minQty", width: 20 },
      { header: "Rank as per Response", key: "rank", width: 20 },
      { header: "Lowest Vendor Name", key: "lowestVendor", width: 20 },
      { header: "Lowest Vendor Price", key: "lowestPrice", width: 20 },
      { header: "Max Vendor Name", key: "maxVendor", width: 20 },
      { header: "Max Vendor Price", key: "maxVendorPrice", width: 20 },
      { header: "Suggested Price", key: "suggestedPrice", width: 20 },
      { header: "Comment", key: "repriceComment", width: 20 },
      { header: "Other Vendors", key: "otherVendorList", width: 100 },
      { header: "Net32 API Response", key: "api_response", width: 100 },
    ];
    worksheet.addRows(excelOutput);
    await workbook.xlsx.writeFile(`./exports/${historyFileName}`);
  } catch (exception) {
    console.log(`Exception : While createExcel with Error : ${exception} `);
  }
}
async function upsertExcel(excelOutput, historyFileName, idx) {
  try {
    const workbook = new excelJs.Workbook();
    await workbook.xlsx.readFile(`./exports/${historyFileName}`);
    const worksheet = workbook.addWorksheet(`HistoryList-${idx}`);
    worksheet.columns = [
      { header: "Vendor Name", key: "vendorName", width: 20 },
      { header: "MPID", key: "mpId", width: 20 },
      { header: "ScrapeTime", key: "refTime", width: 20 },
      { header: "Existing Price", key: "existingPrice", width: 20 },
      { header: "Min Quantity", key: "minQty", width: 20 },
      { header: "Rank as per Response", key: "rank", width: 20 },
      { header: "Lowest Vendor Name", key: "lowestVendor", width: 20 },
      { header: "Lowest Vendor Price", key: "lowestPrice", width: 20 },
      { header: "Max Vendor Name", key: "maxVendor", width: 20 },
      { header: "Max Vendor Price", key: "maxVendorPrice", width: 20 },
      { header: "Suggested Price", key: "suggestedPrice", width: 20 },
      { header: "Comment", key: "repriceComment", width: 20 },
      { header: "Other Vendors", key: "otherVendorList", width: 100 },
      { header: "Net32 API Response", key: "api_response", width: 100 },
    ];
    worksheet.addRows(excelOutput);
    await workbook.xlsx.writeFile(`./exports/${historyFileName}`);
  } catch (exception) {
    console.log(`Exception : While createExcel with Error : ${exception} `);
  }
}
const isDirectory = (source) => {
  try {
    return lstatSync(source).isDirectory();
  } catch (exception) {
    //console.log(`${source} is not available`);
    return false;
  }
};
const getDirectories = (source) =>
  readdirSync(source)
    .map((name) => path.join(source, name))
    .filter(isDirectory);

const getAllFileNames = (source) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((item) => !item.isDirectory())
    .map((item) => item.name);
const getMomentDate = (date) =>
  moment([date.getFullYear(), date.getMonth(), date.getDate()]);
const getNextDate = (date, noOfDays) => date.setDate(date.getDate() + noOfDays);

async function SaveAllHistoryByDate(
  datesToConsider,
  listOfSubDirectories,
  historyFileName,
) {
  const chunkOfData = _.chunk(
    listOfSubDirectories,
    parseInt(process.env.HISTORY_LIMIT),
  );
  for (const chunk of chunkOfData) {
    let listOfRecords = [];
    for (const dir of chunk) {
      for (const folderDateToLook of datesToConsider) {
        console.log(
          `Getting History for Date : ${folderDateToLook} | DIR : ${dir}`,
        );
        const folderPath = path.join(dir, folderDateToLook);
        if (isDirectory(folderPath)) {
          const allFiles = getAllFileNames(folderPath);
          const mpid = dir.substr(
            dir.lastIndexOf(process.env.FILE_DELIMITER) + 1,
            dir.length,
          );
          console.log(`Found ${allFiles.length} history for MPID : ${mpid}`);
          if (allFiles.length > 0) {
            _.forEach(allFiles, ($) => {
              const jsonFilePath = path.join(folderPath, $);
              const fileData = fs.readFileSync(jsonFilePath, "utf8");
              listOfRecords = listOfRecords.concat(
                flattenObject(JSON.parse(fileData), mpid, listOfRecords),
              );
            });
          }
        }
      }
    }
    await appendRecords(listOfRecords, historyFileName, 1);
    listOfRecords = null;
    await delay(10000); // wait for 5sec for next run to allow memory release
  }
}

async function appendRecords(listOfRecords, historyFileName, folderDateToLook) {
  let workbook = new excelJs.Workbook();
  const workSheetName = `HistoryList-${folderDateToLook}`;
  await workbook.xlsx.readFile(`./exports/${historyFileName}`);
  let worksheet = workbook.getWorksheet(workSheetName);
  let lastRow = worksheet.lastRow;
  console.log(
    `Appending ${listOfRecords.length} history rows to sheet : ${workSheetName}`,
  );
  for (let count = 1; count <= listOfRecords.length; count++) {
    let getRowInsert = worksheet.getRow(lastRow.number + count);
    getRowInsert.getCell("A").value = listOfRecords[count - 1].vendorName;
    getRowInsert.getCell("B").value = listOfRecords[count - 1].mpId;
    getRowInsert.getCell("C").value = listOfRecords[count - 1].refTime;
    getRowInsert.getCell("D").value = listOfRecords[count - 1].existingPrice;
    getRowInsert.getCell("E").value = listOfRecords[count - 1].minQty;
    getRowInsert.getCell("F").value = listOfRecords[count - 1].rank;
    getRowInsert.getCell("G").value = listOfRecords[count - 1].lowestVendor;
    getRowInsert.getCell("H").value = listOfRecords[count - 1].lowestPrice;
    getRowInsert.getCell("I").value = listOfRecords[count - 1].maxVendor;
    getRowInsert.getCell("J").value = listOfRecords[count - 1].maxVendorPrice;
    getRowInsert.getCell("K").value = listOfRecords[count - 1].suggestedPrice;
    getRowInsert.getCell("L").value = listOfRecords[count - 1].repriceComment;
    getRowInsert.getCell("M").value = listOfRecords[count - 1].otherVendorList;
    getRowInsert.getCell("N").value = listOfRecords[count - 1].api_response;
    getRowInsert.commit();
  }
  console.log(
    `Completed appending ${listOfRecords.length} history rows to sheet : ${workSheetName}`,
  );
  await workbook.xlsx.writeFile(`./exports/${historyFileName}`);
  workbook = null;
  listOfRecords = null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
