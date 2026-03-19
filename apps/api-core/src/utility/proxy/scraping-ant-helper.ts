import _ from "lodash";
import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import xml2js from "xml2js";
import fetch from "node-fetch";
import { applicationConfig } from "../config";
import logger from "../logger";

const STATUS_CODE_OK = 200;
const STATUS_CODE_MULTIPLE_CHOICES = 300;
const STATUS_CODE_UNPROCESSABLE_ENTITY = 422;
const STATUS_CODE_INTERNAL_SERVER_ERROR = 500;

interface ProxyDetailsResponse {
  hostUrl: string;
  userName: string;
  proxyProvider?: string;
}

interface ScrapingAntError extends Error {
  response?: {
    statusCode: number;
  };
}

export async function scrapingAntFetchData(url: string, proxyDetailsResponse: ProxyDetailsResponse, seqString: string | null, retryCount = 0): Promise<any> {
  try {
    // TESTING: Force error to test proxy switch functionality
    const testError: any = new Error("TESTING: Forced error for proxy switch testing");
    testError.response = { statusCode: 500 };
    throw testError;

    logger.info(`SCRAPE STARTED : ScrapingAnt : ${url} || ${seqString} || ${new Date()} || ${retryCount}`);

    const { responseContent, timeTaken } = await scrapingAntFetch(url, proxyDetailsResponse.userName);
    return await handleResponse(responseContent, url, seqString, timeTaken, retryCount);
  } catch (error) {
    return handleRetry(error, retryCount, url, proxyDetailsResponse, seqString);
  }
}

export async function scrapingAntFetch(urlToScrape: string, apiKey: string): Promise<{ responseContent: string; timeTaken: string }> {
  const encodedUri = encodeURIComponent(urlToScrape);
  const fetchUrl = `https://api.scrapingant.com/v2/general?url=${encodedUri}&x-api-key=${apiKey}&proxy_country=US&return_page_source=true`;
  const startTime = process.hrtime();
  const response = await fetch(fetchUrl, { method: "GET" });
  const timeTaken = parseHrtimeToSeconds(process.hrtime(startTime));

  if (response.status !== STATUS_CODE_OK) {
    const body = await response.text();
    const error = new Error(`ScrapingAnt returned status ${response.status}: ${body}`) as ScrapingAntError;
    error.response = { statusCode: response.status };
    throw error;
  }

  const responseContent = await response.text();
  if (!responseContent) {
    const error = new Error("ScrapingAnt response did not return any data") as ScrapingAntError;
    error.response = { statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR };
    throw error;
  }

  return { responseContent, timeTaken };
}

async function handleResponse(response: string, url: string, seqString: string | null, timeTaken: string, retryCount: number): Promise<any> {
  const formatResponse = applicationConfig.FORMAT_RESPONSE_CUSTOM;
  logger.info(`SCRAPE COMPLETED : ScrapingAnt : ${url} || TimeTaken  :  ${timeTaken} seconds || ${seqString} || retry count : ${retryCount}`);
  if (formatResponse) {
    return await getFormattedResponse(response);
  }

  return { data: JSON.parse(response) };
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

async function handleRetry(error: any, retryCount: number, url: string, proxyDetailsResponse: ProxyDetailsResponse, seqString: string | null): Promise<any> {
  logger.info(`ScrapingAnt Exception : ${error} || URL : ${url}`);

  await proxySwitchHelper.ExecuteCounter(parseInt(proxyDetailsResponse.proxyProvider || "0"));
  const retryEligible = await retryCondition(error);

  if (retryCount < applicationConfig.NO_OF_RETRIES && retryEligible) {
    logger.error(`REPRICER CORE | SCRAPINGANT | : ERROR (WITH RETRY) : ${error} `);

    logger.info(`REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`, `REPRICER CORE | SCRAPINGANT | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`);

    if (retryCount > 1) {
      await proxySwitchHelper.SwitchProxy();
    }

    await delay(applicationConfig.RETRY_INTERVAL);
    return await scrapingAntFetchData(url, proxyDetailsResponse, seqString, retryCount + 1);
  }

  return null;
}

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

async function retryCondition(error: any): Promise<boolean> {
  return (error.response?.statusCode >= STATUS_CODE_MULTIPLE_CHOICES && error.response?.statusCode !== STATUS_CODE_UNPROCESSABLE_ENTITY) || error.message === "Error: ESOCKETTIMEDOUT";
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
