import * as dbHelper from "./mongo/db-helper";
import * as axiosHelper from "./axios-helper";
import _ from "lodash";
import { applicationConfig } from "./config";
import * as sqlV2Service from "./mysql/mysql-v2";

interface ProxyFailureDetails {
  proxyProvider: number;
  providerName: string;
  failureCount: number;
  thresholdCount: number;
  initTime: Date;
}

interface CronSettings {
  CronId: number;
  CronName: string;
  ProxyProvider: number;
  SwitchSequence: number;
  AlternateProxyProvider?: AlternateProxyProvider[];
}

interface AlternateProxyProvider {
  ProxyProvider: number;
  Sequence: number;
}

interface ProxyConfig {
  proxyProviderId?: number;
  proxyProviderName?: string;
  [key: string]: any;
}

interface CronInfo {
  cronName: string;
  existingProxyProvider: string;
  newProxyProvider: string | null;
  cronId: number;
  thresholdReached: boolean;
}

export const ExecuteCounter = async (
  proxyProviderId: number,
): Promise<void> => {
  const existingRecord =
    await dbHelper.GetProxyFailureDetailsByProxyProviderId(proxyProviderId);

  // Item Does not exist. So create the Item object with Count as 1
  if (existingRecord && existingRecord.failureCount == 0) {
    console.log(
      `PROXY SWITCH COUNTER INIT : PROXY_PROV - ${proxyProviderId} || INIT_TIME : ${new Date()}`,
    );
    await dbHelper.InitProxyFailureDetails(proxyProviderId, 1);
  }
  // Cache exist, so update the counter
  else {
    console.log(
      `PROXY SWITCH COUNTER UPDATE : PROXY_PROV - ${proxyProviderId} || INIT_TIME : ${existingRecord?.initTime} || FAILURE_COUNT : ${existingRecord?.failureCount}`,
    );
    await dbHelper.UpdateProxyFailureDetails(
      proxyProviderId,
      existingRecord?.failureCount + 1,
    );
  }
};

export const ResetFailureCounter = async (): Promise<void> => {
  const proxyFailureDetails = await dbHelper.GetProxyFailureDetails();
  for (const record of proxyFailureDetails || []) {
    await ResetCounterForProvider(record as any, "SYSTEM", false);
  }
};

export const SwitchProxy = async (): Promise<void> => {
  const proxyFailureDetails = await dbHelper.GetProxyFailureDetails();
  for (const record of proxyFailureDetails || []) {
    if (record.failureCount > 0) {
      const failureCountThreshold = parseInt(record.thresholdCount.toString());
      console.log(`Running Proxy Switch Check for ${record.providerName}`);
      let payloadForEmail: CronInfo[] = [];

      if (record.failureCount > failureCountThreshold) {
        console.log(
          `Maximum Threshold for Failures Reached for ProxyProvider ${record.providerName} with count :${record.failureCount}`,
        );

        // Changing Proxy Provider To All Linked Cron to Next Available Proxy Provider.
        const linkedCronWithExistingProxyProvider =
          await sqlV2Service.GetLinkedCronSettingsByProviderId(
            record.proxyProvider,
          );

        if (
          linkedCronWithExistingProxyProvider &&
          linkedCronWithExistingProxyProvider.length > 0
        ) {
          for (const linkedCron of linkedCronWithExistingProxyProvider) {
            const result = await executeProxySwitch(linkedCron as any);
            if (result) {
              payloadForEmail.push(result);
            }
          }
        }

        // Send Email Notification
        if (payloadForEmail && payloadForEmail.length > 0) {
          const payloadForProxyChange = _.filter(
            payloadForEmail,
            (p) => !p.thresholdReached,
          );
          const payloadForThresholdReached = _.filter(
            payloadForEmail,
            (p) => p.thresholdReached,
          );

          if (payloadForProxyChange && payloadForProxyChange.length > 0) {
            await axiosHelper.postAsync(
              payloadForProxyChange,
              applicationConfig.PROXY_SWITCH_EMAIL_NOTIFIER!,
            );
          }

          if (
            payloadForThresholdReached &&
            payloadForThresholdReached.length > 0
          ) {
            await axiosHelper.postAsync(
              payloadForThresholdReached,
              applicationConfig.PROXY_SWITCH_EMAIL_THRESHOLD_NOTIFIER!,
            );
          }

          console.log(`Email sent for Proxy Switch at ${new Date()}`);
        }
      }
    }
  }
};

export const ResetProxyCounterForProvider = async (
  providerId: number,
  userId: string,
): Promise<void> => {
  const proxyFailureDetails =
    await dbHelper.GetProxyFailureDetailsByProxyProviderId(providerId);
  await ResetCounterForProvider(proxyFailureDetails as any, userId, true);
};

export const DebugProxySwitch = async (
  cronDetails: CronSettings,
): Promise<CronInfo | null> => {
  return executeProxySwitch(cronDetails);
};

async function updateProxyForCron(
  listOfCrons: CronSettings[],
  existingProxyProviderId: number,
  newProxyProvider: number,
  sequence: number = -1,
): Promise<CronInfo | null> {
  let payloadForEmail: CronInfo | null = null;
  const existingProxyDetails = _.first(
    await sqlV2Service.GetProxyConfigByProviderId(existingProxyProviderId),
  ) as ProxyConfig | undefined;

  for (let cronSettings of listOfCrons) {
    console.log(
      `PROXY PROVIDER CHANGE : ${cronSettings.CronName} || Existing Proxy Provider : ${cronSettings.ProxyProvider} || New Proxy Provider : ${newProxyProvider}`,
    );

    // Threshold Reached. So Do nothing and Send Email About Threshold
    if (newProxyProvider == 99) {
      const cronInfo: CronInfo = {
        cronName: cronSettings.CronName,
        existingProxyProvider: existingProxyDetails
          ? existingProxyDetails.proxyProviderName || ""
          : "",
        newProxyProvider: null,
        cronId: cronSettings.CronId,
        thresholdReached: true,
      };
      payloadForEmail = cronInfo;
      await sqlV2Service.UpdateProxyDetailsByCronId(
        cronSettings.CronId,
        cronSettings.ProxyProvider,
        -1,
      );
    } else {
      const newProxyDetails = _.first(
        await sqlV2Service.GetProxyConfigByProviderId(newProxyProvider),
      ) as ProxyConfig | undefined;

      await sqlV2Service.UpdateProxyDetailsByCronId(
        cronSettings.CronId as unknown as string,
        newProxyProvider,
        sequence,
      );

      const cronInfo: CronInfo = {
        cronName: cronSettings.CronName,
        existingProxyProvider: existingProxyDetails
          ? existingProxyDetails.proxyProviderName || ""
          : "",
        newProxyProvider: newProxyDetails
          ? newProxyDetails.proxyProviderName || ""
          : "",
        cronId: cronSettings.CronId,
        thresholdReached: false,
      };
      payloadForEmail = cronInfo;
    }

    await axiosHelper.native_get(applicationConfig.REPRICER_UI_CACHE_CLEAR!);
  }

  return payloadForEmail;
}

async function ResetCounterForProvider(
  providerIdDetails: ProxyFailureDetails,
  userId: string,
  isForceReset: boolean,
): Promise<void> {
  const proxySwitchTimer = applicationConfig.PROXYSWITCH_TIMER;

  if (isForceReset == true) {
    console.log(
      `PROXY SWITCH COUNTER RESET : Resetting Counter for ${providerIdDetails.providerName} with failure Count : ${providerIdDetails.failureCount} and Init Time : ${providerIdDetails.initTime} || Force Reset : TRUE`,
    );
    await dbHelper.ResetProxyFailureDetails(
      providerIdDetails.proxyProvider,
      userId,
    );
  } else if (
    providerIdDetails.failureCount > 0 &&
    new Date().getTime() - providerIdDetails.initTime.getTime() >
      proxySwitchTimer
  ) {
    console.log(
      `PROXY SWITCH COUNTER RESET : Resetting Counter for ${providerIdDetails.providerName} with failure Count : ${providerIdDetails.failureCount} and Init Time : ${providerIdDetails.initTime}`,
    );
    await dbHelper.ResetProxyFailureDetails(
      providerIdDetails.proxyProvider,
      userId,
    );
  }
}

async function executeProxySwitch(
  cronDetails: CronSettings,
): Promise<CronInfo | null> {
  let payloadForEmail: CronInfo | null = null;

  if (
    cronDetails.AlternateProxyProvider &&
    cronDetails.AlternateProxyProvider.length > 0
  ) {
    const existingProxyProvider = cronDetails.ProxyProvider;
    const existingAlternateProxyDetails =
      cronDetails.AlternateProxyProvider.find(
        (x) => x.ProxyProvider == existingProxyProvider,
      );

    if (existingAlternateProxyDetails) {
      let existingSequence = existingAlternateProxyDetails.Sequence;
      const availableMatchingAlternateProviders = _.filter(
        cronDetails.AlternateProxyProvider,
        (proxy) =>
          proxy.ProxyProvider === existingProxyProvider &&
          proxy.Sequence != cronDetails.SwitchSequence,
      );
      if (
        availableMatchingAlternateProviders &&
        availableMatchingAlternateProviders.length > 1
      ) {
        const sortedMatchingProviders = _.sortBy(
          availableMatchingAlternateProviders,
          (proxy) => proxy.Sequence,
        );
        existingSequence = sortedMatchingProviders[0].Sequence;
      }

      const availableAlternateSolution = _.filter(
        cronDetails.AlternateProxyProvider,
        (proxy) => proxy.Sequence > existingSequence,
      );

      if (availableAlternateSolution && availableAlternateSolution.length > 0) {
        payloadForEmail = await updateProxyForCron(
          [cronDetails],
          existingProxyProvider,
          _.first(availableAlternateSolution)!.ProxyProvider,
          _.first(availableAlternateSolution)!.Sequence,
        );
      } else {
        payloadForEmail = await updateProxyForCron(
          [cronDetails],
          existingProxyProvider,
          99,
        ); // Threshold Reached. So Do nothing and Send Email About Threshold
      }
    }
  }

  return payloadForEmail;
}

// Export default for backward compatibility
export default {
  ExecuteCounter,
  ResetFailureCounter,
  SwitchProxy,
  ResetProxyCounterForProvider,
  DebugProxySwitch,
};
