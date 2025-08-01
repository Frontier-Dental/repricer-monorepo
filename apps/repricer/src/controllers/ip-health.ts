import express from "express";
import _codes from "http-status-codes";
import _ from "lodash";
import moment from "moment";
import cron from "node-cron";
import { GetCronSettingsList } from "../middleware/mongo";
import { applicationConfig } from "../utility/config";
import { postData } from "../middleware/storage-sense-helpers/axios-helper";
import { TriggerEmail } from "../middleware/storage-sense-helpers/email-helper";

export const ipHealthController = express.Router();

/************* PUBLIC APIS *************/
ipHealthController.get("/schedule/ip-health", async (req, res) => {
  if (applicationConfig.START_IP_HEALTH_CRON == false) {
    return res
      .status(_codes.OK)
      .send(`Ip-Health Cron not started as per settings at ${new Date()}`);
  }
  var ipHealthCron = cron.schedule(
    applicationConfig.CRON_IP_SCHEDULE,
    async () => {
      console.log(`IP-HEALTH : Checking IP Health at ${new Date()}`);
      await checkIpHealthV2();
    },
    { scheduled: true },
  );
  if (ipHealthCron) {
    return res
      .status(_codes.OK)
      .send(`Successfully Started Ip-Health Cron at ${new Date()}`);
  } else {
    return res
      .status(_codes.BAD_REQUEST)
      .send(
        `Some error occurred while starting Ip-Health Cron at ${new Date()}`,
      );
  }
});

async function checkIpHealthV2() {
  const cronSettingsList = await GetCronSettingsList();
  const dateTimeStr = moment(new Date()).format("DD-MM-YY HH:mm:ss");
  if (cronSettingsList && cronSettingsList.length > 0) {
    let ipList = _.map(cronSettingsList, "FixedIp");
    ipList = ipList.filter((x) => x != null && x != "");
    if (ipList && ipList.length > 0) {
      const ipHealthStatus = await postData(applicationConfig.DEBUG_IP, {
        listOfIps: ipList,
      });
      if (
        ipHealthStatus &&
        ipHealthStatus.data &&
        ipHealthStatus.data.status == "SUCCESS"
      ) {
        const emailBody = await getEmailBody(
          ipHealthStatus.data,
          cronSettingsList,
        );
        const subject = `IP-HEALTH | ${applicationConfig.ENV_NAME} | ${await getSubjectPrefix(ipHealthStatus.data)} | IP Health Status at ${dateTimeStr}`;
        TriggerEmail(emailBody, subject, applicationConfig.IP_HEALTH_EMAIL_ID);
      } else {
        await triggerExceptionEmail(dateTimeStr);
      }
    } else {
      console.log(`No Fixed IP Found for the crons at ${new Date()}`);
    }
  } else {
    await triggerExceptionEmail(dateTimeStr);
  }
}

async function getEmailBody(data: any, cronSettingsList: any) {
  let str =
    '<h2>Hi, Please find the IP health status as of now below.</h2><br/><table border="1"><thead><tr><th scope="col">#</th><th scope="col">Cron Name</th><th scope="col">IP</th><th scope="col">Port</th><th scope="col">Status</th><th scope="col">Ping Response</th></tr></thead><tbody>';
  if (data && data.healthInfo && data.healthInfo.length > 0) {
    let counter = 1;
    data.healthInfo.forEach((info: any) => {
      str += "<tr><th>" + counter + "</th><td>";
      str += getCronName(info.ip, cronSettingsList) + "</td><td>";
      str += info.ip + "</td><td>";
      str += info.port + "</td><td>";
      if (info.ipStatus == "GREEN") {
        str += '<span style="color:Green">GREEN</span></td><td>';
      } else {
        str += '<span style="color:RED">RED</span></td><td>';
      }
      str += info.pingResponse + "</td></tr>";
      counter++;
    });
  }
  str += "</tbody></table>";
  return str;
}

async function getSubjectPrefix(data: any) {
  let prefix = "SUCCESS";
  if (data && data.healthInfo && data.healthInfo.length > 0) {
    const redIp = data.healthInfo.filter((x: any) => x.ipStatus != "GREEN");
    prefix = redIp && redIp.length > 0 ? "FAILED" : prefix;
  }
  return prefix;
}

async function triggerExceptionEmail(dateTimeStr: any) {
  await TriggerEmail(
    `<h1>Some error occurred while getting IP health.</h1>`,
    `IP-HEALTH | ${applicationConfig.ENV_NAME} | EXCEPTION | IP Health Status at ${dateTimeStr}`,
    applicationConfig.IP_HEALTH_EMAIL_ID,
  );
}

function getCronName(ip: any, cronSettingsList: any[]) {
  return cronSettingsList.find((x) => x.FixedIp == ip).CronName;
}
