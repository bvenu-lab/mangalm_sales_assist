# Zoho Integration Service

This service provides integration with Zoho CRM for the Mangalm Sales-Assist MVP. It synchronizes data between Zoho CRM and the database, including stores, products, and invoices.

## Features

- **Zoho CRM Integration**: Connect to Zoho CRM API to fetch data
- **Data Synchronization**: Sync stores, products, and invoices from Zoho CRM to the database
- **Scheduled Synchronization**: Automatically sync data on a schedule
- **Data Validation**: Validate and cleanse data before storing it in the database
- **RESTful API**: Expose endpoints for manual synchronization and scheduler management
- **Logging**: Comprehensive logging for debugging and monitoring

## Architecture

The service is built using the following components:

- **Zoho API Client**: Handles authentication and communication with Zoho CRM API
- **Database Client**: Communicates with the Database Orchestrator microservice
- **Sync Service**: Synchronizes data between Zoho CRM and the database
- **Scheduler**: Schedules automatic synchronization jobs
- **Data Validation**: Validates and cleanses data before storing it in the database
- **Express Server**: Provides RESTful API endpoints

## Setup

### Prerequisites

- Node.js 18 or higher
- Zoho CRM account with API access
- Database Orchestrator microservice running

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

Copy the `.env.example` file to `.env` and update the values:

```bash
cp .env.example .env
```

Update the following values in the `.env` file:

- `ZOHO_CLIENT_ID`: Your Zoho CRM client ID
- `ZOHO_CLIENT_SECRET`: Your Zoho CRM client secret
- `ZOHO_REDIRECT_URI`: Your Zoho CRM redirect URI
- `ZOHO_REFRESH_TOKEN`: Your Zoho CRM refresh token
- `DATABASE_ORCHESTRATOR_URL`: URL of the Database Orchestrator microservice
- `DATABASE_ORCHESTRATOR_API_KEY`: API key for the Database Orchestrator microservice

### Running the Service

#### Development

```bash
npm run dev
```

#### Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the service.

### Sync Endpoints

```
POST /api/sync/stores
```

Synchronizes stores from Zoho CRM to the database.

```
POST /api/sync/products
```

Synchronizes products from Zoho CRM to the database.

```
POST /api/sync/invoices
```

Synchronizes invoices from Zoho CRM to the database.

```
POST /api/sync/all
```

Synchronizes all data from Zoho CRM to the database.

### Scheduler Endpoints

```
GET /api/scheduler/jobs
```

Returns the status of all scheduled jobs.

```
POST /api/scheduler/jobs/:name/start
```

Starts a scheduled job immediately.

```
POST /api/scheduler/jobs/:name/stop
```

Stops a scheduled job.

## Default Scheduled Jobs

The service automatically schedules the following jobs:

- **stores-sync**: Synchronizes stores every day at 1:00 AM
- **products-sync**: Synchronizes products every day at 2:00 AM
- **invoices-sync**: Synchronizes invoices every day at 3:00 AM
- **full-sync**: Synchronizes all data every Sunday at 4:00 AM

## Development

### Project Structure

```
src/
├── services/
│   ├── zoho/
│   │   ├── zoho-api-client.ts
│   │   ├── zoho-sync-service.ts
│   │   └── zoho-types.ts
│   ├── database/
│   │   └── database-client.ts
│   ├── validation/
│   │   └── data-validation-service.ts
│   └── scheduler/
│       └── sync-scheduler.ts
├── utils/
│   └── logger.ts
└── index.ts
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.
