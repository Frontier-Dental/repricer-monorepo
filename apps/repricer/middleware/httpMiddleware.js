const axios = require("axios");
const axiosRetry = require("axios-retry");

axiosRetry(axios, {
  retries: process.env.NO_OF_RETRIES, // number of retries
  retryDelay: (retryCount) => {
    console.log(`retry attempt : ${retryCount} at ${new Date()}`);
    return retryCount * process.env.RETRY_INTERVAL; // time interval between retries
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

module.exports.updatePrice = async (request) => {
  try {
    var config = {
      method: "post",
      url: process.env.UPDATE_PRICE_URL,
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
  } catch (exception) {
    if (exception.message.indexOf("422") > -1) {
      return `ERROR:422 : ${exception.response.data.message}`;
    }
    if (exception.message.indexOf("429") > -1) {
      return `ERROR:429 : ${exception.response.data.message}`;
    }
    return exception;
  }
};

module.exports.runCron = async () => {
  try {
    const config = {
      method: "get",
      url: process.env.CRON_RUN_ALL_URL,
    };
    return await axios(config);
  } catch (exception) {
    console.log({ axiosError: exception });
    return null;
  }
};

module.exports.runManualCron = async (mpId, itemDetails, source) => {
  try {
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
  } catch (exception) {
    console.log(exception);
  }
  return null;
};

module.exports.startCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.CRON_START_URL,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
  }
  return null;
};

module.exports.stopCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.CRON_STOP_URL,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
  }
  return null;
};

module.exports.recreateCron = async (cronDetails) => {
  try {
    const config = {
      method: "post",
      url: process.env.RECREATE_CRON_URL,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(cronDetails),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.updateProductManual = async (mpId, payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.MANUAL_PROD_UPDATE + mpId,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
  }
  return null;
};

module.exports.stopAllCron = async () => {
  try {
    const config = {
      method: "get",
      url: process.env.STOP_ALL_CRON,
    };
    return await axios(config);
  } catch (exception) {
    console.log({ axiosError: exception });
    return null;
  }
};

module.exports.StartOverride = async () => {
  try {
    const config = {
      method: "get",
      url: process.env.START_OVERRIDE_URL,
    };
    return await axios(config);
  } catch (exception) {
    console.log({ axiosError: exception });
    return null;
  }
};

module.exports.native_get = async (_url) => {
  try {
    const config = {
      method: "get",
      url: _url,
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
  }
};

module.exports.toggleFilterCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.FILTER_CRON_TOGGLE_STATUS,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.toggleScrapeCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.SCRAPE_CRON_TOGGLE_STATUS,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.toggleSlowCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.SLOW_CRON_TOGGLE_STATUS,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.recreateFilterCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.FILTER_CRON_RECREATE,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.native_post = async (_url, payload) => {
  try {
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
  } catch (exception) {
    console.log(exception);
  }
};

module.exports.recreateSlowCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.SLOW_CRON_RECREATE,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.recreateScrapeCron = async (payload) => {
  try {
    const config = {
      method: "post",
      url: process.env.SCRAPE_CRON_RECREATE,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
      },
      data: JSON.stringify(payload),
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
    return exception;
  }
};

module.exports.native_get_V2 = async (_url, _headers) => {
  try {
    const config = {
      method: "get",
      url: _url,
      headers: _headers,
    };
    return await axios(config);
  } catch (exception) {
    console.log(exception);
  }
};

async function getManualCronUrl(mpid, source) {
  const baseUri =
    source == "FEED"
      ? process.env.FEED_REPRICER_OWN_URL
      : process.env.REPRICE_OWN_URL;
  return `${baseUri}${mpid}`;
}
