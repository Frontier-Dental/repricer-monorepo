USE repricerDb;

drop table table_history;

create Table table_history (
  Id Int NOT NULL AUTO_INCREMENT,
  RefTime datetime,
  MpId Int DEFAULT NULL,
  ChannelName varchar(50),
  ExistingPrice varchar(128),
  MinQty int DEFAULT NULL,
  Position int default NULL,
  LowestVendor varchar(128),
  LowestPrice decimal(10, 2) DEFAULT NULL,
  SuggestedPrice varchar(128),
  RepriceComment varchar(1024),
  MaxVendor varchar(128),
  MaxVendorPrice decimal(10, 2) DEFAULT NULL,
  OtherVendorList varchar(1024),
  LinkedApiResponse int,
  primary key (Id)
);

CREATE INDEX idx_history_mpid on table_history (MpId);

CREATE INDEX idx_history_refTime on table_history (RefTime);

CREATE INDEX idx_history_linkedApiResponse on table_history (LinkedApiResponse);

drop table table_history_apiResponse;

create table table_history_apiResponse (
  ApiResponseId Int NOT NULL AUTO_INCREMENT,
  RefTime datetime,
  ApiResponse longtext,
  primary key (ApiResponseId)
);

CREATE INDEX idx_history_apiResponse_refTime on table_history_apiResponse (RefTime);
