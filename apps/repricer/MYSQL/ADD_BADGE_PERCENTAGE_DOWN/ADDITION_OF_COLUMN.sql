use repricerDb;

alter table table_tradentDetails
add column BadgePercentageDown decimal(5, 3);

alter table table_mvpDetails
add column BadgePercentageDown decimal(5, 3);

alter table table_frontierDetails
add column BadgePercentageDown decimal(5, 3);

alter table table_topDentDetails
add column BadgePercentageDown decimal(5, 3);

alter table table_firstDentDetails
add column BadgePercentageDown decimal(5, 3);

update table_tradentDetails
set
  BadgePercentageDown = 0;

update table_mvpDetails
set
  BadgePercentageDown = 0;

update table_frontierDetails
set
  BadgePercentageDown = 0;

update table_topDentDetails
set
  BadgePercentageDown = 0;

update table_firstDentDetails
set
  BadgePercentageDown = 0;
