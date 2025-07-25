const scheduleConstants = {
  E30MIN: "every half-hour",
  EH: "every hour",
  E2H: "every 2 hours",
  E6H: "every 6 hours",
  E12H: "every 12hours",
  E1D: "every day",
  E7D: "every week",
};

export default class ScheduleConstants {
  scheduleEnum: any;
  constructor() {
    this.scheduleEnum = scheduleConstants;
  }
}
