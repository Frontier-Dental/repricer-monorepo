import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import xml2js from "xml2js";
import { applicationConfig } from "../config";

const BRIGHT_DATA_ZONE = "unblocker1";
const STATUS_CODE_OK = 200;
const STATUS_CODE_MULTIPLE_CHOICES = 300;
const STATUS_CODE_UNPROCESSABLE_ENTITY = 422;
const STATUS_CODE_INTERNAL_SERVER_ERROR = 500;

interface BrightDataError extends Error {
  response?: {
    statusCode: number;
  };
}

export async function fetchData(url: string, proxyDetails: any, retryCount = 0): Promise<any> {
  try {
    console.log(`SCRAPE STARTED : BrightData : ${url} || ${new Date()} || retry count : ${retryCount}`);

    const { responseContent, timeTaken } = await callBrightData(url, proxyDetails);
    return await handleResponse(responseContent, url, timeTaken, retryCount);
  } catch (error) {
    return handleRetry(error, retryCount, url, proxyDetails);
  }
}

async function callBrightData(url: string, proxyDetails: any): Promise<{ responseContent: any; timeTaken: string }> {
  const startTime = process.hrtime();
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

  const timeTaken = parseHrtimeToSeconds(process.hrtime(startTime));
  const data = await response.text();
  validateResponse(data, response.status);

  try {
    return { responseContent: JSON.parse(data), timeTaken };
  } catch {
    return { responseContent: data, timeTaken };
  }
}

function validateResponse(data: any, httpStatusCode: number): void {
  if (!data) {
    const error = new Error("BrightData response did not return any data") as BrightDataError;
    error.response = { statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR };
    throw error;
  }

  if (httpStatusCode !== STATUS_CODE_OK) {
    const error = new Error(`BrightData response returned status code ${httpStatusCode}: ${data}`) as BrightDataError;
    error.response = { statusCode: httpStatusCode };
    throw error;
  }
}

async function handleResponse(response: any, url: string, timeTaken: string, retryCount: number): Promise<any> {
  const formatResponse = applicationConfig.FORMAT_RESPONSE_CUSTOM;
  console.log(`SCRAPE COMPLETED : BrightData : ${url} || TimeTaken : ${timeTaken} seconds || retry count : ${retryCount}`);
  if (formatResponse) {
    return await getFormattedResponse(response);
  }

  return { data: response };
}

async function getFormattedResponse(response: string): Promise<any> {
  if (typeof response !== "string") {
    console.log(`BRIGHTDATA - Non-string response received: ${JSON.stringify(response)}`);
    return { data: [] };
  }
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

async function handleRetry(error: any, retryCount: number, url: string, proxyDetails: any): Promise<any> {
  console.log(`BrightData Exception : ${error} || URL : ${url}`);

  await proxySwitchHelper.ExecuteCounter(parseInt(proxyDetails.proxyProvider || "0"));
  const retryEligible = retryCondition(error);

  if (retryCount <= applicationConfig.NO_OF_RETRIES && retryEligible) {
    console.log(`REPRICER CORE | BRIGHTDATA | : ERROR (WITH RETRY) : ${error} `);

    console.log(`REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`, `REPRICER CORE | BRIGHTDATA`);

    await delay(applicationConfig.RETRY_INTERVAL);
    return await fetchData(url, proxyDetails, retryCount + 1);
  }

  return null;
}

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

function retryCondition(error: any): boolean {
  return (error.response?.statusCode >= STATUS_CODE_MULTIPLE_CHOICES && error.response?.statusCode !== STATUS_CODE_UNPROCESSABLE_ENTITY) || error.message === "Error: ESOCKETTIMEDOUT";
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchDataForDebug(url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  try {
    const { responseContent, timeTaken } = await callBrightData(url, proxyDetails);
    console.log(`SCRAPE : BrightData : ${url} || TimeTaken : ${timeTaken} seconds`);
    if (responseContent) {
      if (applicationConfig.FORMAT_RESPONSE_CUSTOM) {
        return await getFormattedResponse(responseContent);
      }
      response.data = responseContent;
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
