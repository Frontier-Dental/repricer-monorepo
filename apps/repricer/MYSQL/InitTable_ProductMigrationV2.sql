/**create database repricerDb;**/
use repricerDb;

alter table table_scrapeProductList
add column ProductName varchar(255),
add column RegularCronName varchar(50),
add column RegularCronId varchar(50),
add column SlowCronName varchar(50),
add column SlowCronId varchar(50),
add column LinkedTradentDetailsInfo int,
add column LinkedFrontiersDetailsInfo int,
add column LinkedMvpDetailsInfo int;

CREATE INDEX idx_table_scrapeProductList_RegularCronId_MpId on table_scrapeProductList (MpId, RegularCronId);

CREATE INDEX idx_table_scrapeProductList_SlowCronId_MpId on table_scrapeProductList (MpId, SlowCronId);

CREATE INDEX idx_table_scrapeProductList_MpId on table_scrapeProductList (MpId);

---- TRADENT ----
create table table_tradentDetails (
  Id Int NOT NULL AUTO_INCREMENT,
  ChannelName varchar(50),
  ScrapeOn boolean,
  AllowReprice boolean,
  Activated boolean,
  UnitPrice decimal(5, 2),
  FocusId varchar(50),
  RequestInterval int,
  FloorPrice decimal(5, 2),
  MaxPrice decimal(5, 2),
  ChannelId varchar(50),
  CreatedAt datetime,
  UpdatedAt datetime,
  UpdatedBy varchar(50),
  LastCronTime datetime,
  LastUpdateTime datetime,
  LastAttemptedTime datetime,
  IsNCNeeded boolean,
  RepricingRule int,
  RequestIntervalUnit varchar(12),
  SuppressPriceBreak boolean,
  PriorityValue int,
  LastCronMessage varchar(1024),
  LowestVendor varchar(255),
  LowestVendorPrice varchar(255),
  LastExistingPrice varchar(255),
  LastSuggestedPrice varchar(255),
  NextCronTime datetime,
  BeatQPrice boolean,
  CompeteAll boolean,
  PercentageIncrease int,
  SuppressPriceBreakForOne boolean,
  CompareWithQ1 boolean,
  WaitUpdatePeriod boolean,
  LastCronRun varchar(50),
  AbortDeactivatingQPriceBreak boolean,
  BadgeIndicator varchar(50),
  BadgePercentage int,
  LastUpdatedBy varchar(50),
  InactiveVendorId varchar(50),
  IncludeInactiveVendors boolean,
  OverrideBulkRule int,
  OverrideBulkUpdate boolean,
  LatestPrice int,
  ExecutionPriority int,
  ApplyBuyBoxLogic boolean,
  ApplyNcForBuyBox boolean,
  primary key (Id)
);

CREATE INDEX idx_item_tradent_activated on table_tradentDetails (Activated);

ALTER TABLE table_scrapeProductList
ADD CONSTRAINT fk_tradent_details_id FOREIGN KEY (LinkedTradentDetailsInfo) REFERENCES table_tradentDetails (Id);

---- FRONTIER ----
create table table_frontierDetails (
  Id Int NOT NULL AUTO_INCREMENT,
  ChannelName varchar(50),
  ScrapeOn boolean,
  AllowReprice boolean,
  Activated boolean,
  UnitPrice decimal(5, 2),
  FocusId varchar(50),
  RequestInterval int,
  FloorPrice decimal(5, 2),
  MaxPrice decimal(5, 2),
  ChannelId varchar(50),
  CreatedAt datetime,
  UpdatedAt datetime,
  UpdatedBy varchar(50),
  LastCronTime datetime,
  LastUpdateTime datetime,
  LastAttemptedTime datetime,
  IsNCNeeded boolean,
  RepricingRule int,
  RequestIntervalUnit varchar(12),
  SuppressPriceBreak boolean,
  PriorityValue int,
  LastCronMessage varchar(1024),
  LowestVendor varchar(255),
  LowestVendorPrice varchar(255),
  LastExistingPrice varchar(255),
  LastSuggestedPrice varchar(255),
  NextCronTime datetime,
  BeatQPrice boolean,
  CompeteAll boolean,
  PercentageIncrease int,
  SuppressPriceBreakForOne boolean,
  CompareWithQ1 boolean,
  WaitUpdatePeriod boolean,
  LastCronRun varchar(50),
  AbortDeactivatingQPriceBreak boolean,
  BadgeIndicator varchar(50),
  BadgePercentage int,
  LastUpdatedBy varchar(50),
  InactiveVendorId varchar(50),
  IncludeInactiveVendors boolean,
  OverrideBulkRule int,
  OverrideBulkUpdate boolean,
  LatestPrice int,
  ExecutionPriority int,
  ApplyBuyBoxLogic boolean,
  ApplyNcForBuyBox boolean,
  primary key (Id)
);

CREATE INDEX idx_item_frontier_activated on table_frontierDetails (Activated);

ALTER TABLE table_scrapeProductList
ADD CONSTRAINT fk_frontier_details_id FOREIGN KEY (LinkedFrontiersDetailsInfo) REFERENCES table_frontierDetails (Id);

---- MVP ----
create table table_mvpDetails (
  Id Int NOT NULL AUTO_INCREMENT,
  ChannelName varchar(50),
  ScrapeOn boolean,
  AllowReprice boolean,
  Activated boolean,
  UnitPrice decimal(5, 2),
  FocusId varchar(50),
  RequestInterval int,
  FloorPrice decimal(5, 2),
  MaxPrice decimal(5, 2),
  ChannelId varchar(50),
  CreatedAt datetime,
  UpdatedAt datetime,
  UpdatedBy varchar(50),
  LastCronTime datetime,
  LastUpdateTime datetime,
  LastAttemptedTime datetime,
  IsNCNeeded boolean,
  RepricingRule int,
  RequestIntervalUnit varchar(12),
  SuppressPriceBreak boolean,
  PriorityValue int,
  LastCronMessage varchar(1024),
  LowestVendor varchar(255),
  LowestVendorPrice varchar(255),
  LastExistingPrice varchar(255),
  LastSuggestedPrice varchar(255),
  NextCronTime datetime,
  BeatQPrice boolean,
  CompeteAll boolean,
  PercentageIncrease int,
  SuppressPriceBreakForOne boolean,
  CompareWithQ1 boolean,
  WaitUpdatePeriod boolean,
  LastCronRun varchar(50),
  AbortDeactivatingQPriceBreak boolean,
  BadgeIndicator varchar(50),
  BadgePercentage int,
  LastUpdatedBy varchar(50),
  InactiveVendorId varchar(50),
  IncludeInactiveVendors boolean,
  OverrideBulkRule int,
  OverrideBulkUpdate boolean,
  LatestPrice int,
  ExecutionPriority int,
  ApplyBuyBoxLogic boolean,
  ApplyNcForBuyBox boolean,
  primary key (Id)
);

CREATE INDEX idx_item_mvp_activated on table_mvpDetails (Activated);

ALTER TABLE table_scrapeProductList
ADD CONSTRAINT fk_nvp_details_id FOREIGN KEY (LinkedFrontiersDetailsInfo) REFERENCES table_mvpDetails (Id);

alter table table_tradentDetails
add column MpId int not null;

alter table table_frontierDetails
add column MpId int not null;

alter table table_mvpDetails
add column MpId int not null;

CREATE INDEX idx_item_mvp_mpid on table_mvpDetails (MpId);

CREATE INDEX idx_item_frontier_mpid on table_frontierDetails (MpId);

CREATE INDEX idx_item_tradent_mpid on table_tradentDetails (MpId);

ALTER TABLE table_mvpDetails
ADD UNIQUE unique_idx_mvp_mpid (MpId);

ALTER TABLE table_frontierDetails
ADD UNIQUE unique_idx_frontier_mpid (MpId);

ALTER TABLE table_tradentDetails
ADD UNIQUE unique_idx_tradent_mpid (MpId);

ALTER TABLE table_scrapeProductList
DROP FOREIGN KEY fk_tradent_details_id;

ALTER TABLE table_scrapeProductList
DROP FOREIGN KEY fk_frontier_details_id;

ALTER TABLE table_scrapeProductList
DROP FOREIGN KEY fk_nvp_details_id;

ALTER TABLE table_frontierDetails
ADD UNIQUE unique_idx_frontier_mpid (MpId);

ALTER TABLE table_tradentDetails
ADD UNIQUE unique_idx_tradent_mpid (MpId);

ALTER TABLE table_mvpDetails
MODIFY COLUMN UnitPrice decimal(10, 2);

ALTER TABLE table_mvpDetails
MODIFY COLUMN FloorPrice decimal(10, 2);

ALTER TABLE table_mvpDetails
MODIFY COLUMN MaxPrice decimal(10, 2);

ALTER TABLE table_tradentDetails
MODIFY COLUMN UnitPrice decimal(10, 2);

ALTER TABLE table_tradentDetails
MODIFY COLUMN FloorPrice decimal(10, 2);

ALTER TABLE table_tradentDetails
MODIFY COLUMN MaxPrice decimal(10, 2);

ALTER TABLE table_frontierDetails
MODIFY COLUMN UnitPrice decimal(10, 2);

ALTER TABLE table_frontierDetails
MODIFY COLUMN FloorPrice decimal(10, 2);

ALTER TABLE table_frontierDetails
MODIFY COLUMN MaxPrice decimal(10, 2);

ALTER TABLE table_scrapeProductList
add COLUMN IsSlowActivated boolean;

CREATE INDEX idx_product_is_slow_act on table_scrapeProductList (IsSlowActivated);

ALTER TABLE table_mvpDetails
MODIFY COLUMN MpId Int Unique;

ALTER TABLE table_frontierDetails
MODIFY COLUMN MpId Int Unique;

ALTER TABLE table_tradentDetails
MODIFY COLUMN MpId Int Unique;

alter table table_scrapeProductList
add column IsBadgeItem boolean;
