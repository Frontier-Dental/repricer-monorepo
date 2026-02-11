import { createObjectCsvWriter } from "csv-writer";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { applicationConfig } from "./config";

interface CsvRecord {
  RefTime_Str?: string;
  MpId?: string;
  ContextCronName?: string;
  ChannelName?: string;
  ExistingPrice?: string;
  MinQty?: string;
  Position?: string;
  LowestVendor?: string;
  LowestPrice?: string;
  SuggestedPrice?: string;
  RepriceComment?: string;
  MaxVendor?: string;
  MaxVendorPrice?: string;
  OtherVendorList?: string;
  TriggeredByVendor?: string;
  RepriceResult?: string;
  ApiResponse?: string;
}

class CsvWriter {
  private csvWriter: ReturnType<typeof createObjectCsvWriter>;
  private s3: S3Client;

  constructor(
    private filePath: string,
    private bucketName: string,
    private region: string
  ) {
    this.csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "RefTime_Str", title: "TIME" },
        { id: "MpId", title: "MPID" },
        { id: "ContextCronName", title: "CRON NAME" },
        { id: "ChannelName", title: "CHANNEL NAME" },
        { id: "ExistingPrice", title: "EXISTING PRICE" },
        { id: "MinQty", title: "MIN QTY" },
        { id: "Position", title: "RANK" },
        { id: "LowestVendor", title: "LOWEST VENDOR" },
        { id: "LowestPrice", title: "LOWEST PRICE" },
        { id: "SuggestedPrice", title: "SUGGESTED PRICE" },
        { id: "RepriceComment", title: "REPRICE COMMENT" },
        { id: "MaxVendor", title: "MAX VENDOR" },
        { id: "MaxVendorPrice", title: "MAX VENDOR PRICE" },
        { id: "OtherVendorList", title: "OTHER VENDOR LIST" },
        { id: "TriggeredByVendor", title: "TRIGGERED BY VENDOR" },
        { id: "RepriceResult", title: "REPRICE RESULT" },
        { id: "ApiResponse", title: "NET32 RESPONSE" },
      ],
    });

    // Initialize S3 client
    this.s3 = new S3Client({
      region: region,
      credentials: {
        accessKeyId: applicationConfig.AWS_ACCESS_KEY_ID!,
        secretAccessKey: applicationConfig.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async writeData(records: CsvRecord[]): Promise<void> {
    try {
      const batchSize = 10000; // adjust as needed
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await this.csvWriter.writeRecords(batch);
      }
      console.log("HISTORY_ARCHIVE_CRON : Data written to CSV file successfully.");
    } catch (err) {
      console.error("HISTORY_ARCHIVE_CRON : Error writing data to CSV file:", err);
    }
  }

  async uploadToS3Multipart(key: string): Promise<void> {
    const partSize = 5 * 1024 * 1024; // 5 MB minimum
    const fileStream = fs.createReadStream(this.filePath, { highWaterMark: partSize });
    const parts: any[] = [];

    // Step 1: Initiate multipart upload
    const createRes = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: "text/csv",
      })
    );

    try {
      let partNumber = 1;
      for await (const chunk of fileStream) {
        console.debug(`HISTORY_ARCHIVE_CRON : Uploading part ${partNumber} for file ${key} to S3  bucket ${this.bucketName}`);
        const uploadRes = await this.s3.send(
          new UploadPartCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: createRes.UploadId,
            PartNumber: partNumber,
            Body: chunk,
          })
        );
        parts.push({ ETag: uploadRes.ETag, PartNumber: partNumber });
        console.debug(`HISTORY_ARCHIVE_CRON : Successfully uploaded part ${partNumber} for file ${key} to S3 bucket ${this.bucketName}`);
        partNumber++;
      }

      // Step 2: Complete upload
      await this.s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: createRes.UploadId,
          MultipartUpload: { Parts: parts },
        })
      );
      console.log(`HISTORY_ARCHIVE_CRON : File uploaded successfully to s3://${this.bucketName}/${key}`);
    } catch (err) {
      // Abort if something goes wrong
      await this.s3.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: createRes.UploadId,
        })
      );
      console.error("HISTORY_ARCHIVE_CRON : Error during multipart upload:", err);
      throw err;
    }
  }
}
export { CsvWriter };
