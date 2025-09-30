# Excel Export Service

A dedicated microservice for handling Excel exports in the repricer monorepo.

## Features

- Export all items to Excel
- Export filtered items by tags, activation status, cron ID, or channel name
- Export specific items by MPID list
- Optimized memory usage with streaming
- Formatted date/time fields
- Badge indicator mapping

## API Endpoints

### POST /api/excel/download
Download Excel file with optional filters.

**Request Body:**
```json
{
  "tags": "optional tag filter",
  "activated": "true|false",
  "cronId": "optional cron ID",
  "channelName": "optional channel name filter"
}
```

### POST /api/excel/download-by-mpids
Download Excel file for specific MPIDs.

**Request Body:**
```json
{
  "mpids": ["MPID1", "MPID2", "MPID3"]
}
```

### GET /api/excel/status
Check service health status.

### GET /health
Health check endpoint.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `NODE_ENV`: Environment mode (development/production)
- `PORT`: Server port (default: 3003)
- `MONGODB_URI`: MongoDB connection string

## Integration with Main App

To use this service from the main repricer app, update the Excel download functionality to call:

```javascript
const response = await axios.post('http://localhost:3003/api/excel/download', filters, {
  responseType: 'blob'
});
```