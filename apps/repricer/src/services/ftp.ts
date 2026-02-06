import PromiseFtp from "promise-ftp";
const ftp = new PromiseFtp();
import fs from "fs";
import { applicationConfig } from "../utility/config";

export async function GetAllFileDetails() {
  let listOfFiles: any[] = [];
  await ftp.connect({
    host: applicationConfig.FTP_HOST,
    user: applicationConfig.FTP_USER,
    password: applicationConfig.FTP_PASSWORD,
    secure: false,
  });
  const list = applicationConfig.IS_DEV ? await ftp.list("REPRICER/DEV_HISTORY") : await ftp.list("REPRICER/HISTORY");
  list
    .filter((file: any) => file.name !== "." && file.name !== ".." && file.name.endsWith(".csv"))
    .forEach((file: any) => {
      listOfFiles.push({ name: file.name, createdTime: file.date } as never);
    });
  await ftp.end();
  console.log(`FTP FILES : ${JSON.stringify(listOfFiles)}`);
  return listOfFiles;
}

export async function DownloadFile(remotePath: any, localPath: any) {
  await ftp.connect({
    host: applicationConfig.FTP_HOST,
    user: applicationConfig.FTP_USER,
    password: applicationConfig.FTP_PASSWORD,
    secure: false,
  });
  const stream = await ftp.get(remotePath);
  return new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(localPath);
    stream.pipe(writeStream);
    stream.once("close", () => {
      ftp.end() as any;
      resolve();
    });
    stream.once("error", reject);
  });
}
