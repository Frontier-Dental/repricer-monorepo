import _ from "lodash";
import * as dbHelper from "./mongo/dbHelper";

export const GetProxy = async (cronName: string): Promise<any | null> => {
  let proxyResult: any = { protocol: "http" };
  const cronDetails = await dbHelper.GetCronSettingsDetailsByName(cronName);
  if (cronDetails) {
    const proxyDetails = await dbHelper.GetProxyConfigByProviderId(
      _.first(cronDetails as any[]).ProxyProvider,
    );
    switch (_.first(cronDetails as any[]).ProxyProvider) {
      case 0:
        proxyResult.host = _.first(proxyDetails as any[])?.hostUrl;
        proxyResult.port = _.first(proxyDetails as any[])?.port;
        proxyResult.auth = {};
        proxyResult.auth.username = _.first(proxyDetails as any[])?.userName;
        proxyResult.auth.password = _.first(proxyDetails as any[])?.password;
        break;
      case 1:
        const contextProxy = proxyDetails.find(
          (x: any) => x.ipType == _.first(cronDetails as any[])?.IpType,
        );
        proxyResult.host =
          contextProxy?.ipType == 0
            ? _.first(cronDetails as any[])?.FixedIp
            : contextProxy?.hostUrl;
        proxyResult.port = contextProxy?.port;
        proxyResult.auth = {};
        proxyResult.auth.username = contextProxy?.userName;
        proxyResult.auth.password = contextProxy?.password;
        proxyResult.dummyMethod = contextProxy?.method;
        break;
      case 2:
        proxyResult.host = _.first(proxyDetails as any[])?.hostUrl;
        proxyResult.port = _.first(proxyDetails as any[])?.port;
        proxyResult.auth = {};
        proxyResult.auth.username = _.first(proxyDetails as any[])?.userName;
        proxyResult.auth.password = _.first(proxyDetails as any[])?.password;
        break;
      default:
        break;
    }
  }
  return proxyResult;
};

export const GetProxyDetailsByName = async (
  cronName: string,
): Promise<any | null> => {
  return dbHelper.GetCronSettingsDetailsByName(cronName);
};

export const GetProxyDetailsById = async (cronId: number): Promise<any[]> => {
  const regularCronDetails = await dbHelper.GetCronSettingsList();
  const slowCronDetails = await dbHelper.GetSlowCronDetails();
  const cronDetails = _.concat(regularCronDetails, slowCronDetails);
  return [cronDetails.find((x: any) => x.CronId == cronId)].filter(
    Boolean,
  ) as any[];
};

export const InitProxy = async (proxyConfigDetails: any): Promise<any> => {
  let proxyResult: any = { protocol: "http" };
  const contextProxy = proxyConfigDetails;
  proxyResult.host = contextProxy.hostUrl;
  proxyResult.port = contextProxy.port;
  proxyResult.auth = {};
  proxyResult.auth.username = contextProxy.userName;
  proxyResult.auth.password = contextProxy.password;
  proxyResult.dummyMethod = contextProxy.method;
  return proxyResult;
};

export const GetProxyV2 = async (
  cronSettings: any,
  proxyProvider: number,
): Promise<any | null> => {
  let proxyResult: any = { protocol: "http" };
  if (cronSettings) {
    const proxyDetails =
      await dbHelper.GetProxyConfigByProviderId(proxyProvider);
    switch (proxyProvider) {
      case 0:
        proxyResult.host = _.first(proxyDetails as any[])?.hostUrl;
        proxyResult.port = _.first(proxyDetails as any[])?.port;
        proxyResult.auth = {};
        proxyResult.auth.username = _.first(proxyDetails as any[])?.userName;
        proxyResult.auth.password = _.first(proxyDetails as any[])?.password;
        break;
      case 1:
        const contextProxy = proxyDetails.find(
          (x: any) => x.ipType == cronSettings.IpType,
        );
        proxyResult.host =
          contextProxy?.ipType == 0
            ? cronSettings.FixedIp
            : contextProxy?.hostUrl;
        proxyResult.port = contextProxy?.port;
        proxyResult.auth = {};
        proxyResult.auth.username = contextProxy?.userName;
        proxyResult.auth.password = contextProxy?.password;
        proxyResult.dummyMethod = contextProxy?.method;
        break;
      case 2:
        proxyResult.host = _.first(proxyDetails as any[])?.hostUrl;
        proxyResult.port = _.first(proxyDetails as any[])?.port;
        proxyResult.auth = {};
        proxyResult.auth.username = _.first(proxyDetails as any[])?.userName;
        proxyResult.auth.password = _.first(proxyDetails as any[])?.password;
        break;
      default:
        break;
    }
  }
  return proxyResult;
};
