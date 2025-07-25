import _ from "lodash";
import cron from "node-cron";
import express, { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as dbHelper from "../utility/mongo/db-helper";
import * as proxySwitchHelper from "../utility/proxy-switch-helper";

export const proxySwitchController = express.Router();

//FilterCron Variables
let _PS1Cron: any = null;
let _CACHE_RESET_CRON: any = null;

proxySwitchController.get(
  "/start/proxySwitchCron",
  async (req: Request, res: Response): Promise<any> => {
    const proxySwitchCronDetails = await dbHelper.GetProxySwitchCronDetails();
    if (proxySwitchCronDetails && proxySwitchCronDetails.length > 0) {
      if (proxySwitchCronDetails[0]) {
        _PS1Cron = cron.schedule(
          proxySwitchCronDetails[0].cronExpression,
          async () => {
            console.log(
              `Running ${proxySwitchCronDetails[0].cronName} at ${new Date()}`,
            );
            await proxySwitchHelper.SwitchProxy();
          },
          { scheduled: JSON.parse(proxySwitchCronDetails[0].status) },
        );
        console.log(
          `Started ${proxySwitchCronDetails[0].cronName} at ${new Date()} with expression ${proxySwitchCronDetails[0].cronExpression}`,
        );
      }
    }
    return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
  },
);

proxySwitchController.get(
  "/start/proxySwitchResetCron",
  async (req: Request, res: Response): Promise<any> => {
    _CACHE_RESET_CRON = cron.schedule(
      "* * * * *",
      async () => {
        console.log(
          `Running  Proxy Switch Counter Reset Cron at ${new Date()}`,
        );
        await proxySwitchHelper.ResetFailureCounter();
      },
      { scheduled: true },
    );
    console.log(
      `Started Proxy Switch Reset Cron at ${new Date()} with expression 0 * * * *`,
    );
    return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
  },
);

proxySwitchController.get(
  "/proxy_provider/reset_counter/:provId/:userId",
  async (req: Request, res: Response): Promise<any> => {
    const proxyProviderId = parseInt(req.params.provId);
    const userId = req.params.userId;
    await proxySwitchHelper.ResetProxyCounterForProvider(
      proxyProviderId,
      userId,
    );
    return res.status(_codes.StatusCodes.OK).send(`Reset is successful.`);
  },
);

proxySwitchController.get(
  "/proxy_provider/debug/:cronName",
  async (req: Request, res: Response): Promise<any> => {
    const reqCronName = req.params.cronName;
    const cronDetails =
      await dbHelper.GetCronSettingsDetailsByName(reqCronName);
    const responseData = await proxySwitchHelper.DebugProxySwitch(
      _.first(cronDetails),
    );
    return res.status(_codes.StatusCodes.OK).send(responseData);
  },
);
