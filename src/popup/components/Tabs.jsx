import React from 'react';

function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'contacts', label: 'Contacts', count: 0 },
    { id: 'deals', label: 'Deals', count: 0 },
    { id: 'tasks', label: 'Tasks', count: 0 }
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Tabs;
