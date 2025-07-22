/**create database repricerDb;**/
use repricerDb;

create table table_runInfo (
  Id Int NOT NULL AUTO_INCREMENT,
  CronName varchar(50) not null,
  CronId varchar(50) not null,
  RunStartTime varchar(50) not null,
  RunEndTime varchar(50),
  RunId varchar(255) not null,
  KeyGenId varchar(255),
  RunType varchar(50) not null,
  ProductCount int not null,
  EligibleCount int not null,
  ScrapedSuccessCount int not null,
  ScrapedFailureCount int not null,
  primary key (Id)
);

CREATE INDEX idx_run_cronId on table_runInfo (CronId);

CREATE INDEX idx_run_cronName on table_runInfo (CronName);

CREATE INDEX idx_run_runType on table_runInfo (RunType);

CREATE INDEX idx_run_startTime on table_runInfo (RunStartTime);

CREATE INDEX idx_run_endTime on table_runInfo (RunEndTime);

create table table_productInfo (
  Id Int NOT NULL AUTO_INCREMENT,
  LinkedCronInfo int,
  Mpid varchar(25) not null,
  VendorId varchar(25),
  VendorProductId varchar(50),
  VendorProductCode varchar(50),
  VendorName varchar(255),
  VendorRegion varchar(255),
  InStock boolean,
  StandardShipping decimal(5, 2),
  StandardShippingStatus varchar(255),
  FreeShippingGap decimal(5, 2),
  HeavyShippingStatus varchar(255),
  HeavyShipping decimal(5, 2),
  Inventory int,
  ShippingTime int,
  IsFulfillmentPolicyStock boolean,
  IsBackordered boolean,
  BadgeId int,
  BadgeName varchar(255),
  ArrivalDate varchar(50),
  ArrivalBusinessDays int,
  IsLowestTotalPrice varchar(50),
  ItemRank int not null,
  IsOwnVendor boolean not null,
  primary key (Id),
  FOREIGN KEY (LinkedCronInfo) REFERENCES table_runInfo (Id)
);

CREATE INDEX idx_product_mpid on table_productInfo (Mpid);

CREATE INDEX idx_product_isOwnVendor on table_productInfo (IsOwnVendor);

CREATE INDEX idx_product_itemRank on table_productInfo (ItemRank);

create table table_priceBreaks (
  Id Int NOT NULL AUTO_INCREMENT,
  LinkedProductInfo int,
  PMID int,
  MinQty int,
  UnitPrice decimal(10, 2),
  PromoAddlDescr varchar(255),
  IsActive boolean,
  primary key (Id),
  FOREIGN KEY (LinkedProductInfo) REFERENCES table_productInfo (Id)
);

CREATE INDEX idx_pricebreak_minQty on table_priceBreaks (MinQty);

alter table repricerDb.table_productInfo
add column HeavyShippingStatus varchar(255),
add column HeavyShipping decimal(5, 2),
add column Inventory int,
add column ArrivalDate varchar(50),
add column IsLowestTotalPrice varchar(50),
add column StartTime varchar(50),
add column EndTime varchar(50);

use repricerDb;

create table table_runCompletionStatus (
  Id Int NOT NULL AUTO_INCREMENT,
  KeyGenId varchar(255),
  RunType varchar(50) not null,
  IsCompleted boolean,
  primary key (Id)
);

CREATE INDEX idx_table_runCompletionStatus_KeyGenId on table_runCompletionStatus (KeyGenId);

use repricerDb;

create table table_scrapeProductList (
  Id Int NOT NULL AUTO_INCREMENT,
  MpId int not null,
  Net32Url varchar(555),
  IsActive boolean not null,
  LinkedCronName varchar(50) not null,
  LinkedCronId varchar(50) not null,
  LastUpdatedAt varchar(50),
  LastUpdatedBy varchar(50),
  primary key (Id)
);

CREATE INDEX idx_table_scrapeProductList_MpId_Active_CronName on table_scrapeProductList (MpId, IsActive, LinkedCronId);

ALTER TABLE table_scrapeProductList
ADD UNIQUE unique_idx_mpid (MpId);

ALTER TABLE table_scrapeProductList
add column LastScrapedDate varchar(50)
