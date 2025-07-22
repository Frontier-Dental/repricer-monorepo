const asyncHandler = require("express-async-handler");
const axios = require("axios");
const cacheHelper = require("../Utility/CacheHelper");
const get_all_cache = asyncHandler(async (req, res) => {
  try {
    const cacheResponse = await GetAllCacheItems();
    return res.json({
      status: true,
      message: cacheResponse.data,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const get_cache_item = asyncHandler(async (req, res) => {
  try {
    const _key = req.params.key;
    const getCacheItemUrl = `http://localhost:5001/cache/getCache/${_key}`;
    const config = {
      method: "get",
      url: getCacheItemUrl,
    };
    const getResponse = await axios(config);
    return res.json({
      status: true,
      message: getResponse.data,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const delete_cache_item = asyncHandler(async (req, res) => {
  try {
    const _key = req.params.key;
    const deleteCacheUrl = `http://localhost:5001/cache/flush/${_key}`;
    const config = {
      method: "get",
      url: deleteCacheUrl,
    };
    const getResponse = await axios(config);
    return res.json({
      status: true,
      message: getResponse.data,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const flush_all_cache = asyncHandler(async (req, res) => {
  try {
    const flushAllCacheUrl = `http://localhost:5001/cache/flush`;
    const config = {
      method: "get",
      url: flushAllCacheUrl,
    };
    const getResponse = await axios(config);
    return res.json({
      status: true,
      message: getResponse.data,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const GetAllCacheItems = asyncHandler(async () => {
  try {
    const getAllCacheUrl = `http://localhost:5001/cache/getall/`;
    const config = {
      method: "get",
      url: getAllCacheUrl,
    };
    return await axios(config);
  } catch (exception) {
    return { data: [] };
  }
});

const ClearRepricerCache = asyncHandler(async (req, res) => {
  try {
    await cacheHelper.FlushCache();
    return res.json({
      status: true,
      message: `All Cache Cleared.`,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

module.exports = {
  get_all_cache,
  get_cache_item,
  delete_cache_item,
  flush_all_cache,
  GetAllCacheItems,
  ClearRepricerCache,
};
