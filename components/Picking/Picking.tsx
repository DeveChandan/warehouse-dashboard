import React, { useState, useEffect } from 'react';

export default function Picking() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vepToken, setVepToken] = useState('2025-M251-0000097390');
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // This effect can be used for observing state changes or other side effects.
    // The console.logs have been removed from the main logic for cleaner code.
  }, [logs, isSending]);

  const fetchLogs = async () => {
    setLoading(true);
    setLogs([]);
    setSelectedLogs(new Set());
    try {
      const response = await fetch(`http://10.255.20.7:4000/records/toGeneratedLogs?vepToken=${vepToken}`);
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLogSelection = (logId) => {
    setSelectedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedLogs.size === logs.length) {
      setSelectedLogs(new Set());
    } else {
      const allIds = new Set(logs.map(log => log._id));
      setSelectedLogs(allIds);
    }
  };

  const handleSendPickingRequests = async () => {
    if (selectedLogs.size === 0) {
      return;
    }

    setIsSending(true);

    const requests = Array.from(selectedLogs).map(async logId => {
      const log = logs.find(l => l._id === logId);
      if (!log) return null;

      const payload = {
        vepToken,
        selectedItems: log.payload?.getloadingsequence?.results || [],
      };

      try {
        const response = await fetch('/api/sap-picking-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        const sapMessage = result?.message?.trim() || "Operation successful.";
        const sapRescode = result?.rescode || "";

        return {
          logId,
          sapResponse: {
            message: response.ok ? sapMessage : `Error: ${sapMessage}`,
            rescode: sapRescode,
            status: response.ok ? 'success' : 'error',
          },
        };
      } catch (error) {
        console.error(`Failed to send request for log ${logId}:`, error);
        return {
          logId,
          sapResponse: {
            message: 'Network Error: Failed to connect to server.',
            rescode: '',
            status: 'error',
          },
        };
      }
    });

    const results = await Promise.allSettled(requests);

    setLogs(prevLogs =>
      prevLogs.map(log => {
        const result = results.find(res => res.value?.logId === log._id);
        if (result && result.status === 'fulfilled') {
          return {
            ...log,
            sapResponse: result.value.sapResponse,
          };
        }
        return log;
      })
    );

    setSelectedLogs(new Set());
    setIsSending(false);
  };


  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4">
      {/* Search Input and Button */}
      <div className="flex items-center mb-5 mt-2">
        <input
          type="text"
          className="flex-1 h-10 border border-gray-300 rounded-lg px-3 mr-3 bg-white"
          placeholder="Enter VEP Token"
          value={vepToken}
          onChange={(e) => setVepToken(e.target.value)}
        />
        <button
          className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600"
          onClick={fetchLogs}
          disabled={loading || isSending}
        >
          {loading ? 'Searching...' : 'Search Logs'}
        </button>
      </div>

      {/* Loading State */}
      {(loading || isSending) && (
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-3 text-base text-gray-600">{loading ? 'Loading logs...' : 'Sending requests...'}</p>
        </div>
      )}

      {/* Data Display and Actions */}
      {!loading && logs.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-600 font-bold">{selectedLogs.size} selected</p>
            <button
              className="py-2 px-3 rounded-lg bg-gray-200 text-gray-800 font-bold text-xs"
              onClick={handleSelectAll}
            >
              {selectedLogs.size === logs.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {/* Scrollable Log List */}
          <div className="flex-1 overflow-y-auto pb-5">
            {logs.map(log => {
              const isSelected = selectedLogs.has(log._id);
              const cardBorderColor = log.sapResponse?.status === 'success' ? 'border-green-500'
                : log.sapResponse?.status === 'error' ? 'border-red-500'
                : 'border-transparent';

              return (
                <div
                  key={log._id}
                  className={`bg-white rounded-xl p-4 mb-4 shadow-md border-2 cursor-pointer
                    ${isSelected ? 'border-blue-500' : cardBorderColor}`}
                  onClick={() => toggleLogSelection(log._id)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-lg font-bold text-gray-800">DO No: {log.doNo}</p>
                    <span
                      className={`py-1 px-3 rounded-full font-bold text-xs text-white
                        ${log.status === 'success' ? 'bg-green-500' : 'bg-yellow-400'}`}
                    >
                      {log.status === 'success' ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{log.response?.d?.message}</p>
                  {/* Table with Data */}
                  <div className="border border-gray-300 rounded-lg overflow-hidden mb-3">
                    <div className="flex border-b border-gray-300 bg-gray-100">
                      <span className="flex-1 p-2 font-bold text-center text-xs text-gray-700">Material</span>
                      <span className="flex-1 p-2 font-bold text-center text-xs text-gray-700">Batch</span>
                      <span className="flex-1 p-2 font-bold text-center text-xs text-gray-700">Qty</span>
                      <span className="flex-1 p-2 font-bold text-center text-xs text-gray-700">Unit</span>
                      <span className="flex-1 p-2 font-bold text-center text-xs text-gray-700">Item</span>

                    </div>
                    {log.payload?.getloadingsequence?.results.map((item, index) => (
                      <div key={index} className="flex border-b border-gray-300 last:border-b-0">
                        <span className="flex-1 p-2 text-center text-xs text-gray-600">{item.matnr}</span>
                        <span className="flex-1 p-2 text-center text-xs text-gray-600">{item.charg}</span>
                        <span className="flex-1 p-2 text-center text-xs text-gray-600">{item.lfimg}</span>
                        <span className="flex-1 p-2 text-center text-xs text-gray-600">{item.meins}</span>
                        <span className="flex-1 p-2 text-center text-xs text-gray-600">{item.uecha}</span>
                      </div>
                    ))}
                    {/* New: Display per-ODB SAP Response */}
                    {log.sapResponse && (
                      <div className={`p-2 font-bold text-center text-xs rounded-b-lg`}>
                        <p className={`p-2 font-bold text-center text-xs ${log.sapResponse.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                          Status: {log.sapResponse.message}
                        </p>
                        {log.sapResponse.rescode && (
                          <p className={`p-2 font-bold text-center text-xs ${log.sapResponse.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                            Code: {log.sapResponse.rescode}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Send Request Button */}
          <button
            className={`bg-blue-500 text-white font-bold py-3 px-5 rounded-lg shadow-md hover:bg-blue-600 transition-colors
              ${selectedLogs.size === 0 || isSending ? 'bg-gray-400 cursor-not-allowed' : ''}`}
            onClick={handleSendPickingRequests}
            disabled={selectedLogs.size === 0 || isSending}
          >
            {isSending ? 'Sending...' : `Send Picking Request (${selectedLogs.size})`}
          </button>
        </>
      )}

      {/* No Data Found State */}
      {!loading && logs.length === 0 && vepToken && (
        <div className="flex-1 flex justify-center items-center">
          <p className="text-base text-gray-600">No logs found for this VEP Token.</p>
        </div>
      )}
    </div>
  );
}
