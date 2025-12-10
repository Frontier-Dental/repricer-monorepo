# Complete Guide: Adding a New Vendor to the Repricer System

## Overview

This document provides a comprehensive, step-by-step guide for adding a new vendor to the repricer monorepo system. The system currently supports 6 vendors: TRADENT, FRONTIER, MVP, TOPDENT, FIRSTDENT, and TRIAD. This guide will walk you through all necessary changes required to add a new vendor.

## Prerequisites

- Access to MySQL database (`repricerDb`)
- Understanding of the codebase structure
- Knowledge of TypeScript/JavaScript
- Understanding of EJS templating (for frontend views)
- Database migration tools (Knex.js)

---

## Step-by-Step Process

### Step 1: Database Schema - Create Vendor Details Table

**Location:** `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP1_INIT_TABLE_VENDOR_ADDITION_[VENDORNAME].sql`

Create a new SQL file following the pattern of existing vendors. For example, if adding "NEWVENDOR":

```sql
USE repricerDb;

CREATE TABLE "table_newVendorDetails" (
  "Id" int NOT NULL AUTO_INCREMENT,
  "ChannelName" varchar(50) DEFAULT NULL,
  "ScrapeOn" tinyint(1) DEFAULT NULL,
  "AllowReprice" tinyint(1) DEFAULT NULL,
  "Activated" tinyint(1) DEFAULT NULL,
  "UnitPrice" decimal(10, 2) DEFAULT NULL,
  "FocusId" varchar(50) DEFAULT NULL,
  "RequestInterval" int DEFAULT NULL,
  "FloorPrice" decimal(10, 2) DEFAULT NULL,
  "MaxPrice" decimal(10, 2) DEFAULT NULL,
  "ChannelId" varchar(50) DEFAULT NULL,
  "CreatedAt" datetime DEFAULT NULL,
  "UpdatedAt" datetime DEFAULT NULL,
  "UpdatedBy" varchar(50) DEFAULT NULL,
  "LastCronTime" datetime DEFAULT NULL,
  "LastUpdateTime" datetime DEFAULT NULL,
  "LastAttemptedTime" datetime DEFAULT NULL,
  "IsNCNeeded" tinyint(1) DEFAULT NULL,
  "RepricingRule" int DEFAULT NULL,
  "RequestIntervalUnit" varchar(12) DEFAULT NULL,
  "SuppressPriceBreak" tinyint(1) DEFAULT NULL,
  "PriorityValue" int DEFAULT NULL,
  "LastCronMessage" varchar(1024) DEFAULT NULL,
  "LowestVendor" varchar(255) DEFAULT NULL,
  "LowestVendorPrice" varchar(255) DEFAULT NULL,
  "LastExistingPrice" varchar(255) DEFAULT NULL,
  "LastSuggestedPrice" varchar(255) DEFAULT NULL,
  "NextCronTime" datetime DEFAULT NULL,
  "BeatQPrice" tinyint(1) DEFAULT NULL,
  "CompeteAll" tinyint(1) DEFAULT NULL,
  "PercentageIncrease" int DEFAULT NULL,
  "SuppressPriceBreakForOne" tinyint(1) DEFAULT NULL,
  "CompareWithQ1" tinyint(1) DEFAULT NULL,
  "WaitUpdatePeriod" tinyint(1) DEFAULT NULL,
  "LastCronRun" varchar(50) DEFAULT NULL,
  "AbortDeactivatingQPriceBreak" tinyint(1) DEFAULT NULL,
  "BadgeIndicator" varchar(50) DEFAULT NULL,
  "BadgePercentage" int DEFAULT NULL,
  "LastUpdatedBy" varchar(50) DEFAULT NULL,
  "InactiveVendorId" varchar(50) DEFAULT NULL,
  "IncludeInactiveVendors" tinyint(1) DEFAULT NULL,
  "OverrideBulkRule" int DEFAULT NULL,
  "OverrideBulkUpdate" tinyint(1) DEFAULT NULL,
  "LatestPrice" int DEFAULT NULL,
  "ExecutionPriority" int DEFAULT NULL,
  "ApplyBuyBoxLogic" tinyint(1) DEFAULT NULL,
  "ApplyNcForBuyBox" tinyint(1) DEFAULT NULL,
  "MpId" int DEFAULT NULL,
  "SisterVendorId" varchar(255) DEFAULT NULL,
  "HandlingTimeFilter" varchar(50) DEFAULT NULL,
  "KeepPosition" tinyint(1) DEFAULT NULL,
  "InventoryThreshold" int DEFAULT NULL,
  "ExcludedVendors" varchar(255) DEFAULT NULL,
  "BadgePercentageDown" decimal(5, 3) DEFAULT NULL,
  "PercentageDown" decimal(5, 3) DEFAULT NULL,
  "CompeteWithNext" tinyint(1) DEFAULT NULL,
  "IgnorePhantomBreak" tinyint(1) DEFAULT NULL,
  "OwnVendorThreshold" int DEFAULT NULL,
  "GetBBBadge" tinyint(1) DEFAULT NULL,
  "GetBBShipping" tinyint(1) DEFAULT NULL,
  "GetBBBadgeValue" decimal(5, 3) DEFAULT NULL,
  "GetBBShippingValue" decimal(5, 3) DEFAULT NULL,
  "CurrentInStock" tinyint(1) DEFAULT NULL,
  "CurrentInventory" int DEFAULT NULL,
  "OurLastPrice" decimal(10, 2) DEFAULT NULL,
  "MarketStateUpdatedAt" timestamp DEFAULT NULL,
  PRIMARY KEY ("Id"),
  UNIQUE KEY "unique_idx_newvendor_mpid" ("MpId"),
  KEY "idx_item_newvendor_activated" ("Activated"),
  KEY "idx_item_newvendor_mpid" ("MpId"),
  KEY "idx_table_newvendor_in_stock" ("CurrentInStock")
);
```

**Key Points:**
- Table name format: `table_[vendorName]Details` (camelCase)
- Must include `MpId` as foreign key to `table_scrapeProductList`
- Include all standard vendor fields
- Add market state fields: `CurrentInStock`, `CurrentInventory`, `OurLastPrice`, `MarketStateUpdatedAt`
- Create appropriate indexes

---

### Step 2: Alter Master Product Table

**Location:** `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP2_ALTER_SCRAPE_PRODUCT_LIST.sql`

Add a new column to link the vendor details table:

```sql
USE repricerDb;

ALTER TABLE table_scrapeProductList
ADD COLUMN LinkedNewVendorDetailsInfo int;

-- Verify the change
SELECT * FROM table_scrapeProductList LIMIT 1;
```

**Note:** This step may already be partially done if other vendors were added. Check existing file and append if needed.

---

### Step 3: Populate Vendor Details Table with Initial Data

**Location:** `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP3_INSERT_DATA_[VENDORNAME]_TABLE.sql`

Create initial records for all existing products:

```sql
USE repricerDb;

INSERT INTO table_newVendorDetails (
  MpId,
  ChannelName,
  ScrapeOn,
  AllowReprice,
  Activated,
  UnitPrice,
  FocusId,
  RequestInterval,
  FloorPrice,
  MaxPrice,
  ChannelId,
  CreatedAt,
  UpdatedAt,
  UpdatedBy,
  LastCronTime,
  LastUpdateTime,
  LastAttemptedTime,
  IsNCNeeded,
  RepricingRule,
  RequestIntervalUnit,
  SuppressPriceBreak,
  PriorityValue,
  LastCronMessage,
  LowestVendor,
  LowestVendorPrice,
  LastExistingPrice,
  LastSuggestedPrice,
  NextCronTime,
  BeatQPrice,
  CompeteAll,
  PercentageIncrease,
  SuppressPriceBreakForOne,
  CompareWithQ1,
  WaitUpdatePeriod,
  LastCronRun,
  AbortDeactivatingQPriceBreak,
  BadgeIndicator,
  BadgePercentage,
  LastUpdatedBy,
  InactiveVendorId,
  IncludeInactiveVendors,
  OverrideBulkRule,
  OverrideBulkUpdate,
  LatestPrice,
  ExecutionPriority,
  ApplyBuyBoxLogic,
  ApplyNcForBuyBox
)
SELECT
  MpId,
  NULL, -- ChannelName
  NULL, -- ScrapeOn
  NULL, -- AllowReprice
  NULL, -- Activated
  NULL, -- UnitPrice
  NULL, -- FocusId
  NULL, -- RequestInterval
  NULL, -- FloorPrice
  NULL, -- MaxPrice
  NULL, -- ChannelId
  NULL, -- CreatedAt
  NULL, -- UpdatedAt
  NULL, -- UpdatedBy
  NULL, -- LastCronTime
  NULL, -- LastUpdateTime
  NULL, -- LastAttemptedTime
  NULL, -- IsNCNeeded
  NULL, -- RepricingRule
  NULL, -- RequestIntervalUnit
  NULL, -- SuppressPriceBreak
  NULL, -- PriorityValue
  NULL, -- LastCronMessage
  NULL, -- LowestVendor
  NULL, -- LowestVendorPrice
  NULL, -- LastExistingPrice
  NULL, -- LastSuggestedPrice
  NULL, -- NextCronTime
  NULL, -- BeatQPrice
  NULL, -- CompeteAll
  NULL, -- PercentageIncrease
  NULL, -- SuppressPriceBreakForOne
  NULL, -- CompareWithQ1
  NULL, -- WaitUpdatePeriod
  NULL, -- LastCronRun
  NULL, -- AbortDeactivatingQPriceBreak
  NULL, -- BadgeIndicator
  NULL, -- BadgePercentage
  NULL, -- LastUpdatedBy
  NULL, -- InactiveVendorId
  NULL, -- IncludeInactiveVendors
  NULL, -- OverrideBulkRule
  NULL, -- OverrideBulkUpdate
  NULL, -- LatestPrice
  NULL, -- ExecutionPriority
  NULL, -- ApplyBuyBoxLogic
  NULL  -- ApplyNcForBuyBox
FROM table_scrapeProductList;

-- Verify insertion
SELECT COUNT(*) as total_records FROM table_newVendorDetails;
```

---

### Step 4: Link Vendor Data to Root Product Table

**Location:** `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP4_LINK_VENDORDATA_ROOT.sql`

Update the master product table to link vendor details:

```sql
USE repricerDb;

UPDATE table_scrapeProductList scpl
JOIN table_newVendorDetails nv ON scpl.MpId = nv.MpId
SET scpl.LinkedNewVendorDetailsInfo = nv.Id;

-- Verify the links
SELECT 
  scpl.MpId,
  scpl.LinkedNewVendorDetailsInfo,
  nv.Id as VendorDetailsId
FROM table_scrapeProductList scpl
JOIN table_newVendorDetails nv ON scpl.MpId = nv.MpId
LIMIT 10;
```

---

### Step 5: Create Upsert Stored Procedure

**Location:** `apps/repricer/MYSQL/UPSERT_VENDOR/sp_UpsertNewVendorDetails.sql`

Create a stored procedure for inserting/updating vendor data:

```sql
USE repricerDb;

DROP PROCEDURE IF EXISTS sp_UpsertNewVendorDetails;

DELIMITER //

CREATE PROCEDURE sp_UpsertNewVendorDetails (
  IN mpid int,
  IN channelname varchar(50),
  IN scrapeon boolean,
  IN allowreprice boolean,
  IN activated boolean,
  IN unitprice decimal(10, 2),
  IN focusid varchar(50),
  IN requestinterval int,
  IN floorprice decimal(10, 2),
  IN maxprice decimal(10, 2),
  IN channelid varchar(50),
  IN createdat varchar(50),
  IN updatedat varchar(50),
  IN updatedby varchar(50),
  IN lastcrontime varchar(50),
  IN lastupdatetime varchar(50),
  IN lastattemptedtime varchar(50),
  IN isncneeded boolean,
  IN repricingrule int,
  IN requestintervalunit varchar(12),
  IN suppresspricebreak boolean,
  IN priorityvalue int,
  IN lastcronmessage varchar(1024),
  IN lowestvendor varchar(255),
  IN lowestvendorprice varchar(255),
  IN lastexistingprice varchar(255),
  IN lastsuggestedprice varchar(255),
  IN nextcrontime varchar(50),
  IN beatqprice boolean,
  IN competeall boolean,
  IN percentageincrease int,
  IN suppresspricebreakforone boolean,
  IN comparewithq1 boolean,
  IN waitupdateperiod boolean,
  IN lastcronrun varchar(50),
  IN abortdeactivatingqpricebreak boolean,
  IN badgeindicator varchar(50),
  IN badgepercentage int,
  IN lastupdatedby varchar(50),
  IN inactivevendorid varchar(50),
  IN includeinactivevendors boolean,
  IN overridebulkrule int,
  IN overridebulkupdate boolean,
  IN latestprice int,
  IN executionpriority int,
  IN applybuyboxlogic boolean,
  IN applyncforbuybox boolean,
  IN sisterVendorId varchar(255),
  IN handlingTimeFilter varchar(50),
  IN keepPosition boolean,
  IN excludedVendors VARCHAR(255),
  IN inventoryThreshold int,
  IN _repriceDown decimal(5, 3),
  IN _badgeDown decimal(5, 3),
  IN competeWithNext boolean,
  IN _ignorePhantomBreak boolean,
  IN ownVendorThreshold int,
  IN getBBBadge boolean,
  IN getBBShipping boolean,
  IN getBBBadgeValue decimal(5, 3),
  IN getBBShippingValue decimal(5, 3)
) 
BEGIN 
  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
  END;

  START TRANSACTION;

  INSERT INTO table_newVendorDetails (
    MpId, ChannelName, ScrapeOn, AllowReprice, Activated,
    UnitPrice, FocusId, RequestInterval, FloorPrice, MaxPrice,
    ChannelId, CreatedAt, UpdatedAt, UpdatedBy, LastCronTime,
    LastUpdateTime, LastAttemptedTime, IsNCNeeded, RepricingRule,
    RequestIntervalUnit, SuppressPriceBreak, PriorityValue,
    LastCronMessage, LowestVendor, LowestVendorPrice,
    LastExistingPrice, LastSuggestedPrice, NextCronTime,
    BeatQPrice, CompeteAll, PercentageIncrease,
    SuppressPriceBreakForOne, CompareWithQ1, WaitUpdatePeriod,
    LastCronRun, AbortDeactivatingQPriceBreak, BadgeIndicator,
    BadgePercentage, LastUpdatedBy, InactiveVendorId,
    IncludeInactiveVendors, OverrideBulkRule, OverrideBulkUpdate,
    LatestPrice, ExecutionPriority, ApplyBuyBoxLogic,
    ApplyNcForBuyBox, SisterVendorId, HandlingTimeFilter,
    KeepPosition, ExcludedVendors, InventoryThreshold,
    PercentageDown, BadgePercentageDown, CompeteWithNext,
    IgnorePhantomBreak, OwnVendorThreshold, GetBBBadge,
    GetBBShipping, GetBBBadgeValue, GetBBShippingValue
  )
  VALUES (
    mpid, channelname, scrapeon, allowreprice, activated,
    unitprice, focusid, requestinterval, floorprice, maxprice,
    channelid, STR_TO_DATE(createdat, '%Y-%m-%d %H:%i:%s'),
    STR_TO_DATE(updatedat, '%Y-%m-%d %H:%i:%s'), updatedby,
    STR_TO_DATE(lastcrontime, '%Y-%m-%d %H:%i:%s'),
    STR_TO_DATE(lastupdatetime, '%Y-%m-%d %H:%i:%s'),
    STR_TO_DATE(lastattemptedtime, '%Y-%m-%d %H:%i:%s'),
    isncneeded, repricingrule, requestintervalunit,
    suppresspricebreak, priorityvalue, lastcronmessage,
    lowestvendor, lowestvendorprice, lastexistingprice,
    lastsuggestedprice, STR_TO_DATE(nextcrontime, '%Y-%m-%d %H:%i:%s'),
    beatqprice, competeall, percentageincrease,
    suppresspricebreakforone, comparewithq1, waitupdateperiod,
    lastcronrun, abortdeactivatingqpricebreak, badgeindicator,
    badgepercentage, lastupdatedby, inactivevendorid,
    includeinactivevendors, overridebulkrule, overridebulkupdate,
    latestprice, executionpriority, applybuyboxlogic,
    applyncforbuybox, sisterVendorId, handlingTimeFilter,
    keepPosition, excludedVendors, inventoryThreshold,
    _repriceDown, _badgeDown, competeWithNext,
    _ignorePhantomBreak, ownVendorThreshold, getBBBadge,
    getBBShipping, getBBBadgeValue, getBBShippingValue
  )
  ON DUPLICATE KEY UPDATE
    ChannelName = channelname,
    ScrapeOn = scrapeon,
    AllowReprice = allowreprice,
    Activated = activated,
    UnitPrice = unitprice,
    FocusId = focusid,
    RequestInterval = requestinterval,
    FloorPrice = floorprice,
    MaxPrice = maxprice,
    ChannelId = channelid,
    UpdatedAt = STR_TO_DATE(updatedat, '%Y-%m-%d %H:%i:%s'),
    UpdatedBy = updatedby,
    LastCronTime = STR_TO_DATE(lastcrontime, '%Y-%m-%d %H:%i:%s'),
    LastUpdateTime = STR_TO_DATE(lastupdatetime, '%Y-%m-%d %H:%i:%s'),
    LastAttemptedTime = STR_TO_DATE(lastattemptedtime, '%Y-%m-%d %H:%i:%s'),
    IsNCNeeded = isncneeded,
    RepricingRule = repricingrule,
    RequestIntervalUnit = requestintervalunit,
    SuppressPriceBreak = suppresspricebreak,
    PriorityValue = priorityvalue,
    LastCronMessage = lastcronmessage,
    LowestVendor = lowestvendor,
    LowestVendorPrice = lowestvendorprice,
    LastExistingPrice = lastexistingprice,
    LastSuggestedPrice = lastsuggestedprice,
    NextCronTime = STR_TO_DATE(nextcrontime, '%Y-%m-%d %H:%i:%s'),
    BeatQPrice = beatqprice,
    CompeteAll = competeall,
    PercentageIncrease = percentageincrease,
    SuppressPriceBreakForOne = suppresspricebreakforone,
    CompareWithQ1 = comparewithq1,
    WaitUpdatePeriod = waitupdateperiod,
    LastCronRun = lastcronrun,
    AbortDeactivatingQPriceBreak = abortdeactivatingqpricebreak,
    BadgeIndicator = badgeindicator,
    BadgePercentage = badgepercentage,
    LastUpdatedBy = lastupdatedby,
    InactiveVendorId = inactivevendorid,
    IncludeInactiveVendors = includeinactivevendors,
    OverrideBulkRule = overridebulkrule,
    OverrideBulkUpdate = overridebulkupdate,
    LatestPrice = latestprice,
    ExecutionPriority = executionpriority,
    ApplyBuyBoxLogic = applybuyboxlogic,
    ApplyNcForBuyBox = applyncforbuybox,
    SisterVendorId = sisterVendorId,
    HandlingTimeFilter = handlingTimeFilter,
    KeepPosition = keepPosition,
    ExcludedVendors = excludedVendors,
    InventoryThreshold = inventoryThreshold,
    PercentageDown = _repriceDown,
    BadgePercentageDown = _badgeDown,
    CompeteWithNext = competeWithNext,
    IgnorePhantomBreak = _ignorePhantomBreak,
    OwnVendorThreshold = ownVendorThreshold,
    GetBBBadge = getBBBadge,
    GetBBShipping = getBBShipping,
    GetBBBadgeValue = getBBBadgeValue,
    GetBBShippingValue = getBBShippingValue;

  SELECT LAST_INSERT_ID() as updatedIdentifier;

  COMMIT;
END //

DELIMITER ;
```

**Key Points:**
- Procedure name format: `sp_Upsert[VendorName]Details`
- Uses `ON DUPLICATE KEY UPDATE` for upsert logic
- Returns `updatedIdentifier` (the Id of the record)

---

### Step 6: Create Update Stored Procedure

**Location:** `apps/repricer/MYSQL/UPDATE_VENDOR/sp_UpdateNewVendorDetailsById.sql`

Create a stored procedure for updating vendor data by MpId:

```sql
USE repricerDb;

DROP PROCEDURE IF EXISTS sp_UpdateNewVendorDetailsById;

DELIMITER //

CREATE PROCEDURE sp_UpdateNewVendorDetailsById (
  IN _mpid int,
  IN _channelname varchar(50),
  IN _scrapeon boolean,
  IN _allowreprice boolean,
  IN _activated boolean,
  IN _unitprice decimal(10, 2),
  IN _focusid varchar(50),
  IN _requestinterval int,
  IN _floorprice decimal(10, 2),
  IN _maxprice decimal(10, 2),
  IN _channelid varchar(50),
  IN _updatedat varchar(50),
  IN _updatedby varchar(50),
  IN _lastcrontime varchar(50),
  IN _lastupdatetime varchar(50),
  IN _lastattemptedtime varchar(50),
  IN _isncneeded boolean,
  IN _repricingrule int,
  IN _requestintervalunit varchar(12),
  IN _suppresspricebreak boolean,
  IN _priorityvalue int,
  IN _lastcronmessage varchar(1024),
  IN _lowestvendor varchar(255),
  IN _lowestvendorprice varchar(255),
  IN _lastexistingprice varchar(255),
  IN _lastsuggestedprice varchar(255),
  IN _nextcrontime varchar(50),
  IN _beatqprice boolean,
  IN _competeall boolean,
  IN _percentageincrease int,
  IN _suppresspricebreakforone boolean,
  IN _comparewithq1 boolean,
  IN _waitupdateperiod boolean,
  IN _lastcronrun varchar(50),
  IN _abortdeactivatingqpricebreak boolean,
  IN _badgeindicator varchar(50),
  IN _badgepercentage int,
  IN _lastupdatedby varchar(50),
  IN _inactivevendorid varchar(50),
  IN _includeinactivevendors boolean,
  IN _overridebulkrule int,
  IN _overridebulkupdate boolean,
  IN _latestprice int,
  IN _executionpriority int,
  IN _applybuyboxlogic boolean,
  IN _applyncforbuybox boolean,
  IN _sisterVendorId VARCHAR(255),
  IN _handlingTimeFilter VARCHAR(50),
  IN _keepPosition boolean,
  IN _excludedVendors VARCHAR(255),
  IN _inventoryThreshold int,
  IN _repriceDown decimal(5, 3),
  IN _badgeDown decimal(5, 3),
  IN _competeWithNext boolean,
  IN _ignorePhantomBreak boolean,
  IN _ownVendorThreshold int,
  IN _getBBBadge boolean,
  IN _getBBShipping boolean,
  IN _getBBBadgeValue decimal(5, 3),
  IN _getBBShippingValue decimal(5, 3)
) 
BEGIN
  UPDATE table_newVendorDetails
  SET
    ChannelName = _channelname,
    ScrapeOn = _scrapeon,
    AllowReprice = _allowreprice,
    Activated = _activated,
    UnitPrice = _unitprice,
    FocusId = _focusid,
    RequestInterval = _requestinterval,
    FloorPrice = _floorprice,
    MaxPrice = _maxprice,
    ChannelId = _channelid,
    UpdatedAt = STR_TO_DATE(_updatedat, '%Y-%m-%d %H:%i:%s'),
    UpdatedBy = _updatedby,
    LastCronTime = STR_TO_DATE(_lastcrontime, '%Y-%m-%d %H:%i:%s'),
    LastUpdateTime = STR_TO_DATE(_lastupdatetime, '%Y-%m-%d %H:%i:%s'),
    LastAttemptedTime = STR_TO_DATE(_lastattemptedtime, '%Y-%m-%d %H:%i:%s'),
    IsNCNeeded = _isncneeded,
    RepricingRule = _repricingrule,
    RequestIntervalUnit = _requestintervalunit,
    SuppressPriceBreak = _suppresspricebreak,
    PriorityValue = _priorityvalue,
    LastCronMessage = _lastcronmessage,
    LowestVendor = _lowestvendor,
    LowestVendorPrice = _lowestvendorprice,
    LastExistingPrice = _lastexistingprice,
    LastSuggestedPrice = _lastsuggestedprice,
    NextCronTime = STR_TO_DATE(_nextcrontime, '%Y-%m-%d %H:%i:%s'),
    BeatQPrice = _beatqprice,
    CompeteAll = _competeall,
    PercentageIncrease = _percentageincrease,
    SuppressPriceBreakForOne = _suppresspricebreakforone,
    CompareWithQ1 = _comparewithq1,
    WaitUpdatePeriod = _waitupdateperiod,
    LastCronRun = _lastcronrun,
    AbortDeactivatingQPriceBreak = _abortdeactivatingqpricebreak,
    BadgeIndicator = _badgeindicator,
    BadgePercentage = _badgepercentage,
    LastUpdatedBy = _lastupdatedby,
    InactiveVendorId = _inactivevendorid,
    IncludeInactiveVendors = _includeinactivevendors,
    OverrideBulkRule = _overridebulkrule,
    OverrideBulkUpdate = _overridebulkupdate,
    LatestPrice = _latestprice,
    ExecutionPriority = _executionpriority,
    ApplyBuyBoxLogic = _applybuyboxlogic,
    ApplyNcForBuyBox = _applyncforbuybox,
    SisterVendorId = _sisterVendorId,
    HandlingTimeFilter = _handlingTimeFilter,
    KeepPosition = _keepPosition,
    ExcludedVendors = _excludedVendors,
    InventoryThreshold = _inventoryThreshold,
    PercentageDown = _repriceDown,
    BadgePercentageDown = _badgeDown,
    CompeteWithNext = _competeWithNext,
    IgnorePhantomBreak = _ignorePhantomBreak,
    OwnVendorThreshold = _ownVendorThreshold,
    GetBBBadge = _getBBBadge,
    GetBBShipping = _getBBShipping,
    GetBBBadgeValue = _getBBBadgeValue,
    GetBBShippingValue = _getBBShippingValue
  WHERE MpId = _mpid;

  COMMIT;
END //

DELIMITER ;
```

---

### Step 7: Update Shared Package - Add Vendor Enum

**Location:** `packages/shared/src/index.ts`

Add the new vendor to the enums:

```typescript
export enum VendorId {
  FRONTIER = 20722,
  TRADENT = 17357,
  MVP = 20755,
  TOPDENT = 20727,
  FIRSTDENT = 20533,
  TRIAD = 5,
  NEWVENDOR = 12345, // Add your vendor ID here
}

export enum VendorName {
  FRONTIER = "FRONTIER",
  MVP = "MVP",
  TRADENT = "TRADENT",
  FIRSTDENT = "FIRSTDENT",
  TOPDENT = "TOPDENT",
  TRIAD = "TRIAD",
  NEWVENDOR = "NEWVENDOR", // Add your vendor name here
}

export const VendorNameLookup: Record<number, VendorName> = {
  [VendorId.FRONTIER]: VendorName.FRONTIER,
  [VendorId.TRADENT]: VendorName.TRADENT,
  [VendorId.MVP]: VendorName.MVP,
  [VendorId.TOPDENT]: VendorName.TOPDENT,
  [VendorId.FIRSTDENT]: VendorName.FIRSTDENT,
  [VendorId.TRIAD]: VendorName.TRIAD,
  [VendorId.NEWVENDOR]: VendorName.NEWVENDOR, // Add mapping
};

export const VendorIdLookup: Record<VendorName, VendorId> = {
  [VendorName.FRONTIER]: VendorId.FRONTIER,
  [VendorName.TRADENT]: VendorId.TRADENT,
  [VendorName.MVP]: VendorId.MVP,
  [VendorName.TOPDENT]: VendorId.TOPDENT,
  [VendorName.FIRSTDENT]: VendorId.FIRSTDENT,
  [VendorName.TRIAD]: VendorId.TRIAD,
  [VendorName.NEWVENDOR]: VendorId.NEWVENDOR, // Add mapping
};
```

**Important:** Replace `NEWVENDOR` with your actual vendor name and use the correct vendor ID from your system.

---

### Step 8: Update Configuration Files

**Location:** `apps/repricer/src/utility/config.ts` and `apps/api-core/src/utility/config.ts`

Add stored procedure names to the configuration:

```typescript
// In envSchema, add:
SQL_SP_UPSERT_NEWVENDOR: z.string().default("sp_UpsertNewVendorDetails"),
SQL_SP_UPDATE_NEWVENDOR: z.string().default("sp_UpdateNewVendorDetailsById"),
SQL_NEWVENDOR_DETAILS: z.string().default("table_newVendorDetails"),
```

Also add to `applicationConfig` if there are direct references.

---

### Step 9: Update MySQL Helper Functions

**Location:** `apps/repricer/src/services/mysql.ts` and `apps/api-core/src/utility/mysql/mysql-helper.ts`

#### 9.1 Update UpsertVendorData Function

In `apps/repricer/src/services/mysql.ts`, add the new vendor case:

```typescript
export async function UpsertVendorData(payload: any, vendorName: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let contextSpName: any = null;
    switch (vendorName) {
      case "TRADENT":
        contextSpName = applicationConfig.SQL_SP_UPSERT_TRADENT;
        break;
      case "FRONTIER":
        contextSpName = applicationConfig.SQL_SP_UPSERT_FRONTIER;
        break;
      case "MVP":
        contextSpName = applicationConfig.SQL_SP_UPSERT_MVP;
        break;
      case "TOPDENT":
        contextSpName = applicationConfig.SQL_SP_UPSERT_TOPDENT;
        break;
      case "FIRSTDENT":
        contextSpName = applicationConfig.SQL_SP_UPSERT_FIRSTDENT;
        break;
      case "TRIAD":
        contextSpName = applicationConfig.SQL_SP_UPSERT_TRIAD;
        break;
      case "NEWVENDOR": // Add this case
        contextSpName = applicationConfig.SQL_SP_UPSERT_NEWVENDOR;
        break;
      default:
        break;
    }
    // ... rest of the function remains the same
  }
}
```

**Note:** Apply the same change to:
- `apps/excel-export/src/services/mysql.ts`
- `apps/repricer/src/middleware/mysql.ts`

#### 9.2 Update getContextTableNameByVendorName Function

In `apps/api-core/src/utility/mysql/mysql-helper.ts`:

```typescript
function getContextTableNameByVendorName(contextVendor: string) {
  let contextTableName: string | null = null;
  if (contextVendor === VendorName.TRADENT) {
    contextTableName = applicationConfig.SQL_TRADENT_DETAILS;
  } else if (contextVendor === VendorName.FRONTIER) {
    contextTableName = applicationConfig.SQL_FRONTIER_DETAILS;
  } else if (contextVendor === VendorName.MVP) {
    contextTableName = applicationConfig.SQL_MVP_DETAILS;
  } else if (contextVendor === VendorName.TOPDENT) {
    contextTableName = applicationConfig.SQL_TOPDENT_DETAILS;
  } else if (contextVendor === VendorName.FIRSTDENT) {
    contextTableName = applicationConfig.SQL_FIRSTDENT_DETAILS;
  } else if (contextVendor === VendorName.TRIAD) {
    contextTableName = applicationConfig.SQL_TRIAD_DETAILS;
  } else if (contextVendor === VendorName.NEWVENDOR) { // Add this
    contextTableName = applicationConfig.SQL_NEWVENDOR_DETAILS;
  }
  return contextTableName;
}
```

---

### Step 10: Update Product Controllers

**Location:** `apps/repricer/src/controllers/product-v2.ts`

In the `updateProductDetails` function, add handling for the new vendor:

```typescript
export async function updateProductDetails(req: Request, res: Response) {
  var details = req.body;
  // ... existing code ...
  
  if (details.channel_name.toUpperCase() == "TRADENT") {
    // ... existing TRADENT handling ...
  }
  if (details.channel_name.toUpperCase() == "FRONTIER") {
    // ... existing FRONTIER handling ...
  }
  // ... other vendors ...
  
  // Add new vendor handling
  if (details.channel_name.toUpperCase() == "NEWVENDOR") {
    productDetails.newVendorDetails = await mapper.MapUserResponse(
      productDetails.newVendorDetails,
      details,
      cronSettingsResponse,
    );
    productDetails.newVendorDetails.isScrapeOnlyActivated =
      productDetails.isScrapeOnlyActivated;
    productDetails.newVendorDetails.scrapeOnlyCronId =
      productDetails.scrapeOnlyCronId;
    productDetails.newVendorDetails.scrapeOnlyCronName =
      productDetails.scrapeOnlyCronName;
    productDetails.newVendorDetails.isBadgeItem = productDetails.isBadgeItem;
    // Set other vendor details to null
    productDetails.tradentDetails = null;
    productDetails.frontierDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
    productDetails.triadDetails = null;
  }
  
  // ... rest of the function
}
```

---

### Step 11: Create Frontend View Files

#### 11.1 Edit View Partial

**Location:** `apps/repricer/views/pages/products/partials/newvendor.ejs`

Create a view file for editing vendor details. Copy from an existing vendor (e.g., `firstdent.ejs`) and modify:

```ejs
<div class="card">
  <div class="card-body">
    <% if(model.newVendorDetails!=null){ %>
      <form method="post" autocomplete="off" id="update_product_form_newvendor">
        <input type="hidden" value="NewVendor" name="vendors" />
        <input type="hidden" value="<%= model.mpId %>" name="mpid" />
        <div class="row no-gutters">
          <div class="form-group col-3">
            <label for="channel_name" class="font-weight-bold">
              Channel Name <span style="color: red;font-weight: bold;">*</span>
            </label>
            <input type="text" class="form-control" 
                   value="<%= model.newVendorDetails.channelName %>"
                   name="channel_name" placeholder="Channel Name"/>
          </div>
          <!-- Add all other form fields following the pattern -->
        </div>
        <!-- Submit button and other form elements -->
      </form>
    <% } %>
  </div>
</div>
```

#### 11.2 Add View Partial

**Location:** `apps/repricer/views/pages/products/add-partials/addnewvendor.ejs`

Create a view file for adding new products with this vendor. Follow the same pattern as other vendors.

#### 11.3 Update Main Product View

**Location:** `apps/repricer/views/pages/products/get_all.ejs`

Add the new vendor to the product detail view. Search for where other vendors are included and add:

```ejs
<% if(model.newVendorDetails!=null){ %>
  <%- include('../partials/newvendor') %>
<% } %>
```

Also add to the "Add Product" form section.

---

### Step 12: Update Mapper Helper

**Location:** `apps/repricer/src/middleware/mapper-helper.ts` and `apps/repricer/src/utility/mapper/mysql-mapper.ts`

Ensure the mapper functions handle the new vendor. Check for any vendor-specific mapping logic and add the new vendor case.

---

### Step 13: Update Scrape Helper (if applicable)

**Location:** `apps/api-core/src/utility/scrape-helper.ts`

If the vendor requires special scraping logic, add vendor-specific handling here.

---

### Step 14: Update Repricing Algorithm (if applicable)

**Location:** `apps/api-core/src/utility/reprice-algo/`

If the vendor needs special repricing logic, update the relevant algorithm files.

---

### Step 15: Testing Checklist

After completing all steps, test the following:

1. **Database Tests:**
   - [ ] Verify table creation
   - [ ] Verify stored procedures execute correctly
   - [ ] Test upsert functionality
   - [ ] Test update functionality
   - [ ] Verify foreign key relationships

2. **Backend Tests:**
   - [ ] Test `UpsertVendorData` with new vendor name
   - [ ] Test product update endpoint with new vendor
   - [ ] Test product retrieval includes new vendor data
   - [ ] Verify mapper functions work correctly

3. **Frontend Tests:**
   - [ ] Verify vendor appears in product detail view
   - [ ] Test adding new product with new vendor
   - [ ] Test updating existing product with new vendor
   - [ ] Verify form submission works correctly

4. **Integration Tests:**
   - [ ] Test cron job execution with new vendor
   - [ ] Test scraping functionality (if applicable)
   - [ ] Test repricing functionality (if applicable)
   - [ ] Verify data flows correctly through the system

---

## Summary of Files to Modify/Create

### Database Files (SQL)
1. `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP1_INIT_TABLE_VENDOR_ADDITION_[VENDOR].sql`
2. `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP2_ALTER_SCRAPE_PRODUCT_LIST.sql` (may need update)
3. `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP3_INSERT_DATA_[VENDOR]_TABLE.sql`
4. `apps/repricer/MYSQL/NEW_VENDOR_ADDITION/STEP4_LINK_VENDORDATA_ROOT.sql` (may need update)
5. `apps/repricer/MYSQL/UPSERT_VENDOR/sp_Upsert[Vendor]Details.sql`
6. `apps/repricer/MYSQL/UPDATE_VENDOR/sp_Update[Vendor]DetailsById.sql`

### TypeScript/JavaScript Files
1. `packages/shared/src/index.ts` - Add vendor enums
2. `apps/repricer/src/utility/config.ts` - Add config values
3. `apps/api-core/src/utility/config.ts` - Add config values
4. `apps/repricer/src/services/mysql.ts` - Update switch statement
5. `apps/api-core/src/utility/mysql/mysql-helper.ts` - Update helper functions
6. `apps/repricer/src/controllers/product-v2.ts` - Add vendor handling
7. `apps/db-migrations/migrations/*.ts` - Update vendor configs (if needed)

### Frontend View Files
1. `apps/repricer/views/pages/products/partials/[vendor].ejs` - Edit view
2. `apps/repricer/views/pages/products/add-partials/add[vendor].ejs` - Add view
3. `apps/repricer/views/pages/products/get_all.ejs` - Include new vendor

---

## Important Notes

1. **Vendor ID:** Ensure you have the correct vendor ID from your system. This is typically a numeric identifier used in the Net32 system.

2. **Naming Conventions:**
   - Table names: `table_[vendorName]Details` (camelCase)
   - Stored procedures: `sp_Upsert[VendorName]Details`, `sp_Update[VendorName]DetailsById`
   - Enum values: UPPERCASE (e.g., `NEWVENDOR`)

3. **Case Sensitivity:** Vendor names in switch statements and comparisons are typically case-sensitive. Use consistent casing throughout.

4. **Backward Compatibility:** Ensure new changes don't break existing functionality for other vendors.

5. **Migration Order:** Execute SQL scripts in the correct order (STEP1 → STEP2 → STEP3 → STEP4).

6. **Testing:** Thoroughly test in a development environment before deploying to production.

---

## Troubleshooting

### Common Issues:

1. **Stored Procedure Not Found:**
   - Verify procedure name matches configuration
   - Check database connection
   - Ensure procedure was created successfully

2. **Table Not Found:**
   - Verify table name in configuration matches actual table name
   - Check database schema

3. **Vendor Not Appearing in UI:**
   - Check view files are included correctly
   - Verify vendor name matches in all switch statements
   - Check browser console for JavaScript errors

4. **Data Not Saving:**
   - Verify stored procedure parameters match function call
   - Check database constraints and foreign keys
   - Review error logs

---

## Additional Resources

- Existing vendor implementations can be used as reference:
  - FIRSTDENT: Most recent addition, good reference
  - TRIAD: Another recent addition
  - TRADENT/FRONTIER/MVP: Original vendors

- Database schema documentation: See `apps/repricer/MYSQL/INIT_TABLE_CREATION.sql`

- Migration examples: See `apps/db-migrations/migrations/` for vendor-related migrations

---

