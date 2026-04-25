# TalentTrust Backend API Documentation

## Overview

The TalentTrust Backend API provides RESTful endpoints for managing escrow contract metadata. This API follows a modular architecture with proper separation of concerns, authentication, validation, and comprehensive error handling.

## Base URL

```
http://localhost:3001/api/v1
```

## Authentication

The API uses Bearer token authentication. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

### Demo Tokens
- `demo-admin-token` - Admin user with full access
- `demo-user-token` - Regular user with limited access

## Contract Metadata API

### Overview

Contract metadata allows storing key-value pairs associated with escrow contracts. Metadata can be marked as sensitive for data protection.

### Data Types

Supported data types for metadata values:
- `string` - Text values (default)
- `number` - Numeric values
- `boolean` - True/false values
- `json` - JSON objects/arrays

### Endpoints

#### Create Metadata

**POST** `/contracts/{contractId}/metadata`

Creates a new metadata record for a contract.

**Request Body:**
```json
{
  "key": "string",
  "value": "string",
  "data_type": "string|number|boolean|json",
  "is_sensitive": "boolean"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "contract_id": "uuid",
  "key": "string",
  "value": "string",
  "data_type": "string",
  "is_sensitive": "boolean",
  "created_by": "uuid",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Error Responses:**
- `401` - Authentication required
- `400` - Validation failed
- `404` - Contract not found
- `409` - Metadata key already exists for this contract

#### List Metadata

**GET** `/contracts/{contractId}/metadata`

Retrieves paginated metadata records for a contract with optional filtering.

**Query Parameters:**
- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 20, max: 100) - Items per page
- `key` (string) - Filter by metadata key
- `data_type` (string) - Filter by data type

**Response (200):**
```json
{
  "records": [
    {
      "id": "uuid",
      "contract_id": "uuid",
      "key": "string",
      "value": "string",
      "data_type": "string",
      "is_sensitive": "boolean",
      "created_by": "uuid",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

**Error Responses:**
- `401` - Authentication required
- `400` - Invalid parameters

#### Get Single Metadata

**GET** `/contracts/{contractId}/metadata/{id}`

Retrieves a specific metadata record by ID.

**Response (200):**
```json
{
  "id": "uuid",
  "contract_id": "uuid",
  "key": "string",
  "value": "string",
  "data_type": "string",
  "is_sensitive": "boolean",
  "created_by": "uuid",
  "updated_by": "uuid",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Error Responses:**
- `401` - Authentication required
- `404` - Metadata not found

#### Update Metadata

**PATCH** `/contracts/{contractId}/metadata/{id}`

Updates an existing metadata record. Only mutable fields can be updated.

**Request Body:**
```json
{
  "value": "string",
  "is_sensitive": "boolean"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "contract_id": "uuid",
  "key": "string",
  "value": "string",
  "data_type": "string",
  "is_sensitive": "boolean",
  "created_by": "uuid",
  "updated_by": "uuid",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Error Responses:**
- `401` - Authentication required
- `400` - Attempting to update immutable fields
- `404` - Metadata not found

#### Delete Metadata

**DELETE** `/contracts/{contractId}/metadata/{id}`

Soft deletes a metadata record. The record is marked as deleted but retained in the database.

**Response (204):** No content

**Error Responses:**
- `401` - Authentication required

## Jobs DLQ API

### Overview

Dead-letter queue (DLQ) endpoints allow administrators to inspect failed jobs and trigger controlled replays.
These endpoints are protected and audited.

### Authorization

- Requires `Authorization: Bearer <token>`
- Only `demo-admin-token` (or admin users in production auth) can access these routes
- Non-admin users receive `403 Admin role required`

### List DLQ Entries

**GET** `/jobs/dlq`

Optional query parameters:
- `type` - job type (`email-notification`, `contract-processing`, `reputation-update`, `blockchain-sync`)
- `limit` - number of items (default: 50, max: 100)
- `offset` - pagination offset (default: 0)

**Response (200):**
```json
{
  "entries": [
    {
      "jobId": "123",
      "jobType": "email-notification",
      "name": "email-notification",
      "data": {
        "to": "user@example.com",
        "subject": "Welcome",
        "body": "..."
      },
      "failedReason": "Invalid email address",
      "attemptsMade": 1,
      "finishedOn": 1713786060000,
      "timestamp": 1713786059000,
      "replayDeduplicationKey": "replay:email-notification:123"
    }
  ],
  "limit": 50,
  "offset": 0,
  "count": 1
}
```

### Reprocess a Failed Job

**POST** `/jobs/dlq/reprocess`

**Request Body:**
```json
{
  "type": "email-notification",
  "jobId": "123",
  "reason": "Retry after dependency incident resolved"
}
```

Rules:
- `reason` is required and must be at least 5 characters
- Replay is idempotent via deterministic dedupe key: `replay:<type>:<originalJobId>`

**Response (202):** replay enqueued
```json
{
  "replayJobId": "replay:email-notification:123",
  "deduplicated": false,
  "originalJobId": "123",
  "jobType": "email-notification"
}
```

**Response (200):** replay already exists (deduped)
```json
{
  "replayJobId": "replay:email-notification:123",
  "deduplicated": true,
  "originalJobId": "123",
  "jobType": "email-notification"
}
```

**Error Responses:**
- `400` - invalid type or missing fields
- `401` - authentication required
- `403` - admin role required
- `404` - failed job not found
- `409` - job is not in failed state

## Sensitive Data Protection

Metadata marked as `is_sensitive: true` is automatically masked for unauthorized users:

- **Owners** (users who created the metadata) can see the actual value
- **Admins** can see all sensitive values
- **Other users** see `***REDACTED***` instead of the actual value

## Validation Rules

### Key Validation
- Required field
- 1-255 characters
- Only alphanumeric characters, underscores, and hyphens allowed
- Regex: `^[a-zA-Z0-9_-]+$`

### Value Validation
- Required field
- 1-10,000 characters

### Data Types
- Must be one of: `string`, `number`, `boolean`, `json`
- Defaults to `string` if not specified

## Pagination

List endpoints support pagination with the following parameters:
- `page` - Page number (must be > 0)
- `limit` - Items per page (1-100)

The response includes pagination metadata:
```json
{
  "records": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": [
    {
      "field": "field.name",
      "message": "Validation error message"
    }
  ]
}
```

### Common Error Codes
- `400` - Bad Request (validation errors, invalid parameters)
- `401` - Unauthorized (missing or invalid authentication)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate key, resource conflict)
- `422` - Unprocessable Entity (business logic violations)
- `500` - Internal Server Error

## Examples

### Creating Metadata

```bash
curl -X POST http://localhost:3001/api/v1/contracts/123/metadata \
  -H "Authorization: Bearer demo-user-token" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "contract_amount",
    "value": "10000.00",
    "data_type": "number",
    "is_sensitive": true
  }'
```

### Listing Metadata with Filters

```bash
curl -X GET "http://localhost:3001/api/v1/contracts/123/metadata?page=1&limit=10&data_type=number" \
  -H "Authorization: Bearer demo-user-token"
```

### Updating Metadata

```bash
curl -X PATCH http://localhost:3001/api/v1/contracts/123/metadata/456 \
  -H "Authorization: Bearer demo-user-token" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "15000.00"
  }'
```

### Deleting Metadata

```bash
curl -X DELETE http://localhost:3001/api/v1/contracts/123/metadata/456 \
  -H "Authorization: Bearer demo-user-token"
```

## Health Check

**GET** `/health`

Returns the health status of the API service.

**Response (200):**
```json
{
  "status": "ok",
  "service": "talenttrust-backend"
}
```

## Development

### Running Tests

```bash
npm test
```

### Starting Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```
