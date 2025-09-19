use repricerDb;

alter table table_tradentDetails
add column InventoryThreshold INT,
add column ExcludedVendors varchar(255);

alter table table_mvpDetails
add column InventoryThreshold INT,
add column ExcludedVendors varchar(255);

alter table table_frontierDetails
add column InventoryThreshold INT,
add column ExcludedVendors varchar(255);

alter table table_topDentDetails
add column InventoryThreshold INT,
add column ExcludedVendors varchar(255);

alter table table_firstDentDetails
add column InventoryThreshold INT,
add column ExcludedVendors varchar(255);
