# Font Inspector

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing the Font Inspection Backend

This project is currently in its initial development phase. The core functionality (font inspection) can be tested as follows:

### Prerequisites

Make sure you have Node.js installed (version 14 or higher).

### Installation

1. Install dependencies:
   ```
   npm install
   ```

### Running the Backend Server

1. Start the font inspection server:
   ```
   npm run server
   ```
   This will start a server on port 3001.

### Testing Font Inspection

You can test the font inspection functionality using our test script:

```
npm run test-inspect https://example.com
```

Replace `https://example.com` with any website URL you want to inspect.

The script will display:
- Downloaded font files
- @font-face declarations found in CSS
- Actively used fonts on the page

### API Endpoint

The API endpoint is available at:
```
POST http://localhost:3001/api/inspect
```

Request body:
```json
{
  "urls": ["https://example.com"]
}
```

## Project Structure

The font inspection functionality consists of:

- **Server**: Express.js application in `src/server/`
- **Inspection Service**: Puppeteer-based font analyzer in `src/server/services/`
- **API Endpoints**: Controllers for handling inspection requests

## Next Steps

- Integration with the frontend
- Batch processing for multiple URLs
- Result storage and history
- Visual font preview
