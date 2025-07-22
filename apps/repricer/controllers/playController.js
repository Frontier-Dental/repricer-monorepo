const asyncHandler = require("express-async-handler");
const httpMiddleware = require("../middleware/httpMiddleware");

module.exports.onInit = asyncHandler(async (req, res) => {
  res.render("pages/play/index", {
    groupName: "playground",
    userRole: req.session.users_id.userRole,
  });
});

module.exports.ScrapeProduct = asyncHandler(async (req, res) => {
  const mpId = req.params.mpid;
  const proxyProvId = req.params.proxyProviderId;
  const requestUrl = `${process.env.GET_DATA_URL}/${mpId}/${proxyProvId}`;
  try {
    let startTime = process.hrtime();
    const axiosResponse = await httpMiddleware.native_get(requestUrl);
    const timeTaken = parseHrtimeToSeconds(process.hrtime(startTime));
    const responseSize =
      Math.log(Buffer.byteLength(JSON.stringify(axiosResponse.data))) /
      Math.log(1024);
    const outputObject = {
      scrapeResult: axiosResponse.data,
      timeSpent: `${timeTaken} seconds`,
      dataSize: `${responseSize.toFixed(4)} kb`,
    };
    return res.json(outputObject);
  } catch (exception) {
    return res.json(exception);
  }
});

function parseHrtimeToSeconds(hrtime) {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}
