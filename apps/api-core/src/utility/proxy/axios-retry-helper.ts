import axios from "axios";
import axiosRetry from "axios-retry";
import _ from "lodash";
import requestPromise from "request-promise";
import xml2js from "xml2js";
import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import { applicationConfig } from "../config";

axiosRetry(axios, {
  retries: applicationConfig.NO_OF_RETRIES, // number of retries
  retryDelay: (retryCount: number) => {
    console.log(`retry attempt : ${retryCount} at ${new Date()}`);
    return retryCount * applicationConfig.RETRY_INTERVAL; // time interval between retries
  },
  retryCondition: (error: any) => {
    console.log(`REPRICER CORE : ERROR (WITH RETRY) : ${error} `);
    return (
      error.response.status == 503 ||
      error.response.status == 500 ||
      error.response.status == 429 ||
      error.response.status == 408
    );
  },
});

export async function getScrappingResponse(
  _url: string,
  proxyDetailsResponse: any,
  seqString: any,
  retryCount = 0,
): Promise<any> {
  try {
    const formatResponse = applicationConfig.FORMAT_RESPONSE_CUSTOM;
    console.log(
      `SCRAPE STARTED : SmartProxy - Web : ${_url} || ${seqString} || ${new Date()}`,
    );
    var startTime = process.hrtime();
    const response = await axios({
      method: "post",
      url: proxyDetailsResponse.hostUrl,
      data: {
        target: "universal",
        url: _url,
        locale: "en",
        geo: "United States",
        device_type: "desktop",
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/xml",
        Authorization: `Basic ${proxyDetailsResponse.userName}`,
      },
    });
    if (
      response &&
      response.status == 200 &&
      response.data &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      const taskId = _.first(response.data.results as any[])?.task_id;
      let responseData: any = {};
      const responseContentType = _.first(response.data.results as any[])
        ?.headers["content-type"];
      console.log(
        `SCRAPE STARTED : SmartProxy - Web : ContentType : ${responseContentType}`,
      );
      if (
        formatResponse &&
        formatResponse == true &&
        responseContentType != "application/json"
      ) {
        const options = { mergeAttrs: true, explicitArray: false };
        try {
          const scrapeResponseData = await xml2js.parseStringPromise(
            _.first(response.data.results as any[])?.content,
            options,
          );
          if (
            scrapeResponseData &&
            scrapeResponseData["List"] &&
            scrapeResponseData["List"]["item"] &&
            scrapeResponseData["List"]["item"].length > 0
          ) {
            responseData.data = await formatWrapper.FormatScrapeResponse(
              scrapeResponseData["List"]["item"],
            );
          } else {
            responseData.data = [];
          }
        } catch (ex) {
          console.debug(
            `IGNORE : SmartProxy - Web Exception : Error while parsing content : ${ex}`,
          );
          responseData.data = JSON.parse(
            _.first(response.data.results as any[])?.content,
          );
        }
      } else {
        responseData.data = JSON.parse(
          _.first(response.data.results as any[])?.content as any,
        );
      }
      console.log(
        `SCRAPE COMPLETED : SmartProxy - Web : ${_url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds || TaskId : ${taskId} || ${seqString}`,
      );

      return responseData;
    }
  } catch (error: any) {
    console.log(`SmartProxy - Web Exception : ${error} || URL : ${_url}`);
    console.error("Error Stack: ", error.stack);
    await proxySwitchHelper.ExecuteCounter(
      parseInt(proxyDetailsResponse.proxyProvider),
    );
    const retryEligible = await retryConditionForAxios(error);
    if (retryCount < applicationConfig.NO_OF_RETRIES && retryEligible == true) {
      console.log(`REPRICER CORE : ERROR (WITH RETRY) : ${error} `);
      console.log(
        `REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`,
      );
      await delay(applicationConfig.RETRY_INTERVAL);
      return await getScrappingResponse(
        _url,
        proxyDetailsResponse,
        seqString,
        retryCount + 1,
      );
    } else return null;
  }
}

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

export async function getScrapingBeeResponse(
  _url: string,
  proxyDetailsResponse: any,
  seqString: string | null | undefined,
  renderJs: boolean,
  retryCount = 0,
): Promise<any> {
  try {
    const formatResponse = applicationConfig.FORMAT_RESPONSE_CUSTOM;
    const scrappingLog =
      renderJs == false ? "ScrapingBee - NonJs" : "ScrapingBee - Js";
    console.log(
      `SCRAPE STARTED : ${scrappingLog} : ${_url} || ${seqString} || ${new Date()}`,
    );
    var startTime = process.hrtime();
    const options: any = {
      uri: "https://app.scrapingbee.com/api/v1/",
      qs: {
        api_key: proxyDetailsResponse.userName,
        url: _url,
        wait: applicationConfig.SCRAPINGBEE_WAIT_VALUE,
      },
      timeout: applicationConfig.SCRAPINGBEE_TIMEOUT_VALUE,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (renderJs == false) {
      options.qs["render_js"] = false;
    }
    const response = await requestPromise(options);
    if (response) {
      console.log(
        `SCRAPE COMPLETED : ${scrappingLog} : ${_url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds || ${seqString}`,
      );
      if (formatResponse && formatResponse == true) {
        let responseStartIndex = response.indexOf('<List xmlns="">');
        if (responseStartIndex < 0) {
          responseStartIndex = response.indexOf("<List>");
        }
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
          if (scrapeResponseData["List"]["item"].length > 0) {
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
      return { data: JSON.parse(response) };
    }
  } catch (error: any) {
    console.log(`Scraping Bee Exception : ${error} || URL : ${_url}`);
    await proxySwitchHelper.ExecuteCounter(
      parseInt(proxyDetailsResponse.proxyProvider),
    );
    const retryEligible = await retryCondition(error);
    if (retryCount < applicationConfig.NO_OF_RETRIES && retryEligible == true) {
      console.log(`REPRICER CORE : ERROR (WITH RETRY) : ${error} `);
      console.log(
        `REPRICER CORE | RETRY ATTEMPT : ${retryCount + 1} at ${new Date()}`,
      );
      await delay(applicationConfig.RETRY_INTERVAL);
      return await getScrapingBeeResponse(
        _url,
        proxyDetailsResponse,
        seqString,
        renderJs,
        retryCount + 1,
      );
    } else return null;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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
async function retryConditionForAxios(error: any): Promise<boolean> {
  return (
    error.response.status == 503 ||
    error.response.status == 500 ||
    error.response.status == 429 ||
    error.response.status == 408 ||
    error.response.status == 400 ||
    error.response.status == 401
  );
}
