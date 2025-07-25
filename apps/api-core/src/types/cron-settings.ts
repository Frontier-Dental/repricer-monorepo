export interface SecretKeyEntry {
  vendorName: string;
  secretKey: string;
}

export interface AlternateProxyProviderEntry {
  Sequence: number;
  ProxyProvider: number;
}

export interface AuditInfo {
  UpdatedBy?: string;
  UpdatedOn?: string;
}

export interface CronSettings {
  _id?: object;
  CronId: string;
  CronName: string;
  CronTimeUnit?: string;
  CronTime?: number;
  SecretKey?: SecretKeyEntry[];
  CreatedTime?: string | null;
  CronStatus?: boolean;
  UpdatedTime?: string;
  Offset?: string;
  FixedIp?: string | null;
  IpType?: number;
  ProxyProvider?: number;
  AlternateProxyProvider?: AlternateProxyProviderEntry[];
  AuditInfo?: AuditInfo;
}
