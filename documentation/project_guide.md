# Font Inspector – Project Brief

## Project Overview

Font Inspector is a **Desktop Application** built with Electron that analyzes websites and reports which font files are downloaded and actively used. The tool utilizes a headless browser to inspect the network requests of a given website, filters font-related assets, and provides insights by comparing CSS declarations with actual applied fonts. **Advanced Font Compliance Features** include comprehensive font metadata extraction that identifies font foundries, copyright information, licensing terms, and embedding permissions to support legal compliance auditing. **Interactive Screenshot Functionality** captures both original and annotated website screenshots with smart font highlighting, showing colored borders around text elements with always-visible font labels for visual font identification. The app supports both individual website inspections and projects containing multiple websites, offering a user-friendly desktop interface, robust backend inspection, and native macOS integration with proper permission handling.

**Authentication**: The app supports both Google OAuth and email/password authentication to ensure user data privacy and personalized experience. Each user's inspections, projects, and history are completely isolated from other users. Access to the application is controlled through an admin-managed approval system with granular permission controls and usage limits.

**Permission System**: The application implements a comprehensive permission checking system that enforces user access controls and usage limits before allowing inspections or project creation. Users receive real-time feedback about their permission status and current usage limits.

**Desktop-First Experience**: The application runs as a native desktop app with full access to system resources, providing better performance for font analysis and seamless integration with the operating system.

**Admin System**: A separate web-based admin application provides comprehensive user management, access control, usage limit configuration, and system monitoring capabilities for administrators.

## Site Map & Page Structure

### 0. Authentication & Access Control
- **Multi-Authentication Support**: Users can authenticate using either Google Sign-In or email/password authentication.
- **Email Registration System**: New users can create accounts using email/password with admin approval workflow.
- **Google Authentication**: Traditional Google OAuth authentication with popup-based sign-in flow.
- **Access Request System**: Both authentication methods require admin approval before users can access the application.
- **Admin Approval Workflow**: 
  - **Google Users**: Submit access requests through dedicated request form, admin approval grants immediate access
  - **Email Users**: Submit registration requests with name/email/password, admin approval creates Firebase account and grants access
- **User Profile**: Dropdown menu in header showing user avatar, name, email, authentication provider, current usage statistics, app version, and logout option.
- **Permission Checking**: Real-time permission validation before allowing inspections or project creation.
- **Usage Limits**: Monthly limits for inspections and projects set by administrators with live usage tracking.
- **Permission Feedback**: Clear visual feedback when users lack permissions or exceed limits.
- **Data Privacy**: All user data (inspections, projects, history) is completely isolated per user.
- **Permission Management**: User access and usage limits are managed through the admin system.
- **Password Management**: Email users have access to password reset functionality through Firebase's built-in system.
- **Graceful Degradation**: Forms and buttons are disabled when users don't have permission, with clear explanatory messages.

### 1. Home Page
- **Welcome Banner**: Brief introduction to Font Inspector with personalized user greeting.
- **Single URL Inspection Form**: 
  - URL input field that accepts a single website URL with a submit button
  - **Multi-Page Selection**: Radio button options to choose inspection scope:
    - **1 page**: Inspect only the provided URL (traditional single-page behavior)
    - **5 pages**: Auto-discover and inspect 5 relevant pages from the website
    - **10 pages**: Auto-discover and inspect 10 relevant pages from the website
  - **Auto-Discovery Explanation**: Clear indication that multi-page options will automatically find relevant pages and create a project
  - Form includes real-time permission checking and is disabled when user lacks permission or exceeds limits
- **Project Input Form**: Form to create a new project with multiple website URLs (Manual Batch) with a submit button. Form includes permission validation and usage limit checking.
- **Permission Status**: Visual indicators showing current monthly usage and remaining limits.
- **Inspection Queue**: List of pending website inspections for the authenticated user.
- **Recent Inspections**: List of the user's previously inspected URLs and projects.

### 2. History Page
- **User-Specific Inspection History**: Comprehensive list of all past inspections by the authenticated user, both individual websites and projects.
- **Filtering Options**: Ability to filter by date range, URL keywords, or inspection type (individual/project) within user's data.
- **Search Functionality**: Search box to quickly find specific inspections by URL or project name within user's history.
- **Sorting Controls**: Options to sort by date, URL, or inspection status for user's inspections.
- **Actions**: Quick access buttons to view, re-run, or delete the user's past inspections.
- **Pagination**: Navigation controls to browse through the user's inspection history.

### 3. Results Page
- **Inspection Summary**: Overview for each inspected website by the user, including most used fonts and their usage frequency.
- **Font Download Details**: List of downloaded font files (file names, formats, sizes in kilobytes (KB), source URLs) per website, with indicators for font source type (CDN, Google Fonts, Adobe Fonts, etc.).
- **Font Metadata Analysis**: Advanced font metadata extraction displaying:
  - **Foundry Information**: Font creator/manufacturer (Monotype, Adobe, Google, etc.)
  - **Copyright Details**: Copyright notices embedded in font files
  - **Licensing Information**: License descriptions and terms
  - **Embedding Permissions**: Web embedding rights (installable, editable, preview & print, restricted)
  - **Version & Designer**: Font version numbers and designer information
  - **Creation Dates**: Font file creation timestamps
- **Active Fonts**: Visual display of fonts actively used on each website (preview text).
- **Screenshots**: Interactive screenshot viewer with tabbed interface showing:
  - **Original Screenshot**: Clean website capture without annotations
  - **Font Annotations**: Annotated screenshot with colored borders around text elements and always-visible font labels
  - **Zoom & Pan**: Full zoom and pan functionality for detailed inspection
  - **Download Options**: Download buttons for both original and annotated screenshots
  - **Full-Height Display**: Screenshots display at full height with scrolling for complete visibility
  - **Smart Annotation System**: Intelligent filtering showing only meaningful web fonts (maximum ~50 annotations for readability)
- **Inspection Log**: Detailed view of network requests and @font-face declarations per website.
- **Enhanced CSV Export**: Comprehensive CSV export functionality with intelligent font family detection and metadata that includes:
  - **Font Family Identification**: Automatically matches downloaded font files with their CSS @font-face declarations to provide accurate font family names
  - **Detailed Font Information**: Exports font family, font name, format, size (in KB), URL, and source for each font
  - **Complete Metadata Export**: Includes foundry, copyright, version, license info, embedding permissions, designer, and creation date
  - **Active Fonts Data**: Includes separate section for active fonts with usage statistics and element counts
  - **Smart Matching Algorithm**: Uses advanced matching logic to correlate font files with CSS declarations for accurate family names
- **Navigation**: "Back to Project" button for inspections that are part of a project, allowing users to return to the Project Results page.

### 4. Project Results Page
- **Project Summary**: Overview of all websites in the user's project with statistics on total font files detected and actively used fonts.
  - **Most Active Font per Website**: Clickable buttons showing the most frequently used font for each website in the project, allowing quick navigation to individual inspection results.
- **Font Usage Breakdown**: Visual display of all fonts used across websites in the project, showing usage count and relative frequency.
- **Detected Fonts Table**: Comprehensive list of all font files detected across websites, including file details (with sizes in kilobytes (KB)), source, metadata, and which specific website the font appears on.
- **Project-Wide Font Metadata**: Consolidated metadata analysis across all websites showing:
  - **Foundry Distribution**: Overview of font foundries used across the project
  - **Licensing Compliance**: Analysis of embedding permissions and license restrictions
  - **Commercial vs Free Fonts**: Categorization based on foundry and licensing information
- **Advanced Project CSV Export**: Enhanced CSV export for project-wide font analysis with:
  - **Cross-Website Font Analysis**: Export includes website URL, font family, font name, format, size (in KB), and source for comprehensive analysis
  - **Complete Metadata Integration**: Includes foundry, copyright, version, license info, embedding permissions, designer, and creation date for all fonts across websites
  - **Font Family Resolution**: Intelligent matching of font files with CSS declarations across all websites in the project
  - **Consolidated Font Data**: Organized data structure that shows font usage patterns across multiple websites
  - **Accurate Size Reporting**: Font sizes converted to kilobytes with 2 decimal precision for consistent reporting

### 5. About Page
- **Project Description**: Detailed explanation of Font Inspector's purpose and technology.
- **Browser Requirements**: Clear notification that Chrome browser is required for the application to function properly.
- **How It Works**: Overview of the inspection process.
- **Privacy & Security**: Information about user data protection and Google authentication.
- **Team & Contact Information**: Background and contact details for further support.

### 6. Help/FAQ Page
- **Documentation**: Guides on how to use the app.
- **Authentication Help**: Information about Google sign-in and account management.
- **Troubleshooting Tips**: Common issues and resolutions.

### 7. Request Access Page
- **Access Request Form**: Form for new users to request access to Font Inspector.
- **User Information Collection**: Name and email input for access request submission.
- **Request Status**: Clear feedback on request submission and next steps.
- **Admin Contact**: Information about the review process and expected response time.

## Admin System Architecture

### Admin Web Application
The admin system is a separate Next.js web application that provides comprehensive administrative capabilities for Font Inspector. It runs independently from the main desktop application and offers a web-based interface for system administrators. The admin application is deployed to Firebase Hosting and accessible at the dedicated admin URL.

### Admin Site Map & Features

#### 1. Admin Authentication
- **Admin Login**: Secure Google Sign-In authentication for admin users only.
- **Role-Based Access**: Admin users are managed separately from regular application users.
- **Admin User Management**: System for creating and managing admin accounts.

#### 2. Access Request Management
- **Google Access Requests**: Review and manage traditional Google OAuth access requests.
- **Email Registration Requests**: Review and manage email/password registration requests with account creation workflow.
- **Unified Approval Workflow**: Approve or reject both types of requests with reasons and notes.
- **Request History**: Track all access requests and email registrations with status and review history.
- **Account Creation**: Email registration approval automatically creates Firebase user accounts with proper authentication setup.
- **Batch Operations**: Efficiently manage multiple access requests and registrations.

#### 3. User Management
- **User Overview**: Comprehensive view of all application users with status indicators and authentication provider information.
- **Authentication Provider Tracking**: Display whether users authenticated via Google OAuth or email/password.
- **Permission Controls**: Manage user access permissions and monthly usage limits for inspections and projects.
- **Usage Limit Configuration**: Set custom monthly limits for inspections and projects per user.
- **User Suspension**: Temporarily suspend users with duration and reason tracking.
- **Usage Analytics**: Monitor user activity, inspections, and project creation with real-time usage tracking.
- **Profile Editing**: Edit user profiles, permissions, usage limits, and administrative notes for both authentication types.
- **Bulk Operations**: Efficiently manage multiple users with batch permission updates and bulk inspection/project limit modifications.
- **Version Analytics**: Track user adoption of different app versions and monitor upgrade patterns.

#### 4. User Statistics & Analytics
- **Usage Metrics**: Track total users, active users, and growth statistics.
- **Inspection Analytics**: Monitor font inspections and project creation trends.
- **User Engagement**: Track daily, weekly, and monthly active users.
- **Version Distribution**: Monitor app version adoption across user base with detailed version analytics.
- **Export Capabilities**: Export user data and statistics for analysis including version information.

#### 5. System Settings
- **Configuration Management**: System-wide configuration settings and preferences.
- **Export Functionality**: CSV export of user data and statistics for external analysis.

#### 6. Admin Settings
- **Profile Management**: Admin user profile and permission viewing.
- **System Configuration**: Core admin system settings and preferences.
- **Help Documentation**: Admin-specific help and usage documentation.

## Tech Stack

### Desktop Application:
- **Framework**: Electron with Next.js frontend supporting Windows, macOS, and Linux
- **Main Process**: TypeScript-based Electron main process with cross-platform compatibility
- **Renderer Process**: Next.js React application optimized for desktop environments
- **IPC Communication**: Secure Inter-Process Communication between main and renderer processes
- **Native Menus**: Platform-native application menus and shortcuts (macOS, Windows, Linux)
- **Permission Management**: Native platform permission handling (macOS privacy permissions, Windows UAC awareness)
- **Auto-Update System**: Cross-platform automatic updates with manual checking via native menu integration
- **Multi-Platform Packaging**: Professional installers for all platforms (DMG/ZIP for macOS, NSIS/ZIP for Windows, AppImage/DEB for Linux)

### Frontend:
- **Framework**: Next.js (embedded in Electron)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/UI
- **State Management**: React Context
- **Authentication**: Firebase Authentication with Google Sign-In and email/password support (with Electron-specific auth flow)
- **Permissions**: Custom permission management system for macOS integration

### Backend:
- **Environment**: Node.js (running as separate process in Electron)
- **Inspection Engine**: puppeteer-core (with explicit Chrome path management)
- **Multi-Page Discovery Engine**: Automated page discovery system with multiple strategies:
  - **Sitemap Parsing**: Automatic sitemap.xml detection and parsing for structured page discovery
  - **Internal Link Crawling**: DOM analysis to extract and prioritize internal website links
  - **Common Path Detection**: Intelligent checking of standard website paths (about, contact, services, etc.)
  - **Priority Scoring System**: Advanced algorithm for ranking discovered pages by relevance and importance
- **Screenshot System**: Integrated screenshot capture with dual-generation (original + annotated)
- **Font Annotation Engine**: Smart annotation system with DOM manipulation and visual overlay generation
- **Local File Management**: File system operations for screenshot storage and retrieval via Electron IPC
- **Font Metadata Analysis**: opentype.js and fontkit for comprehensive font metadata extraction
- **API Framework**: Express.js
- **Local Database**: SQLite with better-sqlite3 for storing user-specific inspection results and project data locally
- **Authentication**: Firebase Auth for user verification and JWT token validation
- **Chrome Management**: Automatic Chrome/Chromium executable detection and path resolution

### Admin System:
- **Framework**: Next.js (separate web application)
- **Styling**: Tailwind CSS with Shadcn/UI components
- **Authentication**: Firebase Authentication with admin role verification
- **Database**: Firebase/Firestore for admin collections (user management, permissions, statistics)
- **API Architecture**: Independent API endpoints using Firebase Admin SDK (no dependency on main app APIs)
- **Deployment**: Independent deployment from main desktop application
- **Security**: Role-based access control and admin-only routes

### Database Architecture:
- **Local Data Storage**: SQLite databases stored locally on user's machine (`~/FontInspector/databases/{userId}.db`)
- **User Data Isolation**: Each user has their own SQLite database file for complete data separation
- **Firebase Integration**: User authentication, permissions, usage statistics, and admin data stored in Firebase
- **Hybrid Approach**: Inspection and project data stored locally; user management and stats stored in Firebase
- **Real-Time Statistics**: Firebase user stats updated immediately after each local database operation
- **Cost Optimization**: Eliminates Firebase storage costs for inspection data while maintaining authentication and admin features
- **Performance Benefits**: Faster local data access, no network latency for historical data, offline data viewing capability

### Database Naming Conventions:
- **SQLite Schema**: Uses snake_case naming convention for all column names (`created_at`, `updated_at`, `user_id`, `project_id`, `inspection_ids`, `downloaded_fonts`, `font_face_declarations`, `active_fonts`, `screenshot_original`, `screenshot_annotated`, `screenshot_captured_at`, `screenshot_dimensions`, `screenshot_annotation_count`)
- **TypeScript Interfaces**: Uses camelCase naming convention for all properties (`createdAt`, `updatedAt`, `userId`, `projectId`, `inspectionIds`, `downloadedFonts`, `fontFaceDeclarations`, `activeFonts`, `screenshots.original`, `screenshots.annotated`, `screenshots.capturedAt`, `screenshots.dimensions`, `screenshots.annotationCount`)
- **Conversion Layer**: Automatic mapping between snake_case database columns and camelCase TypeScript properties through dedicated conversion methods (`convertToSQLiteFormat()` and `convertFromSQLiteFormat()`)
- **Query Mapping**: Dynamic SQL queries use column mapping to convert camelCase API parameters to snake_case database columns (`orderBy: 'createdAt'` → `ORDER BY created_at`)
- **API Consistency**: All API endpoints maintain camelCase naming for consistency with JavaScript/TypeScript conventions while internally using proper database naming
- **Schema Compatibility**: Database schema mirrors original Firebase structure but with proper SQL naming conventions for optimal database performance

## Key Functionalities

### 1. Native Desktop Experience
- **Cross-Platform Desktop App**: Native application for Windows, macOS, and Linux with proper window management and system integration
- **Platform-Native Menus**: Full menu bar integration with platform-specific conventions and keyboard shortcuts
- **Manual Update Checking**: Native "Check for Updates..." menu item with comprehensive user feedback dialogs
- **Window Management**: Proper window state management, minimize/maximize/close behaviors across all platforms
- **System Integration**: Platform-appropriate integration (macOS dock, Windows taskbar, Linux desktop environments)
- **Authentication Popups**: Seamless Firebase authentication with native popup windows
- **External Link Handling**: Smart link management - auth popups open in-app, other links open in default browser
- **Auto-Update Management**: Automatic hourly update checks with manual trigger capability and platform-specific installers

### 2. Advanced Permission Management
- **macOS Permission System**: Native integration with macOS privacy and security permissions
- **Screen Recording Permission**: Required for enhanced website content capture and font analysis
- **Accessibility Permission**: Optional permission for enhanced font detection capabilities
- **Permission Dialogs**: User-friendly permission request dialogs with clear explanations
- **Settings Integration**: Direct links to macOS System Settings for permission management
- **Graceful Degradation**: App functions with basic permissions, enhanced features require additional permissions

### 3. Enhanced Browser Engine Integration
- **puppeteer-core Implementation**: Lightweight Puppeteer integration without bundled Chromium
- **Automatic Chrome Detection**: Intelligent detection of Chrome/Chromium installations across macOS
- **Custom Chrome Path Support**: Environment variable support for custom Chrome installations
- **Optimized Launch Options**: Enhanced browser launch configuration for better performance and security
- **Error Handling**: Comprehensive browser launch error handling with user-friendly messages

### 4. User Authentication & Access Control
- **Multi-Method Authentication**: Support for both Google OAuth and email/password authentication through Firebase Auth with Electron-specific flow
- **Google Authentication**: Traditional Google OAuth with secure popup-based sign-in flow
- **Email/Password Authentication**: Full email/password authentication with registration, sign-in, and password reset capabilities
- **Native Auth Popups**: Seamless authentication experience with properly sized popup windows for both authentication methods
- **Admin-Controlled Access**: All new users must request access through dedicated systems regardless of authentication method
- **Registration Workflows**: 
  - **Google Users**: Submit access requests, admin approval grants immediate access
  - **Email Users**: Submit registration requests with account details, admin approval creates Firebase account
- **User Data Isolation**: Complete separation of user data - users can only access their own inspections, projects, and history
- **Authentication Gates**: All app functionality requires authentication - unauthenticated users see only the login page
- **Secure API Access**: All API endpoints require valid Firebase ID tokens and enforce user-based access control
- **User Profile Management**: Display user information (name, email, avatar, authentication provider) and logout functionality in desktop interface
- **Permission System**: User access permissions and usage limits managed through admin system
- **Real-time Permission Checking**: Live validation of user permissions before API operations
- **Usage Limit Enforcement**: Monthly limits for inspections and projects with automatic enforcement
- **Permission Feedback**: Clear visual indicators when users lack permissions or exceed limits
- **Password Management**: Built-in password reset functionality for email/password users
- **Graceful Permission Handling**: UI components disabled when permissions are insufficient with explanatory messages

### 5. User Interface & Experience
- **Native Desktop UI**: Electron-powered desktop interface with native look and feel
- **macOS Design Language**: Interface follows macOS design principles and guidelines
- **Responsive Design**: Optimized for desktop usage with proper window sizing and scaling
- **Personalized Experience**: User-specific greeting, data display, and navigation
- **Usage Status Display**: Current monthly usage statistics displayed in user profile dropdown
- **Permission-Aware Interface**: Form components automatically disabled when user lacks permissions
- **Real-time Feedback**: Clear visual indicators for permission status and usage limits
- **Versatile Input Options**: 
  - **Single URL with Multi-Page Discovery**: URL input with radio button selection for inspection scope (1, 5, or 10 pages) with auto-discovery capabilities
  - **Manual Multi-URL Input**: Traditional project creation form for manually entering multiple website URLs
  - **Smart Project Creation**: Multi-page inspections automatically generate projects with descriptive names
  - **Permission Integration**: All input options include real-time permission validation and usage limit checking
- **Real-Time Feedback**: Loading indicators and error messages for each inspection request
- **User-Specific Inspection Queue Management**: Handle and display the status of the authenticated user's multiple, concurrent website inspections
- **Personal Project Management**: Create, view, and manage the user's projects containing multiple website inspections
- **Personal History Management**: View, search, and filter the user's past inspections with options to re-run or delete previous inspections
- **Seamless Navigation**: Intuitive navigation between user's projects and their individual inspections, with contextual breadcrumb-style navigation buttons

### 6. Enhanced Website Inspection Module
- **Headless Browser Execution**: Use puppeteer-core with automatic Chrome detection to load target URLs
- **Advanced Chrome Management**: Intelligent Chrome/Chromium path detection and fallback strategies
- **Multi-Page Discovery System**: Comprehensive page discovery for automated website analysis:
  - **Intelligent Page Detection**: Automatically discovers 5-10 relevant pages from any website
  - **Sitemap Integration**: Parses sitemap.xml files for structured page discovery with priority ranking
  - **Link Analysis**: Crawls main page to extract and evaluate internal links with content-based scoring
  - **Common Path Detection**: Checks standard website paths (about, contact, services, blog, etc.) with HEAD requests
  - **Priority Algorithm**: Advanced scoring system that ranks pages by importance, content type, and relevance
  - **URL Normalization**: Smart URL normalization that removes tracking parameters and hash fragments
  - **Project Auto-Generation**: Automatically creates projects for multi-page inspections with descriptive naming
  - **Fallback Handling**: Graceful degradation to single-page inspection if discovery fails
- **Network Request Interception**: Filter and log requests for font files (.woff, .woff2, .ttf, etc.)
- **CSS Parsing**: Extract @font-face rules to identify intended fonts
- **Font Usage Detection**: Evaluate computed styles in the DOM to determine actively used fonts
- **Screenshot Capture System**: Comprehensive website screenshot functionality with:
  - **Dual Screenshot Generation**: Captures both original and annotated versions of each website
  - **Smart Font Annotation**: Intelligent annotation system that highlights text elements with colored borders and labels
  - **Local File Storage**: Screenshots stored locally in user's filesystem (~/FontInspector/screenshots/) to optimize costs and performance
  - **Environment Detection**: Conditional screenshot capture only in Electron desktop environment
  - **Annotation Filtering**: Smart filtering system that excludes system fonts and focuses on meaningful web fonts
  - **Annotation Limits**: Maximum ~50 annotations per page for optimal readability and performance
  - **Visual Design**: Clean colored borders around text elements with always-visible font labels and connecting lines
- **Font Metadata Extraction**: Comprehensive metadata extraction from font files including:
  - **Foundry/Manufacturer Information**: Identify font creators and publishers
  - **Copyright and Licensing**: Extract embedded copyright notices and license terms
  - **Embedding Permissions**: Analyze font embedding rights and restrictions
  - **Version and Designer Data**: Extract version numbers, creation dates, and designer information
  - **Unique Identifiers**: Extract font-specific identifiers for tracking and verification
- **Enhanced Error Handling**: Comprehensive error handling for browser launch, navigation, and network issues
- **User Association**: All inspections are automatically associated with the authenticated user
- **Cache Management**: Advanced cache control for consistent inspection results

### 7. Data Processing & Aggregation
- **Result Aggregation**: Compare network log with CSS parsed data to generate a consolidated list per website.
- **User-Scoped Project Analysis**: Aggregate data from multiple websites in a user's project for cross-site font analysis.
- **Error Handling**: Robust handling of network errors, CORS issues, and invalid URLs across multiple inspections.
- **Security Measures**: Sandbox execution for external website content and prevent abuse (rate limiting, request validation, user authentication).

### 8. Native Desktop Features
- **Cross-Platform Application Packaging**: Electron Builder configuration for macOS (DMG + ZIP), Windows (NSIS + ZIP), and Linux (AppImage + DEB) distributions
- **Comprehensive Auto-Updates**: Built-in update mechanism with automatic hourly checks and manual update checking via application menu
- **Manual Update Checking**: Native "Check for Updates..." menu item in application menu bar with user feedback dialogs
- **Multi-Platform Update Support**: Seamless auto-updates for Windows, macOS, and Linux with platform-specific installers
- **Local Screenshot Storage**: Native file system integration for screenshot storage and management with organized directory structure
- **IPC Communication**: Secure Inter-Process Communication for screenshot file operations between main and renderer processes
- **Performance Optimization**: Native desktop performance with proper memory management across all platforms
- **File System Access**: Direct file system access for enhanced functionality including screenshot management
- **System Notifications**: Native notification support for inspection completion
- **Keyboard Shortcuts**: Full keyboard shortcut support following platform conventions
- **Platform Integration**: Proper system integration (macOS dock, Windows system tray, Linux desktop files)

### 9. Admin System Integration
- **Separate Web Application**: Independent Next.js admin application for system management
- **User Access Control**: Admin-managed user approval and permission system
- **Activity Monitoring**: Comprehensive logging and monitoring of user activities
- **Real-time Management**: Live user management with immediate permission updates
- **Security Features**: Role-based admin authentication and secure admin operations
- **Analytics Dashboard**: Detailed analytics and reporting for system administrators
- **Audit Trail**: Complete audit logging for compliance and security purposes

## Build Approach

### 1. Desktop Application Development:
- **Electron Setup**: Configure Electron with TypeScript for main process and Next.js for renderer
- **Build Pipeline**: Set up concurrent development workflow with hot reloading for both Electron and Next.js
- **Permission Integration**: Implement macOS permission checking and management system
- **IPC Architecture**: Design secure Inter-Process Communication between main and renderer processes
- **Authentication Flow**: Adapt Firebase authentication for Electron environment with popup handling
- **Menu System**: Implement native macOS application menus with proper keyboard shortcuts
- **Window Management**: Configure proper window behavior, state persistence, and lifecycle management

### 2. Enhanced Frontend Development:
- **Electron-Next.js Integration**: Seamless integration of Next.js within Electron renderer process
- **Permission Components**: Build React components for permission management and user guidance
- **Desktop-Optimized UI**: Adapt interface for desktop usage patterns and window management
- **Authentication Context**: Implement React context for managing user authentication state in Electron
- **Native Integration**: Utilize Electron APIs for enhanced desktop functionality
- **Error Boundaries**: Implement comprehensive error handling for desktop environment

### 3. Advanced Backend Development:
- **puppeteer-core Integration**: Migrate from puppeteer to puppeteer-core for better control and performance
- **Chrome Detection System**: Implement automatic Chrome/Chromium executable detection and path management
- **Enhanced Launch Options**: Configure advanced browser launch options for security and performance
- **Process Management**: Implement proper process lifecycle management within Electron environment
- **Permission-Aware Operations**: Adapt backend operations to work with macOS permission constraints
- **Error Recovery**: Implement robust error recovery and fallback mechanisms

### 4. Testing & Deployment:
- **Cross-Platform Testing**: Comprehensive testing on Windows, macOS, and Linux with various Chrome installations and permission states
- **Platform-Specific Permission Testing**: Test app behavior with different permission configurations across all supported platforms
- **Authentication Testing**: Test Firebase authentication flow in Electron environment across all platforms
- **Multi-Platform Build Testing**: Test Electron build process and distribution packages for Windows (NSIS/ZIP), macOS (DMG/ZIP), and Linux (AppImage/DEB)
- **Performance Testing**: Ensure optimal performance in desktop environment across all platforms
- **Update Testing**: Test auto-update mechanism, manual update checking, and version migration across all platforms
- **Windows-Specific Testing**: Test NSIS installer, Windows-native features, and Windows auto-update functionality

### 5. Admin System Development:
- **Next.js Admin App**: Build separate web-based admin application with React and TypeScript
- **Admin Authentication**: Implement Firebase auth with admin role verification and secure login
- **Independent API Layer**: Create dedicated API endpoints using Firebase Admin SDK for all admin operations
- **User Management System**: Create comprehensive user management with access control and permissions
- **Email Registration Management**: Implement server-side email/password user creation and approval system
- **Activity Logging**: Implement real-time activity monitoring and audit trail functionality
- **Dashboard Analytics**: Build analytics dashboard for user statistics and system monitoring with version tracking capabilities
- **Bulk Operations Interface**: Implement bulk user management interface for efficient permission and limit updates
- **Version Analytics Dashboard**: Create version adoption tracking and analytics visualization
- **Admin UI Components**: Develop admin-specific UI components using Shadcn/UI and Tailwind CSS

### 6. Distribution & Deployment:
- **Multi-Platform Electron Builder**: Configure electron-builder for macOS (DMG + ZIP), Windows (NSIS + ZIP), and Linux (AppImage + DEB) distribution
- **Cross-Platform Release Management**: Enhanced release script supporting platform-specific builds (`./publish-release.sh [patch|minor|major] [mac|win|linux|all]`)
- **Windows-Specific Configuration**: Professional NSIS installer with proper ICO icons and Windows-native user experience
- **Code Signing**: Set up proper macOS code signing for security and user trust
- **Notarization**: Configure macOS notarization for distribution outside Mac App Store
- **GitHub Releases Integration**: Automated publishing to GitHub releases with proper update metadata for all platforms
- **Version Management**: Implement proper version control and release management across all supported platforms
- **Admin App Deployment**: Deploy admin application separately with Firebase Hosting (currently deployed and operational)
- **Platform-Specific Documentation**: Create user documentation for installation and usage across Windows, macOS, and Linux

## UI Style and Theme

- **Component Library**: Shadcn/UI (adapted for desktop usage)
- **Style**: Clean, modern desktop application design
- **Theme**: Light Mode (Default Shadcn theme with `Neutral` base color) with potential for dark mode support
- **Layout**: Desktop-optimized layout with proper window sizing and content organization
- **Native Integration**: Follows macOS design principles and Human Interface Guidelines
- **Authentication UI**: Clean Google sign-in experience with native popup windows
- **Permission UI**: User-friendly permission dialogs with clear explanations and direct settings access
- **User Profile**: Elegant desktop-style user profile management in application header
- **Rationale**: Chosen for its adaptability to desktop environments, seamless integration with Electron/Next.js/Tailwind, customizable components, and professional desktop application aesthetic

## Recent Major Updates

### Email/Password Authentication Implementation (Latest)
- **Multi-Method Authentication**: Implemented comprehensive email/password authentication alongside existing Google OAuth system
- **Email Registration System**: Created complete user registration workflow with admin approval process for email/password accounts
- **Admin Account Creation**: Email registration approval automatically creates Firebase user accounts with proper authentication setup
- **Enhanced Login Interface**: Updated login page to support both authentication methods with seamless switching between Google and email options
- **Password Management**: Implemented secure password reset functionality using Firebase's built-in password reset system
- **Registration Validation**: Comprehensive form validation including email format validation, password strength requirements (6+ characters), and duplicate account checking
- **Admin Integration**: Extended admin system to manage both Google access requests and email registration requests in unified workflow
- **Authentication Context Enhancement**: Updated AuthContext to support email authentication methods (`signInWithEmail`, `resetPassword`) while maintaining existing Google OAuth functionality
- **User Profile Extensions**: Extended user profiles to track authentication provider (Google vs email/password) for proper user management
- **Security Features**: Implemented secure temporary password storage for admin approval workflow with automatic cleanup after account creation
- **Error Handling**: Comprehensive error handling for email authentication including user-friendly error messages for various authentication failure scenarios
- **Webhook Integration**: Added webhook notifications for new email registration requests to notify administrators
- **Data Model Extensions**: Created new Firebase collections (`email_registrations`) and extended user data models to support email authentication
- **Backward Compatibility**: Maintained full backward compatibility with existing Google authentication while adding new email authentication options

### Database System Overhaul
- **Local SQLite Implementation**: Complete migration from Firebase/Firestore to local SQLite databases for inspection and project data storage
- **Cost Optimization**: Eliminated Firebase storage costs by moving all inspection data to local storage while maintaining authentication and admin features
- **User Data Isolation**: Each user gets their own SQLite database file (`~/FontInspector/databases/{userId}.db`) for complete data separation
- **Hybrid Architecture**: Local SQLite for data storage, Firebase for authentication, user permissions, and usage statistics
- **Real-Time Statistics**: Firebase user stats updated immediately after each local database operation to maintain real-time usage tracking
- **Performance Enhancement**: Faster data access from local SQLite database with no network latency for historical data retrieval
- **Fresh Start Approach**: No data migration from Firebase - users start with clean local databases for simplified implementation
- **Naming Convention System**: Implemented comprehensive mapping between database snake_case columns (`created_at`, `user_id`) and TypeScript camelCase interfaces (`createdAt`, `userId`)
- **Database Services**: Built complete service layer with LocalInspectionService and LocalProjectService for CRUD operations
- **DatabaseFactory Pattern**: Centralized management of user-specific database instances with proper initialization and cleanup
- **Schema Mirroring**: SQLite schema perfectly mirrors original Firebase structure with proper indexes for performance optimization
- **Authentication Integration**: All database operations require valid Firebase authentication tokens for security
- **Offline Data Access**: Users can view historical inspection data without internet connection while authentication is still required for new inspections
- **Storage Benefits**: No Firebase document limits, unlimited local storage capacity, complete user control over their data

### Multi-Page Inspection Feature
- **Automated Page Discovery**: Implemented comprehensive multi-page inspection capability allowing users to analyze 5-10 pages from any website automatically
- **Intelligent Discovery Engine**: Advanced page discovery system using multiple strategies:
  - **Sitemap Integration**: Automatic sitemap.xml parsing with priority-based page ranking
  - **Internal Link Analysis**: DOM crawling to extract and evaluate internal links with content-based scoring
  - **Common Path Detection**: Smart checking of standard website paths (about, contact, services, etc.) using HEAD requests
  - **Priority Scoring Algorithm**: Advanced algorithm that ranks pages by relevance, content type, and importance
- **Smart URL Normalization**: Intelligent URL processing that removes tracking parameters, hash fragments, and duplicate URLs
- **Seamless Project Creation**: Multi-page inspections automatically generate projects with descriptive names based on the website domain
- **Enhanced User Interface**: Added radio button selection in URL input form for choosing inspection scope (1, 5, or 10 pages)
- **Fallback Handling**: Graceful degradation to single-page inspection if page discovery fails, ensuring reliability
- **Performance Optimization**: Concurrent page processing with proper error handling and timeout management
- **API Integration**: New `/api/discover-pages` endpoint with authentication, rate limiting, and comprehensive error handling
- **User Experience Enhancement**: Clear visual indicators and explanatory text for multi-page options with auto-discovery capabilities

### Font Metadata Extraction Implementation
- **Advanced Font Compliance Features**: Implemented comprehensive font metadata extraction for legal compliance auditing
- **Font Parsing Libraries**: Integrated opentype.js and fontkit packages for parsing font file metadata
- **Comprehensive Metadata Extraction**: Extract foundry information, copyright notices, licensing terms, embedding permissions, version data, designer information, and creation dates
- **Data Model Extensions**: Extended FontMetadata and DownloadedFont interfaces to include complete metadata fields
- **Inspection Service Integration**: Seamlessly integrated metadata extraction into existing font processing pipeline with graceful error handling
- **Enhanced CSV Exports**: Updated CSV export functionality to include complete font metadata for compliance reporting
- **Embedding Permissions Analysis**: Advanced analysis of OS/2 table fsType bits to determine web embedding rights
- **Database Persistence**: Complete metadata is saved to local SQLite database and retrieved for historical analysis
- **Performance Optimization**: Efficient metadata extraction with ~100-200ms overhead per font file
- **Error Resilience**: Graceful degradation ensures inspections continue even if metadata extraction fails
- **Business Value**: Provides crucial tools for font license compliance auditing and legal evidence gathering

### Font Family Detection & CSV Export Enhancement
- **Intelligent Font Family Detection**: Implemented 4-tier priority system for font names:
  1. Metadata font name (most accurate)
  2. Active fonts matching
  3. CSS @font-face declarations
  4. Filename fallback
- **Enhanced Data Export**: CSV exports now include comprehensive font family information alongside existing font name, format, size, URL, and source data
- **Smart Matching Algorithm**: Advanced algorithm correlates font URLs with CSS declarations using multiple matching strategies for accurate font family names
- **Improved Size Formatting**: Font sizes now exported in kilobytes with 2 decimal precision for consistent and readable reporting
- **Active Fonts Integration**: Added separate active fonts section in inspection CSV exports with usage statistics and element counts
- **Project-Wide Analysis**: Enhanced project CSV exports include website URL, font family, and consolidated font data for cross-website analysis
- **Fallback Handling**: Graceful fallback to 'Unknown' when font family cannot be determined from CSS declarations
- **Consistent Headers**: Standardized CSV headers across inspection and project exports for better data analysis workflows

### UI/UX and System Requirements Updates
- **Title Simplification**: Streamlined application branding by removing "by Kimmy" from main titles while retaining attribution in footer
- **Chrome Browser Requirement**: Added prominent browser requirement notification in About page informing users that Chrome browser is required
- **System Font Detection**: Implemented intelligent system font identification with proper labeling (e.g., "System font - Times New Roman")
- **Enhanced Active Fonts Display**: Added font file names with extensions for web fonts, providing clear visibility of downloaded font files
- **Error Message Improvements**: Replaced generic failure messages with detailed, specific error reasons for better troubleshooting
- **Admin System Deployment**: Successfully deployed admin web application to Firebase Hosting with dedicated admin URL

### Admin System Enhancements
- **Bulk Permission Management**: Implemented bulk operations for efficiently updating inspection and project limits across multiple users
- **User Version Tracking**: Added comprehensive app version tracking system that records current app version for each user login
- **Version Migration System**: Created migration script for retroactively adding version information to existing users
- **Enhanced User Analytics**: Improved user statistics tracking with version-aware analytics for adoption patterns
- **Permission System Refinements**: Enhanced real-time permission validation and usage limit tracking

### Electron Conversion (Desktop Application)
- **Platform Migration**: Successfully converted from Progressive Web App (PWA) to native desktop application using Electron
- **Enhanced Performance**: Improved inspection performance with native desktop resources and direct system access
- **Better User Experience**: Native desktop interface with proper window management and system integration
- **Offline Capabilities**: Enhanced offline functionality with desktop-level resource management

### puppeteer-core Integration
- **Lightweight Implementation**: Migrated from puppeteer to puppeteer-core to reduce bundle size and improve control
- **Chrome Management**: Implemented intelligent Chrome/Chromium detection across different installation paths
- **Custom Browser Control**: Enhanced browser launch configuration with custom executable path support
- **Error Resilience**: Improved error handling and fallback mechanisms for browser-related operations

### macOS Permission System
- **Native Permission Integration**: Full integration with macOS privacy and security permission system
- **Screen Recording**: Implemented screen recording permission for enhanced website capture capabilities
- **Accessibility Support**: Added accessibility permission support for advanced font detection features
- **User Guidance**: Created comprehensive permission management UI with direct settings access

### Authentication Enhancement
- **Multi-Method Authentication**: Implemented comprehensive authentication system supporting both Google OAuth and email/password
- **Electron-Optimized Auth**: Adapted Firebase authentication for optimal Electron experience with both authentication methods
- **Native Popup Handling**: Implemented proper authentication popup window management for Google OAuth
- **Email Authentication Flow**: Built complete email/password authentication with registration, sign-in, and password reset
- **Admin Registration Workflow**: Created admin-managed approval system for email/password account creation
- **Secure IPC**: Enhanced security for authentication token handling between processes
- **Seamless Integration**: Maintained existing authentication flow while adding new authentication methods and desktop-specific enhancements

### Admin System Implementation
- **Comprehensive User Management**: Built full-featured admin web application for user access control and management
- **Access Request System**: Implemented user access request and approval workflow with admin review capabilities
- **Permission Management**: Created granular user permission system with usage limits and suspension capabilities
- **Real-time Analytics**: Implemented user statistics, usage analytics, and system monitoring dashboards
- **Admin Authentication**: Separate admin authentication system with role-based access control

### Permission System & Usage Limits
- **Real-time Permission Checking**: Implemented client-side permission validation that checks user permissions before allowing actions
- **Usage Limit Enforcement**: Server-side enforcement of monthly inspection and project limits with proper HTTP status codes
- **Permission-Aware UI**: Form components automatically disabled when users lack permissions with clear explanatory messages
- **Live Usage Tracking**: Real-time display of current monthly usage in user profile dropdown
- **Default Permissions**: Fallback permission system for users without explicit admin-set permissions
- **Graceful Error Handling**: Comprehensive error handling with user-friendly messages for different permission scenarios
- **Admin Configuration**: Full admin control over user permissions, usage limits, and account suspension
- **Permission Caching**: Efficient permission checking system to minimize API calls while maintaining real-time accuracy

### CSV Export Enhancement
- **Font Family Detection**: Implemented intelligent font family identification that matches downloaded font files with CSS @font-face declarations
- **Enhanced Data Export**: CSV exports now include comprehensive font family information alongside existing font name, format, size, URL, and source data
- **Smart Matching Algorithm**: Advanced algorithm correlates font URLs with CSS declarations using multiple matching strategies for accurate font family names
- **Improved Size Formatting**: Font sizes now exported in kilobytes with 2 decimal precision for consistent and readable reporting
- **Active Fonts Integration**: Added separate active fonts section in inspection CSV exports with usage statistics and element counts
- **Project-Wide Analysis**: Enhanced project CSV exports include website URL, font family, and consolidated font data for cross-website analysis
- **Fallback Handling**: Graceful fallback to 'Unknown' when font family cannot be determined from CSS declarations
- **Consistent Headers**: Standardized CSV headers across inspection and project exports for better data analysis workflows

### Server-Side Utility Enhancements
- **Timestamp Formatting Utilities**: Implemented dedicated server-side utilities for consistent timestamp formatting across Firebase Timestamp, Date objects, and string formats
- **Server-Client Separation**: Created separate timestamp formatting functions for server-side (`server-utils.ts`) and client-side (`utils.ts`) use to prevent hydration issues
- **Enhanced Error Handling**: Comprehensive error handling for timestamp conversion with graceful fallbacks
- **ISO String Standardization**: All timestamps consistently formatted as ISO strings for API responses and data processing

### Improved User Interface & Experience
- **Enhanced Date Formatting**: Consistent date formatting across all components with relative time display (e.g., "2 hours ago", "3 days ago")
- **Advanced Filtering & Sorting**: Recent Inspections component now includes date range filtering, text search, and multiple sorting options
- **Pagination Support**: Implemented pagination for inspection history with configurable items per page
- **Visual Feedback Improvements**: Better loading states, error messages, and status indicators for user actions
- **Delete Confirmation Dialogs**: Added confirmation dialogs for destructive actions with clear explanations

### Performance Optimization
- **Activity Logging Removal**: Removed comprehensive activity logging system to improve application performance and reduce database overhead
- **Faster API Responses**: Eliminated blocking database write operations during inspections and project creation for improved response times
- **Reduced Network Latency**: Removed Firebase write operations to activity logs collection, reducing network overhead and improving user experience
- **Streamlined Operations**: Simplified API endpoints by removing activity logging calls while maintaining essential user statistics tracking

### User Statistics & Analytics Enhancement  
- **Real-time User Statistics**: Comprehensive user statistics tracking including total inspections, projects, and monthly activity counts
- **Monthly Usage Reset**: Automatic monthly reset of usage counters with proper timezone handling
- **User Engagement Metrics**: Track daily, weekly, and monthly active users with detailed engagement patterns
- **Performance Analytics**: Monitor user activity patterns, session duration, and feature usage
- **Administrative Insights**: Detailed analytics for administrators to monitor system usage and user behavior

### Enhanced API & Database Integration
- **Improved Error Handling**: Comprehensive error handling across all API endpoints with proper HTTP status codes
- **Authentication Flow Enhancements**: Better authentication error handling with automatic retry mechanisms
- **Database Query Optimization**: Optimized Firestore queries with proper user filtering and composite index management
- **Data Consistency**: Improved data validation and consistency checks across all database operations
- **Response Formatting**: Standardized API response formats with consistent timestamp and data structure formatting

### Permission System Refinements
- **Real-time Permission Validation**: Enhanced permission checking system with live validation and immediate UI feedback
- **Usage Limit Monitoring**: Real-time monitoring of user usage against monthly limits with proactive notifications
- **Permission Caching**: Intelligent permission caching to reduce API calls while maintaining real-time accuracy
- **Graceful Degradation**: Improved UI behavior when users lack permissions or exceed limits with clear explanatory messages
- **Admin Configuration**: Enhanced admin controls for managing user permissions and usage limits with bulk operations support

### User Isolation & Data Security Improvements
- **Complete User Data Isolation**: Enhanced user data isolation with comprehensive testing and validation
- **Migration Support**: Built robust migration system for existing data with proper user assignment and validation
- **Authentication Gate Enhancements**: Improved authentication flow with better error handling and user feedback
- **API Security**: Enhanced API security with proper token validation and user verification on all endpoints
- **Backward Compatibility**: Maintained backward compatibility while implementing new security features

### Manual Update Checking & Windows Support
- **Manual Update Menu Integration**: Added "Check for Updates..." menu item to the application menu bar following native platform conventions
- **User-Friendly Update Dialogs**: Implemented comprehensive update checking with native dialogs for all update states (checking, available, not available, error)
- **Development vs Production Awareness**: Smart update checking that displays appropriate messages in development vs production environments
- **Windows Platform Support**: Complete Windows support with professional NSIS installer, portable ZIP versions, and native ICO icons
- **Cross-Platform Auto-Updates**: Seamless automatic updates for Windows users with hourly background checks and immediate installation
- **Enhanced Release Script**: Multi-platform release management supporting targeted builds (`./publish-release.sh patch win` for Windows-only releases)
- **Windows User Experience**: Professional Windows installer with desktop shortcuts, start menu integration, and proper uninstaller
- **GitHub Integration**: Automated publishing of Windows binaries (NSIS installer + ZIP files) to GitHub releases with proper update metadata
- **Cross-Platform Testing**: Comprehensive testing across Windows, macOS, and Linux platforms
- **Update State Management**: Prevents duplicate update checks and provides clear user feedback throughout the update process