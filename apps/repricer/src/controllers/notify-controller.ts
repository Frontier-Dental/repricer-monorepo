import _ from "lodash";
import express from "express";
import _codes from "http-status-codes";
import moment from "moment";
import {
  TriggerEmail,
  TriggerEmailV2,
} from "../middleware/storage-sense-helpers/email-helper";
import { Request, Response } from "express";
import { applicationConfig } from "../utility/config";

export const notifyController = express.Router();
/************* PUBLIC APIS *************/
notifyController.post(
  "/notify/proxy_switch_email",
  async (req: Request, res: Response) => {
    const dateTimeStr = moment(new Date()).format("DD-MM-YY HH:mm:ss");
    const subject = `PROXY SWITCH : Proxy Provider Switched at ${dateTimeStr}`;
    const emailBody = await getEmailBodyForProxySwitch(req.body, dateTimeStr);
    await TriggerEmail(emailBody, subject, applicationConfig.MONITOR_EMAIL_ID);
    return res
      .status(_codes.OK)
      .send(`Successfully sent email at ${new Date()}`);
  },
);

notifyController.post(
  "/notify/proxy_switch_threshold_email",
  async (req: Request, res: Response) => {
    const dateTimeStr = moment(new Date()).format("DD-MM-YY HH:mm:ss");
    const subject = `ATTENTION : THRESHOLD REACHED : No More switch at ${dateTimeStr}`;
    const emailBody = await getEmailBodyForThresholdProxySwitch(
      req.body,
      dateTimeStr,
    );
    await TriggerEmail(emailBody, subject, applicationConfig.MONITOR_EMAIL_ID);
    return res
      .status(_codes.OK)
      .send(`Successfully sent email at ${new Date()}`);
  },
);

notifyController.post("/notify/user_creation_email", async (req, res) => {
  const userInfo = req.body;
  const dateTimeStr = moment(new Date()).format("DD-MM-YY HH:mm:ss");
  const subject = `WELCOME TO REPRICER : User Created Successfully on ${dateTimeStr}`;
  const emailBody = await getEmailBodyForUserCreation(req.body);
  await TriggerEmailV2(
    emailBody,
    subject,
    applicationConfig.MONITOR_EMAIL_ID,
    userInfo.userName,
  );
  return res.status(_codes.OK).send(`Successfully sent email at ${new Date()}`);
});

/************* PRIVATE FUNCTIONS *************/

async function getEmailBodyForProxySwitch(payload: any[], dateTimeStr: any) {
  let str = `<h2>Hi, <br>Please note that the Proxy Provider for crons have been switched due to continuous error in the existing configuration at ${dateTimeStr}. The changes has been done as per the priority set in IP Configuration</h2><br/> <br>The details of the switch is given below :</br><table border="1"><thead><tr><th scope="col">#</th><th scope="col">Cron Name</th><th scope="col">Existing Proxy Provider</th><th scope="col">New Proxy Provider</th></tr></thead><tbody>`;
  let counter = 1;
  for (const info of payload) {
    str += "<tr><th>" + counter + "</th><td>";
    str += info.cronName + "</td><td>";
    str += info.existingProxyProvider + "</td><td>";
    str += info.newProxyProvider + "</td></tr>";
    counter++;
  }
  str += "</tbody></table>";
  return str;
}

async function getEmailBodyForThresholdProxySwitch(
  payload: any[],
  dateTimeStr: any,
) {
  let str = `<h2>Hi, <br>Please note that the Proxy Provider for the below crons can no longer be switched as no more alternate Proxy Providers are available. Please look onto the accounts of all available proxy providers and change the details manually.<h2><br/> <br>The details of the switch is given below :</br><table border="1"><thead><tr><th scope="col">#</th><th scope="col">Cron Name</th><th scope="col">Existing Proxy Provider</th></tr></thead><tbody>`;
  let counter = 1;
  for (const info of payload) {
    str += "<tr><th>" + counter + "</th><td>";
    str += info.cronName + "</td><td>";
    str += info.existingProxyProvider + "</td></tr>";
    counter++;
  }
  str += "</tbody></table>";
  return str;
}

async function getEmailBodyForUserCreation(payload: any) {
  let str = `<h2>Hi, <br>Welcome to Repricer. As per the request, You have been given access to the Repricer Portal.</h2><br/> <br>The Login Credentials is given below :</br><table border="1"><thead><tr><th scope="col">User Name</th><th scope="col">Password</th></tr></thead><tbody>`;
  str += "<tr><th>" + payload.userName + "</th><td><b>";
  str += payload.userPassword + "</b></td></tr>";
  str += "</tbody></table>";
  str += `<br/>Please click <a href="http://159.89.121.57:3000/" target="_blank">here</a> to login to the Scraper.`;
  str += `<br/><h4>NOTE : You can change the password as per your convenience by clicking on Change Password.</h4>`;
  return str;
}
