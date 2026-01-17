import React, { useState } from 'react';

function ExportButton({ data }) {
  const [showMenu, setShowMenu] = useState(false);

  const exportToJSON = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activecampaign-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const exportToCSV = (type) => {
    const items = data[type] || [];
    if (items.length === 0) {
      alert(`No ${type} to export`);
      return;
    }

    // Get headers from first item
    const headers = Object.keys(items[0]);
    const csvRows = [headers.join(',')];

    // Add data rows
    items.forEach(item => {
      const values = headers.map(header => {
        const value = item[header];
        if (Array.isArray(value)) {
          return `"${value.join('; ')}"`;
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvStr = csvRows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activecampaign-${type}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          ></div>
          <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-xl z-20 border border-gray-200">
            <div className="py-1">
              <button
                onClick={exportToJSON}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export All as JSON
              </button>
              <div className="border-t border-gray-200 my-1"></div>
              <button
                onClick={() => exportToCSV('contacts')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export Contacts as CSV
              </button>
              <button
                onClick={() => exportToCSV('deals')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export Deals as CSV
              </button>
              <button
                onClick={() => exportToCSV('tasks')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export Tasks as CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ExportButton;
