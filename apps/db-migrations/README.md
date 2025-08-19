# Database Migrations

This directory contains database migrations and seeders for the project using Knex.js.

## Migrations

### Running Migrations

```bash
# Development
npm run migrate:dev

# Production
npm run migrate:prod

# Rollback (development only)
npm run rollback:dev
```

### Available Migrations

1. **`20250728095828_v2_algo_execution.ts`** - Creates the v2_algo_execution table for storing HTML files
2. **`20250729000000_v2_algo_settings.ts`** - Creates the v2_algo_settings table for vendor configuration
3. **`20250729000001_tinyproxy_configs.ts`** - Creates the tinyproxy_configs table for proxy settings
4. **`20250729000002_v2_algo_results.ts`** - Creates the v2_algo_results table and adds foreign key relationship

### Table Relationships

- **`v2_algo_results`** (parent table)
  - Stores algorithm execution results with job tracking
  - Primary key: `id` (auto-incrementing)
  - Unique constraint: `job_id` (UUID)
  
- **`v2_algo_execution`** (child table)
  - Stores HTML files and execution metadata
  - Foreign key: `job_id` references `v2_algo_results.job_id`
  - Cascade delete: When a job result is deleted, related HTML files are also deleted

## Seeds

### Running Seeds

```bash
# Run all seeds for development environment
npm run seed:dev

# Create a new seed file
npm run seed:make seed_name
```

### Available Seeds

#### TinyProxy Configs Seed (`01_tinyproxy_configs.ts`)

This seed populates the `tinyproxy_configs` table with proxy configuration data for various vendors.

**What it does:**
- Reads sensitive proxy data from `data/tinyproxy-configs.json` (not committed to git)
- Clears existing data from the `tinyproxy_configs` table
- Inserts 6 proxy configurations for different vendors:
  - **tradent** (IP: 174.138.69.66:8888)
  - **mvp** (IP: 159.203.121.58:8888)
  - **firstdent** (IP: 159.203.73.122:8888)
  - **topdent** (IP: 142.93.187.112:8888)
  - **triad** (IP: 165.227.99.82:8888)
  - **frontier** (IP: 138.197.27.59:8888)

**Data Structure:**
Each proxy config includes:
- `proxy_username`: Username for proxy authentication
- `proxy_password`: Password for proxy authentication
- `subscription_key`: Subscription/box password
- `ip`: Proxy server IP address
- `port`: Proxy server port (default: 8888)
- `vendor_id`: Associated vendor ID

#### V2 Algo Results Sample Seed (`02_v2_algo_results_sample.ts`)

This seed populates the `v2_algo_results` table with sample algorithm execution data for testing.

**What it does:**
- Clears existing data from the `v2_algo_results` table
- Inserts sample algorithm execution results
- Useful for testing the table structure and relationships

**Data Structure:**
Each result includes:
- `job_id`: Unique UUID for the job run
- `suggested_price`: Decimal price suggestion
- `comment`: Algorithm decision explanation
- `triggered_by_vendor`: Which vendor triggered the change
- `result`: Algorithm result (e.g., CHANGE_DOWN, IGNORE_FLOOR)
- `quantity`: Product quantity
- `vendor_id`: Vendor identifier
- `mp_id`: Market place product identifier
- `cron_name`: Name of the cron job that ran
- `run_time`: When the algorithm executed
- `q_break_valid`: Whether quantity break is valid
- `price_update_result`: Result of price update attempt

### Creating New Seeds

To create a new seed file:

```bash
npm run seed:make your_seed_name
```

This will create a new seed file in the `seeds/` directory with the proper Knex seed structure.

## Environment Configuration

Create `.env.development` file with:

```env
SQL_HOSTNAME=your_host
SQL_PORT=3306
SQL_USERNAME=your_username
SQL_PASSWORD=your_password
SQL_DATABASE=your_database
```

## Knex Configuration

The project uses Knex.js with TypeScript support:
- **Migrations**: Located in `./migrations` with `.ts` extension
- **Seeds**: Located in `./seeds` with `.ts` extension
- **Database**: MySQL2 client
- **Environment**: Development and production configurations

## Security and Data Management

### Sensitive Data
- **`data/` directory**: Contains sensitive configuration files (excluded from git)
- **`.env*` files**: Environment-specific configuration (excluded from git)
- **Proxy credentials**: Stored in JSON files, not hardcoded in seed files

### Setup Required
1. Create `data/` directory manually
2. Add `tinyproxy-configs.json` with your actual proxy credentials
3. Configure `.env.development` with database credentials

## Workflow

1. **First, run migrations** to create/update table structures
2. **Then run seeds** to populate tables with initial data
3. **Use rollback** if you need to undo migrations

```bash
# Complete setup workflow
npm run migrate:dev    # Create/update tables
npm run seed:dev       # Populate with seed data
```

## Troubleshooting

If you encounter issues:

1. **Missing data file**: Ensure `data/tinyproxy-configs.json` exists
2. **Database connection**: Check your `.env.development` file
3. **Table missing**: Run migrations first with `npm run migrate:dev`
4. **Permission errors**: Ensure your database user has INSERT/DELETE permissions
5. **Foreign key errors**: Ensure migrations are run in order (migrations run sequentially)
