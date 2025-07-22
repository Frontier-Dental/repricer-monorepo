const PromiseFtp = require("promise-ftp");
const ftp = new PromiseFtp();
const fs = require("fs");

module.exports.GetAllFileDetails = async () => {
  let listOfFiles = [];
  try {
    await ftp.connect({
      host: "165.22.229.139",
      user: "voyantcs",
      password: ">mL3.rEtJtsP@43",
      secure: false,
    });
    const list = await ftp.list("REPRICER/DEV_HISTORY");
    list
      .filter(
        (file) =>
          file.name !== "." && file.name !== ".." && file.name.endsWith(".csv"),
      )
      .forEach((file) => {
        listOfFiles.push({ name: file.name, createdTime: file.date });
      });
    await ftp.end();
    console.log(`FTP FILES : ${JSON.stringify(listOfFiles)}`);
  } catch (exception) {
    console.error(
      `Exception while reading all files from FTP | ERROR : ${exception}`,
    );
  }
  return listOfFiles;
};

module.exports.DownloadFile = async (remotePath, localPath) => {
  try {
    await ftp.connect({
      host: "165.22.229.139",
      user: "voyantcs",
      password: ">mL3.rEtJtsP@43",
      secure: false,
    });
    const stream = await ftp.get(remotePath);
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(localPath);
      stream.pipe(writeStream);
      stream.once("close", () => {
        ftp.end();
        resolve();
      });
      stream.once("error", reject);
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
};
