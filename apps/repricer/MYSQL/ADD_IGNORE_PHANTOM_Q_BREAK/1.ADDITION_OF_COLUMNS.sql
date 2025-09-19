use repricerDb;

alter table table_tradentDetails
add column IgnorePhantomBreak boolean;

alter table table_mvpDetails
add column IgnorePhantomBreak boolean;

alter table table_frontierDetails
add column IgnorePhantomBreak boolean;

alter table table_topDentDetails
add column IgnorePhantomBreak boolean;

alter table table_firstDentDetails
add column IgnorePhantomBreak boolean;

update table_tradentDetails
set
  IgnorePhantomBreak = false;

update table_mvpDetails
set
  IgnorePhantomBreak = false;

update table_frontierDetails
set
  IgnorePhantomBreak = false;

update table_topDentDetails
set
  IgnorePhantomBreak = false;

update table_firstDentDetails
set
  IgnorePhantomBreak = false;
