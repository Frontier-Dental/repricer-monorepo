use repricerDb;

alter table table_tradentDetails
add column SisterVendorId varchar(255);

alter table table_mvpDetails
add column SisterVendorId varchar(255);

alter table table_frontierDetails
add column SisterVendorId varchar(255);

alter table table_topDentDetails
add column SisterVendorId varchar(255);

alter table table_firstDentDetails
add column SisterVendorId varchar(255);
