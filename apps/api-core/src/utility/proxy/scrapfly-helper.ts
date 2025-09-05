import _ from "lodash";
import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import xml2js from "xml2js";
import fetch from "node-fetch";
import { applicationConfig } from "../config";

const STATUS_CODE_OK = 200;
const STATUS_CODE_MULTIPLE_CHOICES = 300;
const STATUS_CODE_UNPROCESSABLE_ENTITY = 422;
const STATUS_CODE_INTERNAL_SERVER_ERROR = 500;
interface ProxyDetailsResponse {
  hostUrl: string;
  userName: string;
  proxyProvider?: string;
}

interface ScrapflyError extends Error {
  response?: {
    statusCode: number;
  };
}

export async function scrapflyFetchData(
  url: string,
  proxyDetailsResponse: ProxyDetailsResponse,
  seqString: string | null,
  renderJs: boolean,
  retryCount = 0,
): Promise<any> {
  try {
    const scrapingLog = renderJs
      ? "Scrapfly - JS Rendering"
      : "Scrapfly - Non JS Rendering";
    console.log(
      `SCRAPE STARTED : ${scrapingLog} : ${url} || ${seqString} || ${new Date()} || ${retryCount}`,
    );

    const { responseContent, timeTaken } = await scrapflyFetch(
      url,
      proxyDetailsResponse.hostUrl,
      proxyDetailsResponse.userName,
      renderJs,
    );
    return await handleResponse(
      responseContent,
      scrapingLog,
      url,
      seqString,
      renderJs,
      timeTaken,
      retryCount,
    );
  } catch (error) {
    return handleRetry(
      error,
      retryCount,
      url,
      proxyDetailsResponse,
      seqString,
      renderJs,
    );
  }
}

export async function scrapflyFetch(
  urlToScrape: string,
  proxyHostUrl: string,
  apiKey: string,
  renderJs: boolean,
): Promise<{ responseContent: string; timeTaken: string }> {
  const options = { method: "GET" };
  const encodedUri = encodeURI(urlToScrape);
  const fetchUrl = `${proxyHostUrl}&render_js=${renderJs}&key=${apiKey}&url=${encodedUri}`;
  const startTime = process.hrtime();
  const response = await fetch(fetchUrl, options);
  const timeTaken = parseHrtimeToSeconds(process.hrtime(startTime));
  const data = await response.json();
  validateResponse(data, response.status);
  const responseContent = data.result.content;
  return { responseContent, timeTaken };
}

function validateResponse(data: any, httpStatusCode: number): void {
  if (!data) {
    const error = new Error(
      "Scrapfly response did not return any data",
    ) as ScrapflyError;
    error.response = { statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR };
    throw error;
  }

  if (httpStatusCode !== STATUS_CODE_OK) {
    const message = data?.result?.error?.message
      ? data.result.error.message
      : `${JSON.stringify(data)}`;
    const error = new Error(message) as ScrapflyError;
    error.response = { statusCode: httpStatusCode };
    throw error;
  }

  if (!data.result || !data.result.content) {
    const error = new Error(
      "Scrapfly response did not return the result.content parameter",
    ) as ScrapflyError;
    error.response = { statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR };
    throw error;
  }
}

async function handleResponse(
  response: string,
  scrapingLog: string,
  url: string,
  seqString: string | null,
  renderJs: boolean,
  timeTaken: string,
  retryCount: number,
): Promise<any> {
  const formatResponse = applicationConfig.FORMAT_RESPONSE_CUSTOM;
  console.log(
    `SCRAPE COMPLETED : ${scrapingLog} : ${url} || TimeTaken  :  ${timeTaken} seconds || ${seqString} || retry count : ${retryCount}`,
  );
  if (formatResponse) {
    return await getFormattedResponse(response);
  }

  return { data: JSON.parse(response) };
}

async function getFormattedResponse(response: string): Promise<any> {
  let responseStartIndex = response.indexOf('<List xmlns="">');
  if (responseStartIndex < 0) responseStartIndex = response.indexOf("<List>");
  const responseEndIndex = response.indexOf("</List>");
  const responseString = `${response.substring(responseStartIndex, responseEndIndex)}</List>`;
  const formatOption = { mergeAttrs: true, explicitArray: false };
  const scrapeResponseData = await xml2js.parseStringPromise(
    responseString,
    formatOption,
  );

  if (
    scrapeResponseData &&
    scrapeResponseData["List"] &&
    scrapeResponseData["List"]["item"]
  ) {
    if (Array.isArray(scrapeResponseData["List"]["item"])) {
      return {
        data: formatWrapper.FormatScrapeResponse(
          scrapeResponseData["List"]["item"],
        ),
      };
    } else {
      return {
        data: formatWrapper.FormatSingleScrapeResponse(
          scrapeResponseData["List"]["item"],
        ),
      };
    }
  }
}

async function handleRetry(
  error: any,
  retryCount: number,
  url: string,
  proxyDetailsResponse: ProxyDetailsResponse,
  seqString: string | null,
  renderJs: boolean,
): Promise<any> {
  console.log(`Scrapfly Exception : ${error} || URL : ${url}`);

  await proxySwitchHelper.ExecuteCounter(
    parseInt(proxyDetailsResponse.proxyProvider || "0"),
  );
  const retryEligible = await retryCondition(error);

  if (retryCount < applicationConfig.NO_OF_RETRIES && retryEligible) {
    console.log(`REPRICER CORE | SCRAPFLY | : ERROR (WITH RETRY) : ${error} `);

    console.log(
      `REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`,
      `REPRICER CORE | SCRAPFLY | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`,
    );

    if (retryCount > 1) {
      await proxySwitchHelper.SwitchProxy();
    }

    await delay(applicationConfig.RETRY_INTERVAL);
    return await scrapflyFetchData(
      url,
      proxyDetailsResponse,
      seqString,
      renderJs,
      retryCount + 1,
    );
  }

  return null;
}

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

async function retryCondition(error: any): Promise<boolean> {
  return (
    (error.response?.statusCode >= STATUS_CODE_MULTIPLE_CHOICES &&
      error.response?.statusCode !== STATUS_CODE_UNPROCESSABLE_ENTITY) ||
    error.message === "Error: ESOCKETTIMEDOUT"
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
