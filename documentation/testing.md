# Testing Font Inspector MongoDB Integration

This document provides instructions for testing the MongoDB integration features of Font Inspector. It covers testing the database connection, models, API endpoints, and error handling.

## Prerequisites

Before running tests, ensure you have:

1. MongoDB installed and running locally
2. Environment variables set up correctly in `.env` file
3. All dependencies installed (`npm install`)
4. The backend server running (`npm run server`)

## Test Scripts

There are two main test scripts:

1. **Database Integration Test** (`src/server/test-db.js`):
   - Tests direct database operations
   - Verifies data models and schemas
   - Tests performance with larger datasets
   - Ensures error handling works correctly

2. **API Integration Test** (`src/server/test-api.js`):
   - Tests HTTP API endpoints
   - Verifies data is saved correctly through the API
   - Tests project and inspection workflows
   - Ensures API error handling works correctly

## Running the Tests

### Database Integration Tests

To run the database integration tests:

```bash
node src/server/test-db.js
```

This script will:
- Test the MongoDB connection
- Perform CRUD operations on Project and Inspection models
- Test relationships between models
- Test performance with batch operations
- Verify error handling for various error scenarios

### API Integration Tests

To run the API integration tests:

```bash
node src/server/test-api.js
```

Before running this test, make sure the backend server is running:

```bash
npm run server
```

The API test script will:
- Test the inspection endpoint with single URLs
- Test project creation and URL batch processing
- Verify data retrieval endpoints
- Test error handling for invalid inputs and error conditions
- Clean up test data after tests are complete

## Test Coverage

The tests cover:

1. **Data Models**:
   - Creating Project and Inspection records
   - Retrieving and updating records
   - Establishing relationships between models
   - Deleting records

2. **Performance**:
   - Creating and retrieving large datasets
   - Measuring execution time for operations
   - Testing database queries with filters

3. **Error Handling**:
   - Validation errors (missing required fields)
   - Connection errors
   - API input validation
   - HTTP error responses

## Interpreting Results

The test scripts provide detailed output with emoji indicators:
- ✅ Success
- ⚠️ Warning
- ❌ Error

Each operation includes timing information to help identify performance bottlenecks.

## Troubleshooting

If tests fail, check:

1. **MongoDB Connection**: Make sure MongoDB is running and connection string is correct
2. **Backend Server**: For API tests, ensure the backend server is running and accessible
3. **Environment Variables**: Check .env file for proper configuration
4. **Dependencies**: Ensure all dependencies are installed

## Adding New Tests

When adding new features, consider adding corresponding tests to verify:
- Data validation
- Error handling
- Performance with larger datasets
- Relationships between models

Follow the patterns established in the existing test files. 