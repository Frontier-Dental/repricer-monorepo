import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import xml2js from "xml2js";
import { applicationConfig } from "../config";

const BRIGHT_DATA_ZONE = "unblocker1";

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

export async function fetchData(url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  try {
    var startTime = process.hrtime();
    const result = await callBrightData(url, proxyDetails);
    console.log(`SCRAPE : BrightData : ${url} || TimeTaken : ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`);
    if (result) {
      if (applicationConfig.FORMAT_RESPONSE_CUSTOM) {
        return await getFormattedResponse(result);
      }
      response.data = result;
    }
  } catch (exception: any) {
    console.log(`BRIGHTDATA - Fetch Response Exception for ${url} || ERROR : ${exception}`);
    await proxySwitchHelper.ExecuteCounter(parseInt(proxyDetails.proxyProvider));
  }
  return response;
}

async function callBrightData(url: string, proxyDetails: any): Promise<any> {
  const response = await fetch(proxyDetails.hostUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${proxyDetails.userName}`,
    },
    body: JSON.stringify({
      zone: BRIGHT_DATA_ZONE,
      url: url,
      format: "raw",
    }),
  });

  const data = await response.text();

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

async function getFormattedResponse(response: string): Promise<any> {
  if (response.indexOf("<List/>") >= 0) return { data: [] };
  let responseStartIndex = response.indexOf('<List xmlns="">');
  if (responseStartIndex < 0) responseStartIndex = response.indexOf("<List>");
  const responseEndIndex = response.indexOf("</List>");
  const responseString = `${response.substring(responseStartIndex, responseEndIndex)}</List>`;
  const formatOption = { mergeAttrs: true, explicitArray: false };
  const scrapeResponseData = await xml2js.parseStringPromise(responseString, formatOption);

  if (scrapeResponseData && scrapeResponseData["List"] && scrapeResponseData["List"]["item"]) {
    if (Array.isArray(scrapeResponseData["List"]["item"])) {
      return {
        data: formatWrapper.FormatScrapeResponse(scrapeResponseData["List"]["item"]),
      };
    } else {
      return {
        data: formatWrapper.FormatSingleScrapeResponse(scrapeResponseData["List"]["item"]),
      };
    }
  }
}

export async function fetchDataForDebug(url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  try {
    var startTime = process.hrtime();
    const result = await callBrightData(url, proxyDetails);
    console.log(`SCRAPE : BrightData : ${url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`);
    if (result) {
      if (applicationConfig.FORMAT_RESPONSE_CUSTOM) {
        return await getFormattedResponse(result);
      }
      response.data = result;
    }
  } catch (exception: any) {
    console.log(`BRIGHTDATA - Fetch Response Exception for ${url} || ERROR : ${exception}`);
    response.data = {
      message: exception.message,
      stack: exception.stack,
    };
  }
  return response;
}
