# Multi-Page URL Inspection Feature

This document describes the new multi-page URL inspection feature that allows users to automatically discover and inspect multiple pages from a website.

## Overview

The multi-page inspection feature extends the single URL inspection capability by automatically discovering relevant pages from a website and treating the analysis as a project. This provides users with a comprehensive view of font usage across an entire website without manually entering multiple URLs.

## How It Works

### User Interface
- When entering a single URL, users can now select how many pages to inspect:
  - **1 page**: Inspect only the provided URL (existing single-page behavior)
  - **5 pages**: Auto-discover and inspect 5 relevant pages from the website
  - **10 pages**: Auto-discover and inspect 10 relevant pages from the website

### Page Discovery Process
1. **Original URL**: Always included as the highest priority page
2. **Sitemap Discovery**: Attempts to find and parse sitemap.xml files
3. **Internal Link Crawling**: Extracts internal links from the main page
4. **Common Path Detection**: Checks for standard website paths (about, contact, services, etc.)
5. **Prioritization**: Pages are ranked by importance and relevance

### Priority System
Pages are prioritized based on several factors:
- **Original URL**: Priority 100 (highest)
- **Sitemap URLs**: Priority 80-60 (decreasing with position)
- **High-value pages**: About, Contact, Services (+20 bonus)
- **Medium-value pages**: Blog, News, Portfolio (+10 bonus)
- **Low-value pages**: Login, Admin, Downloads (-20 penalty)
- **Common paths**: /about (70), /contact (65), /services (60), etc.

## Technical Implementation

### Components Added/Modified

#### 1. Page Discovery Service (`src/lib/page-discovery.ts`)
- **PageDiscoveryService**: Core service for discovering pages
- **DiscoveredPage**: Interface for discovered page data
- **PageDiscoveryOptions**: Configuration options for discovery

Key methods:
- `discoverPages()`: Main discovery function
- `discoverFromSitemap()`: Parses sitemap.xml files
- `discoverFromMainPage()`: Crawls main page for internal links
- `discoverCommonPaths()`: Checks standard website paths

#### 2. API Endpoint (`src/app/api/discover-pages/route.ts`)
- **POST /api/discover-pages**: RESTful endpoint for page discovery
- Handles authentication and rate limiting
- Returns discovered pages with metadata

#### 3. URL Input Form (`src/components/UrlInputForm.tsx`)
- Added radio button selection for page count
- Updated submission logic to handle multi-page scenarios
- Enhanced UI with explanatory text and icons

#### 4. Analysis Page (`src/app/analyze/page.tsx`)
- Added support for `type=multi-page` parameter
- Integrated page discovery API calls
- Auto-generates project names for multi-page inspections
- Fallback handling if page discovery fails

#### 5. API Client (`src/lib/api-client.ts`)
- Added `discoverPages()` method for client-side API calls

### Data Flow

1. **User Selection**: User selects page count (1, 5, or 10) and enters URL
2. **Form Submission**: Form redirects to `/analyze?url=X&type=multi-page&pageCount=Y`
3. **Page Discovery**: Analysis page calls `/api/discover-pages` endpoint
4. **URL Discovery**: Service discovers relevant pages using multiple strategies
5. **Project Creation**: Auto-generates project name and creates project
6. **Inspection Queue**: Discovered URLs are added to inspection queue
7. **Font Analysis**: Each page is inspected for font usage
8. **Results**: Results are saved as a project with multiple inspections

## Configuration

### Environment Variables
- `CHROME_PATH`: Custom Chrome executable path for Puppeteer
- `GOOGLE_CHROME_BIN`: Alternative Chrome path variable

### Discovery Options
```typescript
interface PageDiscoveryOptions {
  maxPages: number;          // Maximum pages to discover
  timeout?: number;          // Page load timeout (default: 30s)
  includeSubdomains?: boolean; // Include subdomain pages (default: false)
}
```

## Error Handling

### Graceful Degradation
- If page discovery fails, falls back to single-page inspection
- If some pages fail to load, continues with available pages
- Network timeouts are handled with appropriate fallbacks

### User Feedback
- Progress indicators during discovery and inspection
- Clear error messages if discovery fails
- Success notifications with page counts

## Security Considerations

### Rate Limiting
- Page discovery respects user limits for project creation
- Authentication required for multi-page inspections
- Timeout limits prevent abuse

### Domain Restrictions
- Only discovers pages from the same domain
- Optional subdomain inclusion (disabled by default)
- Validates all discovered URLs before inspection

## Testing

### Manual Testing
1. Navigate to the main page
2. Enter a URL (e.g., "example.com")
3. Select 5 or 10 pages option
4. Submit and observe page discovery process
5. Verify project creation and inspection results

### Automated Testing
Run the test script:
```bash
node test-page-discovery.js
```

### Test Cases
- Basic websites with standard structure
- Websites with sitemaps
- Websites without sitemaps
- Sites with various link structures
- Error conditions (timeouts, invalid URLs)

## Performance Considerations

### Discovery Time
- Typical discovery takes 10-30 seconds
- Parallel processing of sitemap and link crawling
- Configurable timeouts prevent hanging

### Resource Usage
- Uses existing Puppeteer infrastructure
- Minimal additional memory overhead
- Efficient URL deduplication

## Future Enhancements

### Potential Improvements
1. **Smart Page Selection**: ML-based page importance scoring
2. **Content Analysis**: Discover pages based on content type
3. **User Customization**: Allow users to exclude certain page types
4. **Caching**: Cache discovery results for repeated domains
5. **Subdomain Support**: Better handling of subdomain discovery

### Integration Opportunities
1. **Sitemap Integration**: Direct sitemap upload option
2. **URL Filtering**: Custom URL pattern inclusion/exclusion
3. **Batch Processing**: Discover pages for multiple domains
4. **Analytics Integration**: Track discovery success rates

## Troubleshooting

### Common Issues
1. **Chrome not found**: Set `CHROME_PATH` environment variable
2. **Discovery timeout**: Increase timeout in options
3. **No pages found**: Check website structure and connectivity
4. **Authentication errors**: Ensure user is logged in

### Debug Information
- Enable detailed logging in development mode
- Check browser console for discovery progress
- Review network requests in developer tools

## API Reference

### POST /api/discover-pages
Discovers pages from a website domain.

**Request Body:**
```json
{
  "url": "https://example.com",
  "pageCount": 5
}
```

**Response:**
```json
{
  "success": true,
  "pages": [
    {
      "url": "https://example.com",
      "title": "Example Domain",
      "priority": 100,
      "source": "original"
    }
  ],
  "totalFound": 5,
  "discoveryTimeMs": 15000,
  "requestId": "abc123"
}
```

**Error Response:**
```json
{
  "error": "Page discovery failed",
  "details": "Timeout occurred",
  "requestId": "abc123"
}
```
