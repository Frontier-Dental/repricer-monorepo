import PromiseFtp from "promise-ftp";
const ftp = new PromiseFtp();
import fs from "fs";

export async function GetAllFileDetails() {
  let listOfFiles: any[] = [];
  await ftp.connect({
    host: "165.22.229.139",
    user: "voyantcs",
    password: ">mL3.rEtJtsP@43",
    secure: false,
  });
  const list = await ftp.list("REPRICER/DEV_HISTORY");
  list
    .filter(
      (file: any) =>
        file.name !== "." && file.name !== ".." && file.name.endsWith(".csv"),
    )
    .forEach((file: any) => {
      listOfFiles.push({ name: file.name, createdTime: file.date } as never);
    });
  await ftp.end();
  console.log(`FTP FILES : ${JSON.stringify(listOfFiles)}`);
  return listOfFiles;
}

export async function DownloadFile(remotePath: any, localPath: any) {
  await ftp.connect({
    host: "165.22.229.139",
    user: "voyantcs",
    password: ">mL3.rEtJtsP@43",
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
