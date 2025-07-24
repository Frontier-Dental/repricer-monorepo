import _ from "lodash";
import * as proxySwitchHelper from "../proxySwitchHelper";
import * as formatWrapper from "../format-wrapper";
import { logger } from "../winstonLogger";
import xml2js from "xml2js";
import fetch from "node-fetch";
import { applicationConfig } from "../config";

interface ProxyDetailsResponse {
  hostUrl: string;
  userName: string;
  proxyProvider?: string;
}

export async function fetchData(
  url: string,
  proxyDetailsResponse: ProxyDetailsResponse,
  seqString: string | null,
  renderJs: boolean,
  retryCount = 0,
): Promise<any> {
  try {
    const scrappingLog = renderJs
      ? "Scrapfly - JS Rendering"
      : "Scrapfly - Non JS Rendering";
    console.log(
      `SCRAPE STARTED : ${scrappingLog} : ${url} || ${seqString} || ${new Date()}`,
    );

    logger.info({
      module: "SCRAPE",
      message: `SCRAPE STARTED : ${scrappingLog} : ${url} || ${seqString} || render js : ${renderJs} `,
    });

    const { responseContent, timeTaken } = await scrape(
      url,
      proxyDetailsResponse.hostUrl,
      proxyDetailsResponse.userName,
      renderJs,
    );
    return await handleResponse(
      responseContent,
      scrappingLog,
      url,
      seqString,
      renderJs,
      timeTaken,
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

async function scrape(
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
  const responseContent = data.result.content;
  return { responseContent, timeTaken };
}

async function handleResponse(
  response: string,
  scrappingLog: string,
  url: string,
  seqString: string | null,
  renderJs: boolean,
  timeTaken: string,
): Promise<any> {
  const formatResponse = applicationConfig.FORMAT_RESPONSE_CUSTOM;
  console.log(
    `SCRAPE COMPLETED : ${scrappingLog} : ${url} || TimeTaken  :  ${timeTaken} seconds || ${seqString}`,
  );

  logger.info({
    module: "SCRAPE",
    message: `SCRAPE COMPLETED : ${scrappingLog} : ${url} ||  ${seqString} || render js : ${renderJs}`,
    timeTaken: `${timeTaken} seconds`,
  });

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

  logger.error({
    module: "SCRAPE",
    message: `Scrapfly Exception : ${error} || URL : ${url}`,
  });

  await proxySwitchHelper.ExecuteCounter(
    parseInt(proxyDetailsResponse.proxyProvider || "0"),
  );
  const retryEligible = await retryCondition(error);

  if (retryCount < applicationConfig.NO_OF_RETRIES && retryEligible) {
    console.log(`REPRICER CORE : ERROR (WITH RETRY) : ${error} `);
    console.log(
      `REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`,
    );

    logger.warn({
      module: "SCRAPE",
      message: `REPRICER CORE : ERROR (WITH RETRY) : ${error} `,
    });

    logger.warn({
      module: "SCRAPE",
      message: `REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`,
    });

    await delay(applicationConfig.RETRY_INTERVAL);
    return await fetchData(
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
    (error.response &&
      (error.response.statusCode == 503 ||
        error.response.statusCode == 500 ||
        error.response.statusCode == 429 ||
        error.response.statusCode == 408 ||
        error.response.statusCode == 400 ||
        error.response.statusCode == 401)) ||
    error.message == "Error: ESOCKETTIMEDOUT"
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
