import axios from "axios";
import axiosRetry from "axios-retry";
import { applicationConfig } from "../utility/config";

axiosRetry(axios, {
  retries: applicationConfig.NO_OF_RETRIES as any, // number of retries
  retryDelay: (retryCount) => {
    console.log(`retry attempt : ${retryCount} at ${new Date()}`);
    return retryCount * (applicationConfig.RETRY_INTERVAL as any); // time interval between retries
  },
  retryCondition: (error) => {
    console.log(`REPRICER UI : ERROR (WITH RETRY) : ${error} `);
    // return (error.response.status == 503 || error.response.status == 500 || error.response.status == 429);
    return (
      error.response?.status === 503 ||
      error.response?.status === 500 ||
      error.response?.status === 429
    );
  },
});

export async function updatePrice(request: any) {
  var config = {
    method: "post",
    url: applicationConfig.UPDATE_PRICE_URL,
    headers: {
      "Subscription-Key": request.secretKey,
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(request.payload),
  };
  const response = await axios(config);
  return response.data;
}

export const runCron = async () => {
  try {
    const config = {
      method: "get",
      url: applicationConfig.CRON_RUN_ALL_URL,
    };
    return await axios(config);
  } catch (exception) {
    console.log({ axiosError: exception });
    return null;
  }
};

export async function runManualCron(mpId: any, itemDetails: any, source: any) {
  const config = {
    method: "post",
    url: await getManualCronUrl(mpId, source),
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(itemDetails),
  };
  return await axios(config);
}

export async function startCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.CRON_START_URL,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function stopCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.CRON_STOP_URL,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function recreateCron(cronDetails: any) {
  const config = {
    method: "post",
    url: applicationConfig.RECREATE_CRON_URL,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(cronDetails),
  };
  return await axios(config);
}

export async function updateProductManual(mpId: any, payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.MANUAL_PROD_UPDATE + mpId,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function stopAllCron() {
  const config = {
    method: "get",
    url: applicationConfig.STOP_ALL_CRON,
  };
  return await axios(config);
}

export async function StartOverride() {
  const config = {
    method: "get",
    url: applicationConfig.START_OVERRIDE_URL,
  };
  return await axios(config);
}

export async function native_get(_url: any) {
  const config = {
    method: "get",
    url: _url,
  };
  return await axios(config);
}

export async function toggleFilterCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.FILTER_CRON_TOGGLE_STATUS,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function toggleScrapeCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.SCRAPE_CRON_TOGGLE_STATUS,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function toggleSlowCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.SLOW_CRON_TOGGLE_STATUS,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function recreateFilterCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.FILTER_CRON_RECREATE,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function native_post(_url: any, payload: any) {
  const config = {
    method: "post",
    url: _url,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  await axios(config);
}

export async function recreateSlowCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.SLOW_CRON_RECREATE,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function recreateScrapeCron(payload: any) {
  const config = {
    method: "post",
    url: applicationConfig.SCRAPE_CRON_RECREATE,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(payload),
  };
  return await axios(config);
}

export async function native_get_V2(_url: any, _headers: any) {
  const config = {
    method: "get",
    url: _url,
    headers: _headers,
  };
  return await axios(config);
}

async function getManualCronUrl(mpid: any, source: any) {
  const baseUri =
    source == "FEED"
      ? applicationConfig.FEED_REPRICER_OWN_URL
      : applicationConfig.REPRICE_OWN_URL;
  return `${baseUri}${mpid}`;
}
