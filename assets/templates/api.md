---
title: {{name}}
version: "1.0"
description: {{description}}
baseUrl: {{baseUrl}}
authentication: {{authentication}}
---

# {{name}} API

{{description}}

## Overview

High-level description of this API.

## Authentication

All endpoints require {{authentication}} token authentication.

```
Authorization: {{authentication}} <token>
```

## Endpoints

### List Resources

```
GET {{baseUrl}}/{{resource}}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Max results (default: 20) |
| offset | number | No | Pagination offset |

**Response:**

```json
{
  "data": [],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Resource

```
GET {{baseUrl}}/{{resource}}/:id
```

**Response:**

```json
{
  "id": "uuid",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Create Resource

```
POST {{baseUrl}}/{{resource}}
```

**Request Body:**

```json
{
  "field": "value"
}
```

**Response:** `201 Created`

### Update Resource

```
PUT {{baseUrl}}/{{resource}}/:id
```

### Delete Resource

```
DELETE {{baseUrl}}/{{resource}}/:id
```

**Response:** `204 No Content`

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_ERROR | Server error |

## Rate Limiting

- Rate limit: 1000 requests/minute
- Header: `X-RateLimit-Remaining`

## Related

- [Schema](../../schemas/{{schema}}.md)
- [Domain](../../domains/{{domain}}/api.md)
