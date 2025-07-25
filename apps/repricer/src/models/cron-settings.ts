export default class CronSettings {
  CronId: string;
  CronName: string;
  CronTimeUnit: string;
  CronTime: number;
  Offset: number;
  SecretKey: string;
  UpdatedTime: Date;
  CronStatus: string;
  ProxyProvider: number;
  IpType: number;
  FixedIp: string;
  AlternateProxyProvider: string[];

  constructor(
    cronId: string,
    cronName: string,
    cronTimeUnit: string,
    cronTime: string,
    secretKey: string,
    cronStatus: string,
    offset: number,
    proxyProvider: string,
    ipType: string,
    fixedIp: string,
    alternateProviderList: string[] = [],
  ) {
    this.CronId = cronId;
    this.CronName = cronName;
    this.CronTimeUnit = cronTimeUnit;
    this.CronTime = isNaN(parseInt(cronTime)) ? 0 : parseInt(cronTime);
    this.Offset = offset;
    this.SecretKey = secretKey;
    //this.CreatedTime=createdTime;
    this.UpdatedTime = new Date();
    this.CronStatus = cronStatus;
    this.ProxyProvider = isNaN(parseInt(proxyProvider))
      ? 0
      : parseInt(proxyProvider);
    this.IpType = isNaN(parseInt(ipType)) ? 1 : parseInt(ipType);
    this.FixedIp = fixedIp;
    this.AlternateProxyProvider = alternateProviderList;
  }
}
