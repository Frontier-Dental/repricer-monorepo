use repricerDb;

alter table table_tradentDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

alter table table_mvpDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

alter table table_frontierDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

alter table table_topDentDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

alter table table_firstDentDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

alter table table_triadDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

alter table table_biteSupplyDetails
add column BadgeUpExceptionPercentage decimal(5, 3);

update table_tradentDetails
set
  BadgeUpExceptionPercentage = 0;

update table_mvpDetails
set
  BadgeUpExceptionPercentage = 0;

update table_frontierDetails
set
  BadgeUpExceptionPercentage = 0;

update table_topDentDetails
set
  BadgeUpExceptionPercentage = 0;

update table_firstDentDetails
set
  BadgeUpExceptionPercentage = 0;

update table_triadDetails
set
  BadgeUpExceptionPercentage = 0;

update table_biteSupplyDetails
set
  BadgeUpExceptionPercentage = 0;
