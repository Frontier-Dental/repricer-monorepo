const nodeCache = require("node-cache");
const repricerCache = new nodeCache({ stdTTL: 0 });
const axios = require("axios");

module.exports.Set = async (key, value) => {
  repricerCache.set(key, value);
};

module.exports.Has = async (key) => {
  if (key) {
    return repricerCache.has(key);
  } else return false;
};

module.exports.Get = async (key) => {
  if (key) {
    return repricerCache.get(key);
  }
  return null;
};

module.exports.GetAllCache = async () => {
  return repricerCache.keys();
};

module.exports.DeleteCacheByKey = async (key) => {
  if (key) {
    return repricerCache.del(key);
  }
  return "";
};

module.exports.FlushCache = async () => {
  return repricerCache.flushAll();
};

module.exports.DeleteExternalCache = async (key) => {
  const deleteCacheUrl = `http://localhost:5001/cache/flush/${key}`;
  const config = {
    method: "get",
    url: deleteCacheUrl,
  };
  await axios(config);
};
