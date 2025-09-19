export default class ExportModel {
  fileName: string;
  status: string;
  createdTime: Date;
  updatedTime: Date;
  requestedBy: string;

  constructor(
    _status: string,
    _fileName: string,
    _createdTime: Date,
    _updatedTime: Date,
    _requestedBy: string,
  ) {
    this.fileName = _fileName;
    this.status = _status;
    this.createdTime = _createdTime;
    this.updatedTime = _updatedTime;
    this.requestedBy = _requestedBy;
  }
}
