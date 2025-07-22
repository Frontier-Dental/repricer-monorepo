const jobScheduleConstants = {
  E30MIN: "every half-hour",
  EH: "every hour",
  E2H: "every 2 hours",
  E6H: "every 6 hours",
  E12H: "every 12hours",
  E1D: "every day",
  E7D: "every week",
  GENERIC: "GENERIC",
};
const jobRunConstants = {
  //"EH":"*/10 * * * * *", //<!--This is for test for job to run every 10 seconds-->
  E30MIN: "0 */30 * * * *",
  EH: "0 0 */1 * * *",
  E2H: "0 0 */2 * * *",
  E6H: "0 0 */6 * * *",
  E12H: "0 0 */12 * * *",
  E1D: "0 0 0 * * *",
  E7D: "0 0 */168 * * *",
  GENERIC: "0 */1 * * * *", //Changed to 1 Minute as per Client's requirement
};
export class ScheduleConstants {
  jobScheduleConstants: any;
  jobRunConstants: any;

  constructor() {
    this.jobScheduleConstants = jobScheduleConstants;
    this.jobRunConstants = jobRunConstants;
  }
}
