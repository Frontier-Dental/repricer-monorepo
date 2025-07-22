const moment = require("moment");
const AuditInfo = require("../models/auditInfo");
module.exports.GetLoggedInUser = async (req) => req.session.users_id;
module.exports.GetAuditInfo = async (req) =>
  req && req.session && req.session.users_id
    ? new AuditInfo(req.session.users_id.userName)
    : new AuditInfo(`ANONYMOUS`);

module.exports.GetAuditValue = async (item, key) => {
  if (item.AuditInfo) {
    if (key == "U_NAME") return item.AuditInfo.UpdatedBy;
    if (key == "U_TIME")
      return item.AuditInfo.UpdatedOn
        ? moment(item.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
        : null;
  }
  return null;
};
