import puppeteer from "puppeteer-core";
import requestPromise from "request-promise";
import * as proxySwitchHelper from "../proxy-switch-helper";

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

export async function fetchData(url: string, proxyDetails: any): Promise<any> {
  let response: any = {};
  const SBR_WS_ENDPOINT = `${proxyDetails.userName}:${proxyDetails.password}@${proxyDetails.hostUrl}:${proxyDetails.port}`;
  let browser: any;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: SBR_WS_ENDPOINT,
    });

    var startTime = process.hrtime();
    const page = await browser.newPage();
    // The following function runs in the browser context, so 'document' is valid there
    const contextJson = await page.evaluate(
      (/* intentionally shadow global */ document: any) => {
        return JSON.parse(document.querySelector("body").innerText);
      },
    );
    console.log(
      `SCRAPE : BrightData : ${url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`,
    );
    console.log({
      module: "SCRAPE",
      message: `BRIGHTDATA : ${url}`,
      timeTaken: `${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`,
    });
    if (contextJson) {
      response.data = contextJson;
    }
  } catch (exception: any) {
    console.log(
      `BRIGHTDATA - Fetch Response Exception for ${url} || ERROR : ${exception}`,
    );
    console.log({
      module: "SCRAPE",
      message: `BRIGHTDATA - Fetch Response Exception for ${url} || ERROR : ${exception}`,
    });
    await proxySwitchHelper.ExecuteCounter(
      parseInt(proxyDetails.proxyProvider),
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return response;
}

export async function fetchDataV2(
  _url: string,
  proxyDetails: any,
): Promise<any> {
  let response: any = {};
  const BD_ENDPOINT = `${proxyDetails.userName}:${proxyDetails.password}@${proxyDetails.hostUrl}:${proxyDetails.port}`;
  try {
    var startTime = process.hrtime();
    var brightDataResponse = await requestPromise({
      url: _url,
      proxy: BD_ENDPOINT,
      rejectUnauthorized: false,
    });
    console.log(
      `SCRAPE : BrightData - Residential : ${_url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`,
    );
    if (brightDataResponse) {
      // Optionally assign to response.data if needed
    }
  } catch (exception: any) {
    console.log(
      `BRIGHTDATA - Fetch Response Exception for ${_url} || ERROR : ${exception}`,
    );
    await proxySwitchHelper.ExecuteCounter(
      parseInt(proxyDetails.proxyProvider),
    );
  }
  return response;
}

export async function fetchDataForDebug(
  url: string,
  proxyDetails: any,
): Promise<any> {
  let response: any = {};
  const SBR_WS_ENDPOINT = `${proxyDetails.userName}:${proxyDetails.password}@${proxyDetails.hostUrl}:${proxyDetails.port}`;
  let browser: any;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: SBR_WS_ENDPOINT,
    });

    var startTime = process.hrtime();
    const page = await browser.newPage();
    // The following function runs in the browser context, so 'document' is valid there
    const contextJson = await page.evaluate(
      (/* intentionally shadow global */ document: any) => {
        return JSON.parse(document.querySelector("body").innerText);
      },
    );
    console.log(
      `SCRAPE : BrightData : ${url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`,
    );
    if (contextJson) {
      response.data = contextJson;
    }
  } catch (exception: any) {
    console.log(
      `BRIGHTDATA - Fetch Response Exception for ${url} || ERROR : ${exception}`,
    );
    response.data = {
      message: exception.error?.message,
      stack: exception.error?.stack,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return response;
}
