export class ErrorItemModel {
  mpId: number;
  nextCronTime: any;
  active: any;
  contextCronId: any;
  createdOn: Date;
  updatedOn: Date;
  insertReason: any;
  vendorName: any;

  constructor(_mpId: string | number, _nextCronTime: any, _active: any, _contextCronId: any, _insertReason: any, _vendor: any) {
    this.mpId = parseInt(_mpId as string);
    this.nextCronTime = _nextCronTime;
    this.active = _active;
    this.contextCronId = _contextCronId;
    this.createdOn = new Date();
    this.updatedOn = new Date();
    this.insertReason = _insertReason;
    this.vendorName = _vendor;
  }
}
