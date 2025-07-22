class CronSettings {
  constructor(
    cronId,
    cronName,
    cronTimeUnit,
    cronTime,
    secretKey,
    cronStatus,
    offset,
    proxyProvider,
    ipType,
    fixedIp,
    alternateProviderList = [],
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
module.exports = CronSettings;
