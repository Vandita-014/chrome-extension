# ActiveCampaign CRM Data Extractor

A Chrome Extension that extracts Contacts, Deals, and Tasks from ActiveCampaign CRM and stores them locally for easy access.

## Features

- Extract Contacts, Deals, and Tasks from ActiveCampaign pages
- Store data locally using Chrome storage API
- Beautiful React dashboard with search and filtering
- Delete individual records
- Export data as JSON or CSV
- Real-time sync across browser tabs
- Visual feedback during extraction

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google Chrome browser

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chrome-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```
   This creates a `dist` folder with all compiled files.

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

5. **Test it**
   - Navigate to your ActiveCampaign account
   - Click the extension icon
   - Click "Extract Now" to extract data from the current page

## Development

```bash
# Development mode with auto-rebuild
npm run dev

# Production build
npm run build
```

## How It Works

### Data Extraction

The extension uses content scripts to scrape data from ActiveCampaign pages. Here's my approach:

**DOM Selection Strategy:**
- Primary: CSS selectors with data attributes (`[data-contact-id]`, `[data-deal-id]`)
- Secondary: Semantic class names (`.contact-row`, `.deal-card`)
- Fallback: Pattern matching (email regex, currency patterns, phone formats)

**Handling Dynamic Content:**
ActiveCampaign is a SPA, so I:
1. Wait for `document.readyState === 'complete'` plus 1 second buffer
2. Use `MutationObserver` to detect DOM changes
3. Try multiple selector strategies until elements are found

**View Detection:**
I detect the current view by analyzing the URL path:
- `/contacts` or `/contact` → Contacts view
- `/deals` or `/deal` or `/pipeline` → Deals view  
- `/tasks` or `/task` → Tasks view
- Unknown → Extract all data types

### Storage Schema

Data is stored in `chrome.storage.local` with this structure:

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

**Data Integrity:**
- Deduplication: Uses `Map` with `id` as key to prevent duplicates
- Updates: Merges new data with existing, updating records with same `id`
- Race Conditions: Uses atomic `chrome.storage.local` operations
- Deletions: Filters array to remove item by `id`

## Project Structure

```
chrome-extension/
├── src/
│   ├── background/
│   │   └── background.js          # Service worker
│   ├── content/
│   │   └── content.js              # Data extraction logic
│   └── popup/
│       ├── index.jsx               # React entry point
│       ├── App.jsx                 # Main app component
│       └── components/             # React components
├── icons/                          # Extension icons
├── manifest.json                   # Extension manifest
└── package.json                    # Dependencies
```

## Technical Details

- **Manifest V3**: Uses service worker instead of background page
- **React 18**: Modern React with hooks for UI
- **TailwindCSS**: Utility-first CSS framework
- **Shadow DOM**: Visual feedback indicator with style isolation
- **Webpack**: Module bundler for building

## Usage

1. Navigate to an ActiveCampaign page (Contacts, Deals, or Tasks)
2. Click the extension icon in Chrome toolbar
3. Click "Extract Now" button
4. Watch the indicator on the page (top-left) show extraction progress
5. View extracted data in the popup dashboard
6. Use search to filter data
7. Delete records or export as CSV/JSON

## Troubleshooting

**Extension won't load?**
- Make sure `dist` folder exists after running `npm run build`
- Check that icons are in `icons/` folder
- Verify Developer mode is enabled
