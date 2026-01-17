# ActiveCampaign CRM Data Extractor

A Chrome Extension that extracts Contacts, Deals, and Tasks from ActiveCampaign CRM, stores them locally, and displays them in a beautiful React dashboard.

## Features

### Core Features
- ✅ **Data Extraction**: Extracts Contacts, Deals, and Tasks from ActiveCampaign CRM
- ✅ **Local Storage**: Stores all data in `chrome.storage.local` with deduplication
- ✅ **React Dashboard**: Beautiful popup UI built with React and TailwindCSS
- ✅ **Shadow DOM Feedback**: Visual extraction status indicator with style isolation
- ✅ **Search & Filter**: Search across all extracted data
- ✅ **Delete Records**: Remove individual records from storage
- ✅ **Last Sync Timestamp**: Track when data was last extracted

### Bonus Features
- ✅ **Real-time Sync**: Data syncs across all open tabs using `chrome.storage.onChanged`
- ✅ **Export Data**: Export as JSON or CSV (per data type)
- ✅ **DOM Change Detection**: Monitors page changes for re-extraction prompts
- ✅ **Pagination Support**: Framework for handling paginated content

## Technology Stack

- **Chrome Manifest V3**: Service worker + content scripts
- **React.js 18**: Modern React with hooks
- **TailwindCSS**: Utility-first CSS framework
- **Webpack 5**: Module bundler
- **Babel**: JavaScript transpiler

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google Chrome browser

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd chrome-extension
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Build the Extension
```bash
npm run build
```

This will create a `dist` folder with all the compiled files.

### Step 4: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist` folder from this project
5. The extension icon should now appear in your Chrome toolbar

### Step 5: Test the Extension

1. Navigate to your ActiveCampaign CRM account (https://*.activecampaign.com)
2. Go to Contacts, Deals, or Tasks view
3. Click the extension icon in your toolbar
4. Click **"Extract Now"** to extract data from the current page
5. View extracted data in the popup dashboard

## Development

### Development Mode (Auto-rebuild)
```bash
npm run dev
```

This watches for file changes and automatically rebuilds the extension.

### Production Build
```bash
npm run build
```

## Project Structure

```
chrome-extension/
├── src/
│   ├── background/
│   │   └── background.js          # Service worker (Manifest V3)
│   ├── content/
│   │   └── content.js              # Content script for data extraction
│   └── popup/
│       ├── index.jsx               # React entry point
│       ├── index.css               # TailwindCSS imports
│       ├── App.jsx                 # Main app component
│       └── components/
│           ├── Dashboard.jsx       # Main dashboard
│           ├── Tabs.jsx            # Tab navigation
│           ├── ContactsTab.jsx     # Contacts table view
│           ├── DealsTab.jsx       # Deals table view
│           ├── TasksTab.jsx        # Tasks table view
│           ├── ExtractButton.jsx  # Extract action button
│           └── ExportButton.jsx   # Export functionality
├── icons/                          # Extension icons (16x16, 48x48, 128x128)
├── manifest.json                   # Chrome extension manifest
├── webpack.config.js              # Webpack configuration
├── tailwind.config.js             # TailwindCSS configuration
├── postcss.config.js              # PostCSS configuration
└── package.json                   # Dependencies and scripts
```

## DOM Selection Strategy

### Approach
We use a **multi-strategy CSS selector approach** with fallbacks to ensure robust data extraction:

1. **Primary Strategy**: Data attributes (`data-contact-id`, `data-deal-id`, etc.)
2. **Secondary Strategy**: Semantic class names (`.contact-row`, `.deal-card`)
3. **Tertiary Strategy**: Pattern matching (email regex, currency patterns)
4. **Fallback Strategy**: Content-based detection (text patterns, keywords)

### Handling Dynamic Content

ActiveCampaign is a Single Page Application (SPA) with lazy-loaded content. Our extraction handles this by:

1. **Wait Strategy**: Waits for `document.readyState === 'complete'` plus 1 second buffer
2. **MutationObserver**: Monitors DOM changes for re-extraction opportunities
3. **Multiple Selectors**: Tries multiple selector strategies until elements are found
4. **Content Patterns**: Falls back to regex patterns when DOM structure is unknown

### View Detection

The extension detects which ActiveCampaign view you're on by analyzing the URL path:

- `/contacts` or `/contact` → Contacts view
- `/deals` or `/deal` or `/pipeline` → Deals view
- `/tasks` or `/task` → Tasks view
- Unknown → Extracts all data types

### Extraction Details

#### Contacts
- **Selectors**: `tr[data-contact-id]`, `.contact-row`, `tr:has([data-email])`
- **Fields**: name, email, phone, tags, owner
- **Fallback**: Email regex pattern matching

#### Deals
- **Selectors**: `[data-deal-id]`, `.deal-card`, `[data-pipeline-item]`
- **Fields**: title, value, pipeline, stage, contact, owner
- **Fallback**: Currency pattern matching (`$123.45`)

#### Tasks
- **Selectors**: `[data-task-id]`, `.task-item`, `[data-activity-id]`
- **Fields**: type (call/email/meeting), title, due date, assignee, linkedTo
- **Fallback**: Keyword matching (call, email, meeting) + date patterns

## Storage Schema

### Data Structure
```json
{
  "activecampaign_data": {
    "contacts": [
      {
        "id": "contact-123",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1-555-1234",
        "tags": ["VIP", "Enterprise"],
        "owner": "Jane Smith"
      }
    ],
    "deals": [
      {
        "id": "deal-456",
        "title": "Enterprise Deal",
        "value": 50000,
        "pipeline": "Sales Pipeline",
        "stage": "Negotiation",
        "contact": "John Doe",
        "owner": "Jane Smith"
      }
    ],
    "tasks": [
      {
        "id": "task-789",
        "type": "call",
        "title": "Follow-up call",
        "due": "12/25/2024",
        "assignee": "Jane Smith",
        "linkedTo": "deal-456"
      }
    ],
    "lastSync": 1703520000000
  }
}
```

### Data Integrity Features

1. **Deduplication**: Uses `Map` with `id` as key to prevent duplicates
2. **Race Condition Handling**: Uses `chrome.storage.local` atomic operations
3. **Updates**: Merges new data with existing, updating records with same `id`
4. **Deletions**: Filters out deleted records by `id`

### Storage Operations

- **Get Data**: `chrome.storage.local.get(['activecampaign_data'])`
- **Save Data**: `chrome.storage.local.set({ activecampaign_data: data })`
- **Merge Data**: Combines new and existing data, deduplicates by `id`
- **Delete Record**: Filters array to remove item by `id`

## Usage Guide

### Extracting Data

1. Navigate to an ActiveCampaign page (Contacts, Deals, or Tasks)
2. Click the extension icon
3. Click **"Extract Now"** button
4. Watch the Shadow DOM indicator show extraction progress
5. Data is automatically saved and displayed in the dashboard

### Viewing Data

- Use the **tabs** to switch between Contacts, Deals, and Tasks
- Use the **search bar** to filter across all fields
- View **last sync timestamp** in the header

### Managing Data

- **Delete**: Click "Delete" button on any record row
- **Export**: Click "Export" button (bottom-right) to download as JSON or CSV

### Real-time Sync

When data is extracted in one tab, it automatically syncs to all other open tabs via `chrome.storage.onChanged` listener.

## API Reference

### Background Script (Service Worker)

#### Message Handlers
- `extractData`: Triggers extraction on active tab
- `getStoredData`: Retrieves all stored data
- `deleteRecord`: Deletes a record by type and id
- `exportData`: Returns data for export

### Content Script

#### Extraction Functions
- `DataExtractors.extractContacts()`: Extracts contacts from page
- `DataExtractors.extractDeals()`: Extracts deals from page
- `DataExtractors.extractTasks()`: Extracts tasks from page

#### Utilities
- `ViewDetector.detectView()`: Detects current ActiveCampaign view
- `StorageUtils`: Storage operations with deduplication
- `ExtractionIndicator`: Shadow DOM visual feedback
- `DOMChangeDetector`: Monitors DOM changes

## Error Handling

- **Extraction Errors**: Caught and logged, shown in Shadow DOM indicator
- **Storage Errors**: Handled with try-catch and user notifications
- **Network Errors**: Gracefully handles missing data
- **DOM Errors**: Fallback selectors prevent extraction failures

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)

## Limitations

1. **ActiveCampaign Structure**: Extraction relies on DOM structure; ActiveCampaign UI changes may require selector updates
2. **Pagination**: Auto-pagination requires manual enhancement (framework provided)
3. **Authentication**: Requires user to be logged into ActiveCampaign
4. **Rate Limiting**: No built-in rate limiting for extraction

## Troubleshooting

### Extension Not Loading
- Check that `dist` folder exists and contains `manifest.json`
- Verify Chrome Developer mode is enabled
- Check browser console for errors

### Extraction Not Working
- Ensure you're on an ActiveCampaign page (`*.activecampaign.com`)
- Check browser console for extraction errors
- Verify page is fully loaded before extracting

### Data Not Persisting
- Check Chrome storage: `chrome://extensions/` → Extension → Inspect views → Service Worker → Console
- Verify `chrome.storage.local` permissions in manifest

### UI Not Displaying
- Rebuild extension: `npm run build`
- Reload extension in Chrome
- Check for React errors in popup console

## Future Enhancements

- [ ] Auto-pagination extraction
- [ ] Scheduled extraction
- [ ] Data visualization charts
- [ ] Filter by date ranges
- [ ] Bulk delete operations
- [ ] Import/restore from backup
- [ ] ActiveCampaign API integration (optional)

## License

MIT License - feel free to use this project for your assessment or portfolio.

## Author

Built for ActiveCampaign CRM Data Extractor Technical Assessment

---

**Note**: This extension uses DOM scraping and does not require ActiveCampaign API access. Use ActiveCampaign's free trial to test the extension.
