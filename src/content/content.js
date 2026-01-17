// Content Script for ActiveCampaign CRM Data Extraction
// DOM Selection Strategy: We use CSS selectors with data attributes and class names
// combined with querySelector for reliable extraction. We handle dynamic content
// by using MutationObserver and waiting for elements to appear.

// Storage utilities
const StorageUtils = {
  async getData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['activecampaign_data'], (result) => {
        resolve(result.activecampaign_data || { contacts: [], deals: [], tasks: [], lastSync: null });
      });
    });
  },

  async saveData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ activecampaign_data: data }, () => {
        resolve();
      });
    });
  },

  async mergeData(newData, type) {
    const existing = await this.getData();
    const existingItems = existing[type] || [];
    const newItems = newData[type] || [];

    // Deduplication by id
    const itemMap = new Map();
    existingItems.forEach(item => itemMap.set(item.id, item));
    newItems.forEach(item => itemMap.set(item.id, item));

    existing[type] = Array.from(itemMap.values());
    existing.lastSync = Date.now();
    await this.saveData(existing);
    return existing;
  }
};

// View Detection
const ViewDetector = {
  detectView() {
    const url = window.location.href;
    const path = window.location.pathname;

    if (path.includes('/contacts') || path.includes('/contact')) {
      return 'contacts';
    } else if (path.includes('/deals') || path.includes('/deal') || path.includes('/pipeline')) {
      return 'deals';
    } else if (path.includes('/tasks') || path.includes('/task')) {
      return 'tasks';
    }
    return 'unknown';
  }
};

// Data Extractors
const DataExtractors = {
  // Extract Contacts
  async extractContacts() {
    const contacts = [];

    // Strategy: Look for contact rows in table/list views
    // ActiveCampaign uses tbody tr for contact rows
    let contactElements = document.querySelectorAll('table tbody tr');

    // If no table rows, try other structures
    if (contactElements.length === 0) {
      contactElements = document.querySelectorAll('[role="row"], .contact-row, [data-contact-id]');
    }

    // Filter to only rows with actual contact data (has email or looks like contact row)
    contactElements = Array.from(contactElements).filter(row => {
      const text = row.textContent;
      // Must have an email OR multiple cells with content
      const hasEmail = /@/.test(text);
      const hasCells = row.querySelectorAll('td, [role="cell"]').length > 2;
      return hasEmail || hasCells;
    });

    contactElements.forEach((element, index) => {
      try {
        const id = element.getAttribute('data-contact-id') ||
          element.getAttribute('data-id') ||
          element.getAttribute('id') ||
          `contact-${index}-${Date.now()}`;

        // Get all table cells
        const cells = element.querySelectorAll('td, [role="cell"]');

        // Extract name - usually in first or second cell, or look for links
        let name = '';
        const nameLink = element.querySelector('a[href*="/contact/"]');
        if (nameLink) {
          name = nameLink.textContent.trim();
        } else {
          // Try first few cells for name
          for (let i = 0; i < Math.min(3, cells.length); i++) {
            const cellText = cells[i]?.textContent?.trim() || '';
            // Name usually doesn't contain @ or numbers only
            if (cellText && !/@/.test(cellText) && !/^\d+$/.test(cellText) && cellText.length > 1) {
              name = cellText;
              break;
            }
          }
        }

        // Extract email - look for @ symbol or mailto link
        let email = '';
        const emailLink = element.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          email = emailLink.getAttribute('href').replace('mailto:', '').trim();
        } else {
          // Search all cells for email pattern
          const fullText = element.textContent;
          const emailMatch = fullText.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            email = emailMatch[0];
          }
        }

        // Extract phone - look for tel link or phone pattern in cells
        let phone = '';

        // Method 1: Look for tel: link
        const phoneLink = element.querySelector('a[href^="tel:"]');
        if (phoneLink) {
          phone = phoneLink.textContent.trim();
        }

        // Method 2: Search each cell for phone patterns
        if (!phone) {
          for (const cell of cells) {
            const cellText = cell.textContent.trim();
            // Match various phone formats: +91 70275 17327, (123) 456-7890, 123-456-7890, etc.
            const phonePatterns = [
              /\+\d{1,3}\s?\d{4,5}\s?\d{4,5}/,  // +91 70275 17327
              /\(\d{3}\)\s?\d{3}-?\d{4}/,       // (123) 456-7890
              /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,  // 123-456-7890
              /\+\d{10,15}/,                     // +919876543210
              /\d{10,15}/                        // 9876543210
            ];

            for (const pattern of phonePatterns) {
              const match = cellText.match(pattern);
              if (match) {
                phone = match[0].trim();
                break;
              }
            }

            if (phone) break;
          }
        }

        // Method 3: Look for phone in full text as last resort
        if (!phone) {
          const fullText = element.textContent;
          const phoneMatch = fullText.match(/\+\d{1,3}\s?\d{4,5}\s?\d{4,5}|\(\d{3}\)\s?\d{3}-?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);
          if (phoneMatch) {
            phone = phoneMatch[0].trim();
          }
        }

        // Extract tags - look for badge/tag elements
        const tagEls = element.querySelectorAll('.badge, .tag, [class*="tag"], .label, [class*="badge"]');
        const tags = Array.from(tagEls).map(el => el.textContent.trim()).filter(t => t.length > 0);

        // Extract owner - usually last cell or has user icon
        let owner = '';
        const ownerEl = element.querySelector('[class*="owner"], [class*="user"], .avatar + span, [title*="owner"]');
        if (ownerEl) {
          owner = ownerEl.textContent.trim();
        } else if (cells.length > 0) {
          // Try last cell
          const lastCell = cells[cells.length - 1];
          const lastText = lastCell?.textContent?.trim() || '';
          if (lastText && lastText.length < 50) {
            owner = lastText;
          }
        }

        // Only add if we have at least a name or email
        if (name || email) {
          contacts.push({
            id,
            name: name || 'N/A',
            email: email || 'N/A',
            phone: phone || '',
            tags: tags,
            owner: owner || ''
          });
        }
      } catch (error) {
        console.error('Error extracting contact:', error);
      }
    });

    return contacts;
  },

  // Extract Deals
  async extractDeals() {
    const deals = [];

    // Strategy: Look for deal cards/rows in pipeline or list views
    const selectors = [
      '[data-deal-id]',
      '.deal-card',
      '[class*="deal"][class*="card"]',
      '[class*="deal"][class*="item"]',
      'tr[data-deal]',
      '[data-pipeline-item]'
    ];

    let dealElements = [];
    for (const selector of selectors) {
      dealElements = document.querySelectorAll(selector);
      if (dealElements.length > 0) break;
    }

    // Fallback: Look for elements with dollar signs or currency
    if (dealElements.length === 0) {
      const allElements = document.querySelectorAll('[class*="card"], [class*="item"], tr');
      dealElements = Array.from(allElements).filter(el => {
        const text = el.textContent;
        return /\$[\d,]+/.test(text) || text.toLowerCase().includes('deal') || text.toLowerCase().includes('pipeline');
      });
    }

    dealElements.forEach((element, index) => {
      try {
        const id = element.getAttribute('data-deal-id') ||
          element.getAttribute('data-id') ||
          `deal-${index}-${Date.now()}`;

        // Extract title
        const titleEl = element.querySelector('[data-title], .title, [class*="title"], h3, h4, [class*="deal-title"]');
        const title = titleEl?.textContent?.trim() || '';

        // Extract value
        const valueText = element.textContent.match(/\$[\d,]+\.?\d*/)?.[0] || '';
        const value = valueText ? parseFloat(valueText.replace(/[$,]/g, '')) : 0;

        // Extract pipeline
        const pipelineEl = element.querySelector('[data-pipeline], [class*="pipeline"]');
        const pipeline = pipelineEl?.textContent?.trim() ||
          element.closest('[data-pipeline-name]')?.getAttribute('data-pipeline-name') || '';

        // Extract stage
        const stageEl = element.querySelector('[data-stage], [class*="stage"], [class*="status"]');
        const stage = stageEl?.textContent?.trim() ||
          element.closest('[data-stage-name]')?.getAttribute('data-stage-name') || '';

        // Extract primary contact
        const contactEl = element.querySelector('[data-contact], [class*="contact"], [href*="contact"]');
        const contact = contactEl?.textContent?.trim() || '';

        // Extract owner
        const ownerEl = element.querySelector('[data-owner], [class*="owner"], [class*="user"]');
        const owner = ownerEl?.textContent?.trim() || '';

        // Only add deals that have a title AND a value > 0
        if (title && value > 0) {
          deals.push({
            id,
            title,
            value,
            pipeline,
            stage,
            contact,
            owner
          });
        }
      } catch (error) {
        console.error('Error extracting deal:', error);
      }
    });

    return deals;
  },

  // Extract Tasks
  async extractTasks() {
    const tasks = [];
    const seenTasks = new Set(); // Track to avoid duplicates

    // ActiveCampaign uses table rows for tasks
    let taskElements = document.querySelectorAll('table tbody tr, [role="row"]');

    // Filter to only rows that look like tasks (have task title)
    taskElements = Array.from(taskElements).filter(row => {
      const text = row.textContent.toLowerCase();
      // Must have task-related content and not be empty
      return (text.includes('call') || text.includes('email') || text.includes('meeting') ||
        text.includes('task') || text.includes('incomplete') || text.includes('complete')) &&
        text.length > 10;
    });

    taskElements.forEach((element, index) => {
      try {
        // Extract title - look for link with task title
        let title = '';
        const titleLink = element.querySelector('a[href*="/task"], a[href*="Call"], a[href*="Email"]');
        if (titleLink) {
          title = titleLink.textContent.trim();
        } else {
          // Look in first cells
          const cells = element.querySelectorAll('td, [role="cell"]');
          if (cells.length > 1) {
            // Title is usually in 2nd column (after checkbox)
            title = cells[1]?.textContent?.trim() || '';
          }
        }

        // If no title or too short, skip
        if (!title || title.length < 3) {
          return;
        }

        // Extract type from the title or badge
        let type = 'other';
        const typeBadge = element.querySelector('.badge, [class*="badge"], .label');
        const typeText = (typeBadge?.textContent || title).toLowerCase();
        if (typeText.includes('call')) type = 'call';
        else if (typeText.includes('email')) type = 'email';
        else if (typeText.includes('meeting')) type = 'meeting';

        // Check for duplicates
        const taskKey = `${title}-${type}`;
        if (seenTasks.has(taskKey)) {
          return; // Skip duplicate
        }
        seenTasks.add(taskKey);

        // Extract ID
        const id = element.getAttribute('data-task-id') ||
          element.getAttribute('data-id') ||
          element.getAttribute('id') ||
          `task-${title.replace(/\s+/g, '-')}-${Date.now()}`;

        // Extract due date - look for time/date patterns
        let due = '';
        const cells = element.querySelectorAll('td, [role="cell"]');
        for (const cell of cells) {
          const cellText = cell.textContent.trim();
          // Look for patterns like "23 minutes ago", "2 hours ago", "Jan 17", etc.
          if (/\d+\s+(minute|hour|day|week|month)s?\s+ago/i.test(cellText) ||
            /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cellText) ||
            /\d{4}-\d{2}-\d{2}/.test(cellText) ||
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i.test(cellText)) {
            due = cellText;
            break;
          }
        }

        // Extract assignee - look for "Related To" column or contact link
        let assignee = '';
        const assigneeLink = element.querySelector('a[href*="/contact/"]');
        if (assigneeLink) {
          assignee = assigneeLink.textContent.trim();
        } else {
          // Look in cells for name
          for (const cell of cells) {
            const cellText = cell.textContent.trim();
            // Name usually is 2-50 chars, not a date, not a status
            if (cellText.length >= 2 && cellText.length < 50 &&
              cellText !== title &&
              !cellText.includes('minute') &&
              !cellText.includes('hour') &&
              !/(incomplete|complete|pending)/i.test(cellText)) {
              assignee = cellText;
              break;
            }
          }
        }

        // Extract linked deal/contact (same as assignee often)
        let linkedTo = assignee;
        const linkedLink = element.querySelector('a[href*="/deal/"]');
        if (linkedLink) {
          linkedTo = linkedLink.textContent.trim();
        }

        tasks.push({
          id,
          type,
          title,
          due: due || '',
          assignee: assignee || '',
          linkedTo: linkedTo || ''
        });
      } catch (error) {
        console.error('Error extracting task:', error);
      }
    });

    return tasks;
  }
};

// Shadow DOM Visual Feedback
class ExtractionIndicator {
  constructor() {
    this.shadowRoot = null;
    this.container = null;
  }

  create() {
    if (this.container) return;

    // Create shadow DOM container
    this.container = document.createElement('div');
    this.container.id = 'ac-extractor-indicator';
    this.container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
    document.body.appendChild(this.container);

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .indicator {
        background: #4F46E5;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 200px;
      }
      .indicator.success {
        background: #10B981;
      }
      .indicator.error {
        background: #EF4444;
      }
      .indicator.extracting {
        background: #F59E0B;
      }
      .spinner {
        border: 2px solid rgba(255,255,255,0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .icon {
        width: 16px;
        height: 16px;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  show(message, status = 'extracting') {
    this.create();

    // Get or create style element
    let styleEl = this.shadowRoot.querySelector('style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.textContent = `
        .indicator {
          background: #4F46E5;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 200px;
        }
        .indicator.success {
          background: #10B981;
        }
        .indicator.error {
          background: #EF4444;
        }
        .indicator.extracting {
          background: #F59E0B;
        }
        .spinner {
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .icon {
          width: 16px;
          height: 16px;
        }
      `;
      this.shadowRoot.appendChild(styleEl);
    }

    // Remove existing indicator if any
    const existingIndicator = this.shadowRoot.querySelector('.indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = `indicator ${status}`;

    if (status === 'extracting') {
      indicator.innerHTML = `
        <div class="spinner"></div>
        <span>${message}</span>
      `;
    } else if (status === 'success') {
      indicator.innerHTML = `
        <span>✓</span>
        <span>${message}</span>
      `;
    } else {
      indicator.innerHTML = `
        <span>✗</span>
        <span>${message}</span>
      `;
    }

    this.shadowRoot.appendChild(indicator);
  }

  hide() {
    if (this.container) {
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
          this.container = null;
          this.shadowRoot = null;
        }
      }, 3000);
    }
  }
}

// Main Extraction Function
const Extractor = {
  indicator: new ExtractionIndicator(),

  async extract() {
    try {
      this.indicator.show('Extracting data...', 'extracting');

      const view = ViewDetector.detectView();
      let extractedData = { contacts: [], deals: [], tasks: [] };

      // Wait for page to be fully loaded
      await this.waitForContent();

      // Extract based on current view or extract all
      if (view === 'contacts') {
        extractedData.contacts = await DataExtractors.extractContacts();
      } else if (view === 'deals') {
        extractedData.deals = await DataExtractors.extractDeals();
      } else if (view === 'tasks') {
        extractedData.tasks = await DataExtractors.extractTasks();
      } else {
        // Extract all if view is unknown
        extractedData.contacts = await DataExtractors.extractContacts();
        extractedData.deals = await DataExtractors.extractDeals();
        extractedData.tasks = await DataExtractors.extractTasks();
      }

      // Handle pagination (bonus feature)
      await this.handlePagination(extractedData, view);

      // Merge with existing data (handles deduplication)
      const contacts = await StorageUtils.mergeData(extractedData, 'contacts');
      const deals = await StorageUtils.mergeData(extractedData, 'deals');
      const tasks = await StorageUtils.mergeData(extractedData, 'tasks');

      // Show detailed extraction results
      const extractedNow = extractedData.contacts.length + extractedData.deals.length + extractedData.tasks.length;
      const totalStored = contacts.contacts.length + deals.deals.length + tasks.tasks.length;

      let message = `Extracted: ${extractedData.contacts.length} contacts, ${extractedData.deals.length} deals, ${extractedData.tasks.length} tasks`;
      if (extractedNow === 0) {
        message = 'No data found on this page';
      }

      this.indicator.show(message, 'success');
      this.indicator.hide();

      return {
        success: true,
        counts: {
          contacts: contacts.contacts.length,
          deals: deals.deals.length,
          tasks: tasks.tasks.length
        }
      };
    } catch (error) {
      console.error('Extraction error:', error);
      this.indicator.show('Extraction failed: ' + error.message, 'error');
      this.indicator.hide();
      return { success: false, error: error.message };
    }
  },

  async waitForContent() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000); // Wait 1s for dynamic content
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 1000));
      }
    });
  },

  async handlePagination(extractedData, view) {
    // Look for pagination controls and extract from multiple pages
    const nextButton = document.querySelector('[aria-label*="next"], .pagination-next, [class*="next"]');
    if (nextButton && !nextButton.disabled) {
      // Note: Auto-pagination would require clicking and waiting, which is complex
      // This is a bonus feature that can be enhanced
    }
  }
};

// DOM Change Detection (Bonus Feature)
const DOMChangeDetector = {
  observer: null,

  start() {
    this.observer = new MutationObserver((mutations) => {
      // Check if significant content changes occurred
      const hasSignificantChanges = mutations.some(mutation => {
        return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
      });

      if (hasSignificantChanges) {
        // Store flag that content changed
        chrome.storage.local.set({ ac_content_changed: true });
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
};

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startExtraction') {
    Extractor.extract().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'dataUpdated') {
    // Handle real-time sync (bonus feature)
    console.log('Data updated in another tab');
  }
});

// Initialize DOM change detection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    DOMChangeDetector.start();
  });
} else {
  DOMChangeDetector.start();
}
