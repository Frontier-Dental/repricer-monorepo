import { Request, Response } from "express";
import * as httpMiddleware from "../middleware/http-wrappers";
import { applicationConfig } from "../utility/config";

export async function onInit(req: Request, res: Response) {
  res.render("pages/play/index", {
    groupName: "playground",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function ScrapeProduct(req: Request, res: Response) {
  const mpId = req.params.mpid;
  const proxyProvId = req.params.proxyProviderId;
  const requestUrl = `${applicationConfig.GET_DATA_URL}/${mpId}/${proxyProvId}`;
  let startTime = process.hrtime();
  const axiosResponse = await httpMiddleware.native_get(requestUrl);
  const timeTaken = parseHrtimeToSeconds(process.hrtime(startTime));
  const responseSize =
    Math.log(Buffer.byteLength(JSON.stringify(axiosResponse!.data))) /
    Math.log(1024);
  const outputObject = {
    scrapeResult: axiosResponse!.data,
    timeSpent: `${timeTaken} seconds`,
    dataSize: `${responseSize.toFixed(4)} kb`,
  };
  return res.json(outputObject);
}

function parseHrtimeToSeconds(hrtime: any) {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}
