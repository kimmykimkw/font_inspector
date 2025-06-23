# Firebase Setup Guide for Font Inspector

This guide will walk you through setting up Firebase for the Font Inspector application.

## Prerequisites

1. A Google account
2. Node.js and npm installed on your computer

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Enter "Font Inspector" as the project name and follow the setup wizard
4. Enable Google Analytics if desired, then click "Create project"

## Step 2: Enable Firestore Database

1. In the Firebase Console, navigate to your project
2. In the left sidebar, click "Firestore Database"
3. Click "Create database"
4. Choose "Start in production mode" and select a location closest to your users
5. Click "Enable"

## Step 3: Create a Service Account

1. In the Firebase Console, go to Project Settings (gear icon in the top-left)
2. Click the "Service accounts" tab
3. Select "Firebase Admin SDK"
4. Click "Generate new private key"
5. Save the JSON file securely

## Step 4: Configure Environment Variables

1. Open the downloaded service account JSON file
2. Update the `.env` file in your project with:

```
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

3. For local development, replace the contents of `firebase-service-account.json` with the downloaded JSON
4. For production deployment, set the `FIREBASE_SERVICE_ACCOUNT` environment variable:
   - Escape all quotes and newlines in the JSON
   - Set the variable to the stringified JSON

Example:
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"font-inspector","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

## Step 5: Firestore Security Rules

1. In the Firebase Console, go to Firestore Database
2. Click the "Rules" tab
3. Set up basic security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access on all documents
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Note**: These rules allow unrestricted access to your database. For production, you should implement proper authentication and authorization.

## Step 6: Test the Connection

1. Start your Font Inspector server
2. Check the logs for "Firebase initialized" message
3. Make a test API request to verify connectivity

## Deploying to Production

When deploying to production:

1. Set all Firebase environment variables in your hosting environment
2. Never commit service account credentials to git repositories
3. Consider implementing Firebase Authentication for user management
4. Update Firestore security rules to restrict access based on authentication

## Troubleshooting

- **"Firebase app already exists" error**: This happens when you try to initialize Firebase multiple times. Check your code for duplicate initialization calls.
- **Connection refused errors**: Verify your service account has the right permissions and that your project ID and credentials are correct.
- **CORS errors**: Ensure your security rules allow access from your client's domain.

For more information, refer to the [Firebase documentation](https://firebase.google.com/docs). 