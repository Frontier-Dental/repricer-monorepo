export default class AuditInfo {
  UpdatedBy: string;
  UpdatedOn: Date;
  constructor(userName: string) {
    this.UpdatedBy = userName;
    this.UpdatedOn = new Date();
  }
}
