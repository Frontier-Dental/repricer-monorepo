# Quick Reference Checklist: Adding a New Vendor

Use this checklist as a quick reference when adding a new vendor. For detailed instructions, see `VENDOR_ADDITION_GUIDE.md`.

## Pre-requisites
- [ ] Vendor ID from Net32 system
- [ ] Vendor name (e.g., "NEWVENDOR")
- [ ] Database access credentials

## Database Setup
- [ ] Step 1: Create vendor details table (`STEP1_INIT_TABLE_VENDOR_ADDITION_[VENDOR].sql`)
- [ ] Step 2: Alter `table_scrapeProductList` to add link column
- [ ] Step 3: Insert initial data for all products
- [ ] Step 4: Link vendor data to root product table
- [ ] Step 5: Create upsert stored procedure (`sp_Upsert[Vendor]Details`)
- [ ] Step 6: Create update stored procedure (`sp_Update[Vendor]DetailsById`)

## Code Changes - Shared Package
- [ ] Add vendor to `VendorId` enum in `packages/shared/src/index.ts`
- [ ] Add vendor to `VendorName` enum
- [ ] Add to `VendorNameLookup` mapping
- [ ] Add to `VendorIdLookup` mapping

## Code Changes - Configuration
- [ ] Add `SQL_SP_UPSERT_[VENDOR]` to `apps/repricer/src/utility/config.ts`
- [ ] Add `SQL_SP_UPDATE_[VENDOR]` to config
- [ ] Add `SQL_[VENDOR]_DETAILS` table name to config
- [ ] Repeat for `apps/api-core/src/utility/config.ts`

## Code Changes - Services
- [ ] Update `UpsertVendorData` switch in `apps/repricer/src/services/mysql.ts`
- [ ] Update `UpsertVendorData` in `apps/excel-export/src/services/mysql.ts`
- [ ] Update `UpsertVendorData` in `apps/repricer/src/middleware/mysql.ts`
- [ ] Update `getContextTableNameByVendorName` in `apps/api-core/src/utility/mysql/mysql-helper.ts`

## Code Changes - Controllers
- [ ] Add vendor case in `updateProductDetails` in `apps/repricer/src/controllers/product-v2.ts`

## Code Changes - Migrations
- [ ] Add vendor table to `20241120000009_add_market_state_fields.ts` (if needed)
- [ ] Add vendor config to `20251208000010_populate_market_state_fields.ts` (if needed)

## Frontend Views
- [ ] Create `apps/repricer/views/pages/products/partials/[vendor].ejs` (edit view)
- [ ] Create `apps/repricer/views/pages/products/add-partials/add[vendor].ejs` (add view)
- [ ] Update `apps/repricer/views/pages/products/get_all.ejs` to include new vendor

## Testing
- [ ] Database: Verify table and procedures
- [ ] Backend: Test upsert and update functions
- [ ] Backend: Test product retrieval
- [ ] Frontend: Test product detail view
- [ ] Frontend: Test add product form
- [ ] Frontend: Test update product form
- [ ] Integration: Test cron jobs
- [ ] Integration: Test scraping (if applicable)
- [ ] Integration: Test repricing (if applicable)

## Verification
- [ ] All SQL scripts executed successfully
- [ ] No TypeScript compilation errors
- [ ] No runtime errors in logs
- [ ] Vendor appears in UI correctly
- [ ] Data saves and retrieves correctly
- [ ] Existing vendors still work correctly

## Deployment Notes
- [ ] Document vendor ID and name
- [ ] Note any vendor-specific configuration
- [ ] Update team documentation
- [ ] Create deployment ticket with all changes

---

**Quick Command Reference:**

```sql
-- Verify table exists
SHOW TABLES LIKE 'table_%Vendor%Details';

-- Verify stored procedure exists
SHOW PROCEDURE STATUS WHERE Name LIKE 'sp_%Vendor%';

-- Test upsert
CALL sp_Upsert[Vendor]Details(...);

-- Check data
SELECT COUNT(*) FROM table_[vendor]Details;
```

