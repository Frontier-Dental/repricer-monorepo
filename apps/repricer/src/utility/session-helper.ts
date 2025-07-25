import moment from "moment";
import AuditInfo from "../models/audit-info";

export const GetLoggedInUser = async (req: any) => req.session.users_id;
export const GetAuditInfo = async (req: any) =>
  req && req.session && req.session.users_id
    ? new AuditInfo(req.session.users_id.userName)
    : new AuditInfo(`ANONYMOUS`);

export const GetAuditValue = async (item: any, key: string) => {
  if (item.AuditInfo) {
    if (key == "U_NAME") return item.AuditInfo.UpdatedBy;
    if (key == "U_TIME")
      return item.AuditInfo.UpdatedOn
        ? moment(item.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
        : null;
  }
  return null;
};
