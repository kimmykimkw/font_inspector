# Testing the Font Inspector Backend

This document provides step-by-step instructions for testing the font inspection functionality.

## Prerequisites

- Node.js (v14+)
- npm

## Setup

1. Install the required dependencies:
   ```
   npm install
   ```

## Running the Server

Start the backend server:
```
npm run server
```

The server will start on port 3001 by default.

## Testing the Font Inspection

### Option 1: Using the Test Script

Run the test script with a URL to inspect:
```
npm run test-inspect https://example.com
```

You should see the inspection results in the terminal, including:
- Downloaded font files (if any)
- @font-face declarations from CSS
- Fonts actively used on the page

### Option 2: Using cURL or Postman

You can also test the API endpoint directly:

**cURL**:
```bash
curl -X POST http://localhost:3001/api/inspect \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"]}'
```

**Postman**:
1. Create a POST request to `http://localhost:3001/api/inspect`
2. Set the Content-Type header to `application/json`
3. Set the request body to:
   ```json
   {
     "urls": ["https://example.com"]
   }
   ```
4. Send the request

## Troubleshooting

### Common Issues

- **EADDRINUSE error**: The port 3001 is already in use. You can change the port in `src/server/index.ts` and `src/server/start.ts`.
- **Browser launch error**: Make sure your system can run Chrome in headless mode. You might need to adjust the Puppeteer launch options in `src/server/services/inspectionService.ts`.
- **Timeout errors**: If a website takes too long to load, try increasing the timeout in the `page.goto` function.

### Debug Logs

The server outputs debug logs to the console. Check these logs for information about:
- Browser launch
- Website navigation
- Font detection
- Any errors that occur during the process

## Example Websites for Testing

These websites use various font loading techniques and are good for testing:
- https://fonts.google.com/ (Google Fonts)
- https://www.apple.com/ (Self-hosted fonts)
- https://www.nytimes.com/ (Mixed font sources)
- https://github.com/ (System fonts)

## Next Steps

After confirming that the backend works correctly, the next steps would be:
1. Integrating with the frontend UI
2. Adding support for batch processing
3. Implementing storage of inspection results 