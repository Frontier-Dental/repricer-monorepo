use repricerDb;

alter table table_tradentDetails
add column GetBBBadgeValue decimal(5, 3),
add column GetBBShippingValue decimal(5, 3),
add column GetBBBadge boolean,
add column GetBBShipping boolean;

alter table table_mvpDetails
add column GetBBBadgeValue decimal(5, 3),
add column GetBBShippingValue decimal(5, 3),
add column GetBBBadge boolean,
add column GetBBShipping boolean;

alter table table_frontierDetails
add column GetBBBadgeValue decimal(5, 3),
add column GetBBShippingValue decimal(5, 3),
add column GetBBBadge boolean,
add column GetBBShipping boolean;

alter table table_topDentDetails
add column GetBBBadgeValue decimal(5, 3),
add column GetBBShippingValue decimal(5, 3),
add column GetBBBadge boolean,
add column GetBBShipping boolean;

alter table table_firstDentDetails
add column GetBBBadgeValue decimal(5, 3),
add column GetBBShippingValue decimal(5, 3),
add column GetBBBadge boolean,
add column GetBBShipping boolean;

alter table table_triadDetails
add column GetBBBadgeValue decimal(5, 3),
add column GetBBShippingValue decimal(5, 3),
add column GetBBBadge boolean,
add column GetBBShipping boolean;

update table_tradentDetails
set
  GetBBShipping = true,
  GetBBBadge = true,
  GetBBShippingValue = 0.005,
  GetBBBadgeValue = 0.1;

update table_mvpDetails
set
  GetBBShipping = true,
  GetBBBadge = true,
  GetBBShippingValue = 0.005,
  GetBBBadgeValue = 0.1;

update table_frontierDetails
set
  GetBBShipping = true,
  GetBBBadge = true,
  GetBBShippingValue = 0.005,
  GetBBBadgeValue = 0.1;

update table_topDentDetails
set
  GetBBShipping = true,
  GetBBBadge = true,
  GetBBShippingValue = 0.005,
  GetBBBadgeValue = 0.1;

update table_firstDentDetails
set
  GetBBShipping = true,
  GetBBBadge = true,
  GetBBShippingValue = 0.005,
  GetBBBadgeValue = 0.1;

update table_triadDetails
set
  GetBBShipping = true,
  GetBBBadge = true,
  GetBBShippingValue = 0.005,
  GetBBBadgeValue = 0.1;
