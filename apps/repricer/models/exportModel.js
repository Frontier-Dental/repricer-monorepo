class ExportModel {
  constructor(_status, _fileName, _createdTime, _updatedTime, _requestedBy) {
    this.fileName = _fileName;
    this.status = _status;
    this.createdTime = _createdTime;
    this.updatedTime = _updatedTime;
    this.requestedBy = _requestedBy;
  }
}
module.exports = ExportModel;
