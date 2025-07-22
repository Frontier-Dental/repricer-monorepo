use repricerDb;

alter table table_tradentDetails
add column CompeteWithNext boolean;

alter table table_mvpDetails
add column CompeteWithNext boolean;

alter table table_frontierDetails
add column CompeteWithNext boolean;

alter table table_topDentDetails
add column CompeteWithNext boolean;

alter table table_firstDentDetails
add column CompeteWithNext boolean;

update table_tradentDetails
set
  CompeteWithNext = false;

update table_mvpDetails
set
  CompeteWithNext = false;

update table_frontierDetails
set
  CompeteWithNext = false;

update table_topDentDetails
set
  CompeteWithNext = false;

update table_firstDentDetails
set
  CompeteWithNext = false;
