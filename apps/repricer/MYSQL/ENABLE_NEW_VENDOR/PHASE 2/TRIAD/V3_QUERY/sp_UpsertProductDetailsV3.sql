use repricerDb;

DROP PROCEDURE IF EXISTS sp_UpsertProductDetailsV3;

delimiter / /
CREATE PROCEDURE sp_UpsertProductDetailsV3 (
  IN _mpid int,
  IN _active boolean,
  IN _url varchar(555),
  IN _cronName varchar(50),
  IN _cronId varchar(50),
  IN _updatedBy varchar(50),
  IN _updatedAt varchar(50),
  IN _productName varchar(50),
  IN _regCronName varchar(50),
  IN _regCronId varchar(50),
  IN _slowCronName varchar(50),
  IN _slowCronId varchar(50),
  IN _tradentLink INT,
  IN _frontierLink INT,
  IN _mvpLink INT,
  IN _isSlowActivated boolean,
  IN _isBadgeItem boolean,
  IN _topDentLink INT,
  IN _firstDentLink INT,
  IN _triadLink INT
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
    ProductName,
    RegularCronName,
    RegularCronId,
    SlowCronName,
    SlowCronId,
    LinkedTradentDetailsInfo,
    LinkedFrontiersDetailsInfo,
    LinkedMvpDetailsInfo,
    IsSlowActivated,
    IsBadgeItem,
    LinkedTopDentDetailsInfo,
    LinkedFirstDentDetailsInfo,
    LinkedTriadDetailsInfo
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
    _productName,
    _regCronName,
    _regCronId,
    _slowCronName,
    _slowCronId,
    _tradentLink,
    _frontierLink,
    _mvpLink,
    _isSlowActivated,
    _isBadgeItem,
    _topDentLink,
    _firstDentLink,
    _triadLink
  )
ON DUPLICATE KEY UPDATE
  Net32Url = net32Url,
  IsActive = isActive,
  LinkedCronName = cronName,
  LinkedCronId = cronId,
  LastUpdatedAt = updatedAt,
  LastUpdatedBy = updatedBy,
  ProductName = _productName,
  RegularCronName = _regCronName,
  RegularCronId = _regCronId,
  SlowCronName = _slowCronName,
  SlowCronId = _slowCronId,
  LinkedTradentDetailsInfo = _tradentLink,
  LinkedFrontiersDetailsInfo = _frontierLink,
  LinkedMvpDetailsInfo = _mvpLink,
  IsSlowActivated = _isSlowActivated,
  IsBadgeItem = _isBadgeItem,
  LinkedTopDentDetailsInfo = _topDentLink,
  LinkedFirstDentDetailsInfo = _firstDentLink,
  LinkedTriadDetailsInfo = _triadLink;

COMMIT;

END;

/ /
