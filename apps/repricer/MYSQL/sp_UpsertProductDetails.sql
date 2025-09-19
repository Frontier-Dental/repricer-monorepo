use repricerDb;

DROP PROCEDURE IF EXISTS sp_UpsertProductDetails;

delimiter / /
CREATE PROCEDURE sp_UpsertProductDetails (
  IN _mpid int,
  IN _active boolean,
  IN _url varchar(555),
  IN _cronName varchar(50),
  IN _cronId varchar(50),
  IN _updatedBy varchar(50),
  IN _updatedAt varchar(50),
  IN _isBadgeItem boolean
) BEGIN DECLARE mpid int;

DECLARE isActive boolean;

DECLARE net32Url varchar(555);

DECLARE cronName varchar(50);

DECLARE cronId varchar(50);

DECLARE updatedBy varchar(50);

DECLARE updatedAt varchar(50);

SET
  mpid = _mpid;

SET
  isActive = _active;

SET
  net32Url = _url;

SET
  cronName = _cronName;

SET
  cronId = _cronId;

SET
  updatedBy = _updatedBy;

SET
  updatedAt = _updatedAt;

INSERT INTO
  table_scrapeProductList (
    MpId,
    Net32Url,
    IsActive,
    LinkedCronName,
    LinkedCronId,
    LastUpdatedAt,
    LastUpdatedBy,
    IsBadgeItem
  )
values
  (
    mpid,
    net32Url,
    isActive,
    cronName,
    cronId,
    updatedAt,
    updatedBy,
    _isBadgeItem
  )
ON DUPLICATE KEY UPDATE
  Net32Url = net32Url,
  IsActive = isActive,
  LinkedCronName = cronName,
  LinkedCronId = cronId,
  LastUpdatedAt = updatedAt,
  LastUpdatedBy = updatedBy,
  IsBadgeItem = _isBadgeItem;

COMMIT;

END;

/ /
