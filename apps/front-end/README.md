# Frontend Application

This is a Vite-based React application that provides a modern UI for the repricer system.

## Features

- **Products Page**: A comprehensive data table displaying product information with pagination, sorting, and filtering capabilities
- **Real-time Data**: Fetches data from the backend API with server-side pagination
- **Modern UI**: Built with Shadcn UI components and Tailwind CSS
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Backend API running on `http://localhost:3000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Products Page

The products page displays a comprehensive table of product data with the following features:

### Columns
- **Product ID**: Unique identifier for each product
- **Product Name**: Name of the product with link to product page
- **Vendor**: Vendor/supplier name
- **Current Price**: Current selling price
- **Previous Price**: Previous selling price
- **Price Change**: Absolute and percentage price change
- **Status**: Product status (Active/Inactive)
- **Last Updated**: Timestamp of last update
- **Cron Name**: Associated cron job name

### Features
- **Sorting**: Click column headers to sort data
- **Filtering**: Search by product ID
- **Pagination**: Navigate through pages with configurable page size
- **Column Visibility**: Toggle column visibility using the "View" dropdown
- **Loading States**: Skeleton loading indicators while data is being fetched
- **Error Handling**: Graceful error display with retry functionality

### API Integration

The page fetches data from the backend API endpoint:
```
GET /api/products/cron/{cronName}?page={page}&pageSize={pageSize}
```

The API returns paginated data in the following format:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

## Configuration

### API Proxy

The development server is configured to proxy API requests to the backend:
- API requests to `/api/*` are proxied to `http://localhost:3000`
- This allows seamless development without CORS issues

### Cron Name

The default cron name is set to `"default-cron"` in the `ProductsPage.tsx` component. You can modify this to match your specific cron job name.

## Build

To build the application for production:

```bash
npm run build
```

The built files will be output to `../repricer/public/vite/` for integration with the main repricer application.

## Technologies Used

- **React 19**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn UI**: High-quality React components
- **TanStack Table**: Powerful table library
- **Radix UI**: Accessible UI primitives
