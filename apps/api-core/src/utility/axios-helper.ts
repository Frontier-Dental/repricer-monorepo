import axios from "axios";
import fs from "fs";
import httpsProxyAgent from "https-proxy-agent";
import _ from "lodash";
import nodeFetch from "node-fetch";
import { apiMapping } from "../resources/api-mapping";
import { CronSettings } from "../types/cron-settings";
import { applicationConfig } from "./config";
import * as axiosRetryHelper from "./proxy/axios-retry-helper";
import * as brightDataHelper from "./proxy/bright-data-helper";
import * as scrapflyHelper from "./proxy/scrapfly-helper";
import * as ProxyHelper from "./proxy-helper";
import * as responseUtility from "./response-utility";
import * as sqlV2Service from "../utility/mysql/mysql-v2";

export async function postAsync(payload: any, _url: string) {
  const config = {
    method: "POST",
    url: _url,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
    },
    data: JSON.stringify(payload),
  };
  return axios(config);
}

export async function getAsync(_url: string, cronId: any, mpid: string, seqString?: string | null) {
  let responseData = null;
  let cronDetails = await sqlV2Service.GetCronSettingsList();
  const slowCronDetails = await sqlV2Service.GetSlowCronDetails();
  cronDetails = _.concat(cronDetails, slowCronDetails);
  const cronName = cronDetails.find((x: any) => x.CronId == cronId)?.CronName;
  if (applicationConfig.IS_DEBUG) {
    return getMorphedResponse();
  }
  const proxyDetailsResponse = await ProxyHelper.GetProxyDetailsById(cronId);
  let proxyProvider = _.first(proxyDetailsResponse)?.ProxyProvider;
  const proxyConfigDetails = await sqlV2Service.GetProxyConfigByProviderId(proxyProvider);

  switch (proxyProvider) {
    case 0:
      responseData = await axiosRetryHelper.getScrapingBeeResponse(_url, _.first(proxyConfigDetails), seqString, false);
      break;
    case 2:
      responseData = await brightDataHelper.fetchData(_url, _.first(proxyConfigDetails));
      break;
    case 3:
      responseData = await axiosRetryHelper.getScrappingResponse(_url, _.first(proxyConfigDetails), seqString);
      break;
    case 5:
      responseData = await axiosRetryHelper.getScrapingBeeResponse(_url, _.first(proxyConfigDetails), seqString, true);
      break;
    case 8:
      responseData = await scrapflyHelper.scrapflyFetchData(_url, _.first(proxyConfigDetails) as any, null, true);
      break;
    case 9:
      responseData = await scrapflyHelper.scrapflyFetchData(_url, _.first(proxyConfigDetails) as any, null, false);
      break;
    default:
      const proxy = await ProxyHelper.GetProxy(cronName!);
      if (proxy?.host == (await sqlV2Service.GetRotatingProxyUrl())) {
        responseData = await fetchGetAsync(proxy, _url);
      } else {
        var startTime = process.hrtime();
        responseData = await axios.get(_url, proxy);
        console.log(`SCRAPE : ${(_.first(proxyConfigDetails) as any).proxyProviderName} : ${_url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds || ${seqString}`);
      }
      break;
  }

  //update qbreak details
  await sqlV2Service.UpdateQBreakDetails(mpid, responseData.data);
  //update badge details product level
  sqlV2Service.UpdateProductLevelBadgeDetails(mpid, responseData.data);
  return responseData;
}

export async function getAsyncProxy(_url: string, cronSetting: CronSettings, mpid: string) {
  let responseData = null;
  const cronName = cronSetting.CronName;

  let proxyProvider = cronSetting.ProxyProvider == 11 || cronSetting.ProxyProvider == 12 ? 1 : cronSetting.ProxyProvider;
  if (proxyProvider != null) {
    const proxyConfigDetails = await sqlV2Service.GetProxyConfigByProviderId(proxyProvider);
    switch (proxyProvider) {
      case 0:
        responseData = await axiosRetryHelper.getScrapingBeeResponse(_url, _.first(proxyConfigDetails), null, false);
        break;
      case 2:
        responseData = await brightDataHelper.fetchData(_url, _.first(proxyConfigDetails));
        break;
      case 3:
        responseData = await axiosRetryHelper.getScrappingResponse(_url, _.first(proxyConfigDetails), null);
        break;
      case 5:
        responseData = await axiosRetryHelper.getScrapingBeeResponse(_url, _.first(proxyConfigDetails), null, true);
        break;
      case 8:
        responseData = await scrapflyHelper.scrapflyFetchData(_url, _.first(proxyConfigDetails) as any, null, true);
        break;
      case 9:
        responseData = await scrapflyHelper.scrapflyFetchData(_url, _.first(proxyConfigDetails) as any, null, false);
        break;
      default:
        const proxy = await ProxyHelper.GetProxyV2(cronSetting, proxyProvider);
        if (proxy.host == (await sqlV2Service.GetRotatingProxyUrl())) {
          responseData = await fetchGetAsync(proxy, _url);
        } else {
          var startTime = process.hrtime();
          responseData = await axios.get(_url, proxy);
          console.log(`SCRAPE : ${(_.first(proxyConfigDetails) as any).proxyProviderName} : ${_url} || TimeTaken  :  ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds `);
        }
        break;
    }
  }

  //update badge details product level
  sqlV2Service.UpdateProductLevelBadgeDetails(mpid, responseData.data);

  return responseData;
}

export async function GetSisterVendorItemDetails(mpid: any, globalParamInfo: any): Promise<any[]> {
  let itemDetails: any[] = [];
  const requiredApiList = _.remove(apiMapping, ($: any) => {
    return $.vendorId != globalParamInfo.VENDOR_ID;
  });
  if (requiredApiList && requiredApiList.length > 0) {
    for (const api of requiredApiList) {
      const formattedUrl = api.apiUrl.replace("{mpid}", mpid);
      const productDetailsResponse = await native_get(formattedUrl);
      if (productDetailsResponse && productDetailsResponse.data && productDetailsResponse.data.message && productDetailsResponse.data.message.length > 0) {
        let respDetails: any = {};
        respDetails.vendorId = api.vendorId;
        respDetails.mpid = mpid;
        respDetails.unitPrice = await responseUtility.GetLastExistingPrice(_.first(productDetailsResponse.data.message));
        itemDetails.push(respDetails);
      }
    }
  }
  return itemDetails;
}

export async function runFeedCron(): Promise<void> {
  const config = {
    method: "get",
    url: applicationConfig.CRON_RUN_FEED_URL,
  };
  await axios(config);
}

export async function getProduct(_url: string): Promise<any> {
  var config = {
    method: "get",
    url: _url,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
    },
  };
  return axios(config);
}

export async function runProductCron(): Promise<any> {
  var config = {
    method: "get",
    url: applicationConfig.CRON_RUN_PRODUCT_URL,
  };
  return axios(config);
}

export async function asyncProductData(_url: string): Promise<any> {
  var config = {
    method: "get",
    url: _url,
  };
  return axios(config);
}

export async function native_get(_url: string): Promise<any> {
  const config = {
    method: "get",
    url: _url,
  };
  return axios(config);
}

export async function fetch_product_data(_url: string): Promise<any> {
  const proxyConfigDetails = await sqlV2Service.GetProxyConfigByProviderId(3);
  return getScrappingResponse(_url, _.first(proxyConfigDetails));
}

export async function fetchGetAsync(proxy: any, _url: string): Promise<any> {
  let responseData: any = {};
  responseData.data = [];
  const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
  const proxyAgent = httpsProxyAgent(proxyUrl);
  if (proxy.dummyMethod == "AXIOS") {
    return await axios.get(_url, { proxyAgent } as any);
  } else {
    const response = await nodeFetch(_url, { agent: proxyAgent as any });
    responseData.data = await response.json();
  }
  return responseData;
}

function getMorphedResponse(): Promise<any> {
  let response: any = {};
  const filePath = applicationConfig.FILE_PATH;
  if (filePath) {
    const fileResponse = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(fileResponse);
    response.data = jsonData;
  }
  return response;
}

async function getScrappingResponse(_url: string, proxyDetailsResponse: any): Promise<any> {
  console.log(`Calling SmartProxy - Web : ${_url}`);
  const response = await axios({
    method: "post",
    url: proxyDetailsResponse.hostUrl,
    data: {
      target: "universal",
      url: _url,
      locale: "en",
      geo: "United States",
      device_type: "desktop",
      headless: "html",
    },
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${proxyDetailsResponse.userName}`,
    },
  });
  if (response && response.status == 200 && response.data && response.data.results && response.data.results.length > 0) {
    let responseData: any = {};
    responseData.data = JSON.parse(_.first(response.data.results as any[])?.content as any);
    return responseData;
  }
}

function parseHrtimeToSeconds(hrtime: [number, number]): string {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}

export async function fetchGetAsyncV2(proxy: any, _url: string): Promise<any> {
  let responseData: any = {};
  responseData.data = [];
  const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
  const proxyAgent = httpsProxyAgent(proxyUrl);
  if (proxy.dummyMethod == "AXIOS") {
    return await axios.get(_url, { proxyAgent } as any);
  } else {
    const response = await nodeFetch(_url, { agent: proxyAgent as any });
    responseData.data = await response.json();
  }
  return responseData;
}

export async function getProductsFromMiniErp(_url: string, accessToken: string, queryData: { page: number; pageSize: number }): Promise<any> {
  const { page, pageSize } = queryData;

  const graphqlQuery = `
  query getUpdatedProductsWithOffsetPagination($hoursSinceUpdate: Int, $page: Int, $pageSize: Int) {
    getUpdatedProductsWithOffsetPagination(hoursSinceUpdate: $hoursSinceUpdate, page: $page, pageSize: $pageSize) {
      items {
        mpid,
        vendorName,
        quantityAvailable
      }
      hasMore
    }
  }
`;

  const config = {
    method: "post",
    url: _url,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      query: graphqlQuery,
      variables: {
        hoursSinceUpdate: applicationConfig.MINI_ERP_DATA_HOURS_SINCE_UPDATE,
        page: page,
        pageSize: pageSize,
      },
    },
  };
  return axios(config);
}
