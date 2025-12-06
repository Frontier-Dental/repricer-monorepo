import _ from "lodash";
import cron from "node-cron";
import express, { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as proxySwitchHelper from "../utility/proxy-switch-helper";
import {
  GetCronSettingsDetailsByName,
  GetProxySwitchCronDetails,
} from "../utility/mysql/mysql-v2";

export const proxySwitchController = express.Router();

//FilterCron Variables
let _PS1Cron: any = null;
let _CACHE_RESET_CRON: any = null;

proxySwitchController.get(
  "/start/proxySwitchCron",
  async (req: Request, res: Response): Promise<any> => {
    await startProxySwitchCronLogic();
    return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
  },
);

export async function startProxySwitchCronLogic() {
  const proxySwitchCronDetails = await GetProxySwitchCronDetails();
  if (proxySwitchCronDetails && proxySwitchCronDetails.length > 0) {
    if (proxySwitchCronDetails[0]) {
      _PS1Cron = cron.schedule(
        proxySwitchCronDetails[0].cronExpression,
        async () => {
          try {
            console.log(
              `Running ${proxySwitchCronDetails[0].cronName} at ${new Date()}`,
            );
            await proxySwitchHelper.SwitchProxy();
            console.log(
              `Completed ${proxySwitchCronDetails[0].cronName} at ${new Date()}`,
            );
          } catch (error) {
            console.error(
              `Error running ${proxySwitchCronDetails[0].cronName}:`,
              error,
            );
          }
        },
        {
          scheduled: JSON.parse(proxySwitchCronDetails[0].status),
        },
      );
      if (JSON.parse(proxySwitchCronDetails[0].status)) {
        console.log(
          `Started ${proxySwitchCronDetails[0].cronName} at ${new Date()} with expression ${proxySwitchCronDetails[0].cronExpression}`,
        );
      }
    }
  }
}

proxySwitchController.get(
  "/start/proxySwitchResetCron",
  async (req: Request, res: Response): Promise<any> => {
    await startProxySwitchResetCronLogic();
    return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
  },
);

export async function startProxySwitchResetCronLogic() {
  const expression = "* * * * *";
  _CACHE_RESET_CRON = cron.schedule(expression, async () => {
    try {
      console.log(`Running Proxy Switch Counter Reset Cron`);
      await proxySwitchHelper.ResetFailureCounter();
      console.log(`Completed Proxy Switch Counter Reset Cron`);
    } catch (error) {
      console.error(`Error running Proxy Switch Counter Reset Cron:`, error);
    }
  });
  console.log(`Started Proxy Switch Reset Cron with expression ${expression}`);
}

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
    const cronDetails = await GetCronSettingsDetailsByName(reqCronName);
    const responseData = await proxySwitchHelper.DebugProxySwitch(
      _.first(cronDetails),
    );
    return res.status(_codes.StatusCodes.OK).send(responseData);
  },
);
