import axios from "axios";
import _ from "lodash";
import requestPromise from "request-promise";
import * as brightDataHelper from "./proxy/brightData-helper";
import * as proxyHelper from "../utility/proxyHelper";
import * as axiosHelper from "../utility/axiosHelper";
import xml2js from "xml2js";
import * as formatWrapper from "../utility/format-wrapper";

export async function GetData(
  _url: string,
  proxyProviderDetails: any,
  proxyParam: number,
): Promise<any> {
  let output = null;
  let inputRequest = null;
  switch (proxyParam) {
    case 0:
      const options = {
        uri: "https://app.scrapingbee.com/api/v1/",
        qs: {
          api_key: proxyProviderDetails.userName,
          url: _url,
          wait: process.env.SCRAPINGBEE_WAIT_VALUE,
          render_js: "false",
        },
        timeout: parseInt(process.env.SCRAPINGBEE_TIMEOUT_VALUE!),
      };
      inputRequest = options;
      const response = await requestPromise(options);
      try {
        output = { data: JSON.parse(response), request: inputRequest };
      } catch (ex) {
        let responseStartIndex = response.indexOf('<List xmlns=\"\">');
        if (responseStartIndex < 0) {
          responseStartIndex = response.indexOf("<List>");
        }
        const responseEndIndex = response.indexOf("</List>");
        const responseString = `${response.substring(responseStartIndex, responseEndIndex)}</List>`;
        output = {
          data: await convertFromXml(responseString),
          request: inputRequest,
        };
      }
      break;
    case 2:
      inputRequest = {
        requestData: `Custom Puppeteer Framework Based Input Request`,
        url: _url,
      };
      output = await brightDataHelper.fetchDataForDebug(
        _url,
        proxyProviderDetails,
      );
      output["request"] = inputRequest;
      break;
    case 3:
      const config = {
        method: "post",
        url: proxyProviderDetails.hostUrl,
        data: {
          target: "universal",
          url: _url,
          locale: "en",
          geo: "United States",
          device_type: "desktop",
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${proxyProviderDetails.userName}`,
        },
      };
      inputRequest = config;
      const smartProxyResponse = await axios(config);
      if (
        smartProxyResponse &&
        smartProxyResponse.status == 200 &&
        smartProxyResponse.data &&
        smartProxyResponse.data.results &&
        smartProxyResponse.data.results.length > 0
      ) {
        try {
          output = {
            data: JSON.parse(
              _.first(smartProxyResponse.data.results as any[])?.content as any,
            ),
            request: inputRequest,
          };
        } catch (ex) {
          output = {
            data: await convertFromXml(
              _.first(smartProxyResponse.data.results as any[])?.content as any,
            ),
            request: inputRequest,
          };
        }
      } else {
        output = { data: smartProxyResponse, request: inputRequest };
      }
      break;
    case 99:
      inputRequest = _url;
      const nativeResponse = await axios.get(_url);
      output = { data: nativeResponse.data, request: inputRequest };
      break;
    case 5:
      const tempOptions = {
        uri: "https://app.scrapingbee.com/api/v1/",
        qs: {
          api_key: proxyProviderDetails.userName,
          url: _url,
          wait: process.env.SCRAPINGBEE_WAIT_VALUE,
        },
        timeout: parseInt(process.env.SCRAPINGBEE_TIMEOUT_VALUE!),
      };
      inputRequest = tempOptions;
      const resultResponse = await requestPromise(tempOptions);
      try {
        output = { data: JSON.parse(resultResponse), request: inputRequest };
      } catch (ex) {
        let responseStartIndex = resultResponse.indexOf('<List xmlns=\"\">');
        if (responseStartIndex < 0) {
          responseStartIndex = resultResponse.indexOf("<List>");
        }
        const responseEndIndex = resultResponse.indexOf("</List>");
        const responseString = `${resultResponse.substring(responseStartIndex, responseEndIndex)}</List>`;
        output = {
          data: await convertFromXml(responseString),
          request: inputRequest,
        };
      }
      break;
    case 11:
    case 12:
      const proxyDetails = await proxyHelper.InitProxy(proxyProviderDetails);
      const axiosResponse = await axiosHelper.fetchGetAsyncV2(
        proxyDetails,
        _url,
      );
      inputRequest = { proxyDetails, _url };
      output = { data: axiosResponse.data, request: inputRequest };
      break;
    case 6:
    case 7:
      let _antUrl = `${proxyProviderDetails.hostUrl}?url=${_url}&x-api-key=${proxyProviderDetails.userName}`;
      if (proxyParam == 6) {
        _antUrl += `&${proxyProviderDetails.password}`;
      }
      inputRequest = _antUrl;
      const antResponseRaw = await axios(_antUrl);
      let antResponse = {};
      if (antResponseRaw) {
        antResponse = antResponseRaw.data;
      }
      try {
        output = {
          data: JSON.parse(antResponse as any),
          request: inputRequest,
        };
      } catch (ex) {
        let responseStartIndex = (antResponse as any).indexOf(
          '<List xmlns=\"\">',
        );
        if (responseStartIndex < 0) {
          responseStartIndex = (antResponse as any).indexOf("<List>");
        }
        const responseEndIndex = (antResponse as any).indexOf("</List>");
        const responseString = `${(antResponse as any).substring(responseStartIndex, responseEndIndex)}</List>`;
        output = {
          data: await convertFromXml(responseString),
          request: inputRequest,
        };
      }
      break;
    default:
      break;
  }
  return output;
}

async function convertFromXml(payload: any): Promise<any> {
  let responseData = [];
  const options = { mergeAttrs: true, explicitArray: false };
  const scrapeResponseData = await xml2js.parseStringPromise(payload, options);
  if (
    scrapeResponseData &&
    scrapeResponseData["List"] &&
    scrapeResponseData["List"]["item"] &&
    scrapeResponseData["List"]["item"].length > 0
  ) {
    responseData = await formatWrapper.FormatScrapeResponse(
      scrapeResponseData["List"]["item"],
    );
  }
  return responseData;
}
