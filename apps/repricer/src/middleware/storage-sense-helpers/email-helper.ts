import postmark from "postmark";
import { applicationConfig } from "../../utility/config";

export async function TriggerEmailForStorage(
  freeSpace: number,
  dateTimeStr: string,
) {
  var client = new postmark.ServerClient(applicationConfig.SMTP_USER);
  await client.sendEmail({
    From: applicationConfig.EMAIL_ID,
    To: applicationConfig.TO_EMAIL,
    Subject: `STORAGE-SENSE | ${applicationConfig.ENV_NAME} | ${applicationConfig.EMAIL_SUBJECT} at ${dateTimeStr}`,
    TextBody: `Storage has been freed for ${applicationConfig.ENV_NAME} bearing IP: ${applicationConfig.ENV_IP} as it had reached the threshold. Available Space was ${freeSpace.toFixed(2)}%. Please restart the droplet to free up the space.`,
  });
}

export async function TriggerEmail(
  body: string,
  subject: string,
  fromEmail: string,
) {
  var client = new postmark.ServerClient(applicationConfig.SMTP_USER);
  await client.sendEmail({
    From: fromEmail,
    To: process.env.TO_EMAIL,
    Subject: subject,
    HtmlBody: body,
  });
}

export async function TriggerEmailV2(
  body: string,
  subject: string,
  fromEmail: string,
  toEmail: string,
) {
  var client = new postmark.ServerClient(applicationConfig.SMTP_USER);
  await client.sendEmail({
    From: fromEmail,
    To: toEmail,
    Subject: subject,
    HtmlBody: body,
  });
}
