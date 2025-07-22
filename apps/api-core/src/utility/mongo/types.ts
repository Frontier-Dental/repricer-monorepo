import { WithId } from "mongodb";

export interface AlternateProxyProvider {
  Sequence: number;
  ProxyProvider: number;
}

export interface AuditInfo {
  UpdatedBy: string;
  UpdatedOn: { $date: string };
}

export interface ScrapeCronDetail {
  _id: { $oid: string };
  CronTime: number;
  CronTimeUnit: string;
  Offset: string;
  IpType: number;
  ProxyProvider: number;
  AlternateProxyProvider: AlternateProxyProvider[];
  status: string;
  createdOn: { $date: string };
  updatedOn: { $date: string };
  AuditInfo: AuditInfo;
  CronId: string;
  CronName: string;
  UpdatedTime: { $date: string };
}

export interface VendorSecretKey {
  vendorName: string;
  secretKey: string;
}

export interface CronSettingsDetail extends WithId<Document> {
  CronId: string;
  CronName: string;
  CronTimeUnit: string;
  CronTime: number;
  IsHidden: boolean;
  SecretKey: VendorSecretKey[];
  CreatedTime: { $date: string };
  UpdatedTime: { $date: string };
  CronStatus: boolean;
  Offset: string;
  FixedIp: string | null;
  IpType: number;
  ProxyProvider: number;
  AlternateProxyProvider: AlternateProxyProvider[];
  AuditInfo: AuditInfo;
}
