import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import xml2js from "xml2js";
import { applicationConfig } from "../config";

const BRIGHT_DATA_TOKEN = "e02128b4-1c75-4a5b-aee9-a4a8058a5453";
const BRIGHT_DATA_ZONE = "unblocker1";

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

async function brightDataFetch(url: string): Promise<any> {
  const response = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIGHT_DATA_TOKEN}`,
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

export async function fetchData(url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  try {
    var startTime = process.hrtime();
    const result = await brightDataFetch(url);
    console.log(`SCRAPE : BrightData : ${url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`);
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

export async function fetchDataV2(_url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  try {
    var startTime = process.hrtime();
    const result = await brightDataFetch(_url);
    console.log(`SCRAPE : BrightData - Residential : ${_url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`);
    if (result) {
      if (applicationConfig.FORMAT_RESPONSE_CUSTOM) {
        return await getFormattedResponse(result);
      }
      response.data = result;
    }
  } catch (exception: any) {
    console.log(`BRIGHTDATA - Fetch Response Exception for ${_url} || ERROR : ${exception}`);
    await proxySwitchHelper.ExecuteCounter(parseInt(proxyDetails.proxyProvider));
  }
  return response;
}

export async function fetchDataForDebug(url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  try {
    var startTime = process.hrtime();
    const result = await brightDataFetch(url);
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
