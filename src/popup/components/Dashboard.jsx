import React, { useState, useEffect } from 'react';
import Tabs from './Tabs';
import ContactsTab from './ContactsTab';
import DealsTab from './DealsTab';
import TasksTab from './TasksTab';
import ExtractButton from './ExtractButton';
import ExportButton from './ExportButton';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [data, setData] = useState({
    contacts: [],
    deals: [],
    tasks: [],
    lastSync: null
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
    
    // Listen for storage changes (real-time sync across tabs)
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.activecampaign_data) {
        setData(changes.activecampaign_data.newValue || {
          contacts: [],
          deals: [],
          tasks: [],
          lastSync: null
        });
      }
    });
  }, []);

  const loadData = () => {
    chrome.runtime.sendMessage({ action: 'getStoredData' }, (response) => {
      if (response && response.data) {
        setData(response.data);
      }
    });
  };

  const handleExtract = async () => {
    setIsLoading(true);
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'extractData' }, (response) => {
          resolve(response);
        });
      });

      if (response && response.success) {
        // Reload data after extraction
        setTimeout(() => {
          loadData();
          setIsLoading(false);
        }, 1000);
      } else {
        setIsLoading(false);
        alert('Extraction failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (error) {
      setIsLoading(false);
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = (type, id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      chrome.runtime.sendMessage({ action: 'deleteRecord', type, id }, (response) => {
        if (response && response.success) {
          loadData();
        }
      });
    }
  };

  const filterData = (items) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      return Object.values(item).some(value => {
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(query));
        }
        return String(value).toLowerCase().includes(query);
      });
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">ActiveCampaign CRM Extractor</h1>
          <div className="text-sm">
            Last Sync: {formatDate(data.lastSync)}
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search across all data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Extract Button */}
        <ExtractButton onExtract={handleExtract} isLoading={isLoading} />
      </div>

      {/* Tabs */}
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'contacts' && (
          <ContactsTab
            contacts={filterData(data.contacts || [])}
            onDelete={(id) => handleDelete('contacts', id)}
          />
        )}
        {activeTab === 'deals' && (
          <DealsTab
            deals={filterData(data.deals || [])}
            onDelete={(id) => handleDelete('deals', id)}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab
            tasks={filterData(data.tasks || [])}
            onDelete={(id) => handleDelete('tasks', id)}
          />
        )}
      </div>

      {/* Export Button */}
      <div className="fixed bottom-4 right-4">
        <ExportButton data={data} />
      </div>
    </div>
  );
}

export default Dashboard;
