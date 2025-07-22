class AuditInfo {
  constructor(userName) {
    this.UpdatedBy = userName;
    this.UpdatedOn = new Date();
  }
}
module.exports = AuditInfo;
