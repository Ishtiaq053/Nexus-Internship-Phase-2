import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { checkBackendHealth } from '../../lib/api';

export const BackendStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const testConnection = async () => {
    setStatus('checking');
    setErrorMessage('');
    try {
      const res = await checkBackendHealth();
      console.log('[API Health Check]:', res);
      if (res.status === 'ok') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
        setErrorMessage(`Unexpected status: ${res.status}`);
      }
    } catch (err: any) {
      console.error('[API Health Check Error]:', err);
      setStatus('disconnected');
      setErrorMessage(err.message || 'Failed to connect to backend');
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg border text-xs font-medium backdrop-blur-md transition-all duration-300 animate-fade-in bg-white/95 border-gray-200 text-gray-800">
      <Server size={14} className="text-gray-500" />
      <span className="font-semibold text-gray-700">API Status:</span>
      {status === 'checking' && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <RefreshCw size={13} className="animate-spin" />
          <span>Connecting...</span>
        </div>
      )}
      {status === 'connected' && (
        <div className="flex items-center gap-1 text-emerald-600 font-semibold">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span>Connected (/api/health ok)</span>
        </div>
      )}
      {status === 'disconnected' && (
        <div className="flex items-center gap-1.5 text-rose-600 font-semibold" title={errorMessage}>
          <XCircle size={14} className="text-rose-500" />
          <span>Disconnected</span>
        </div>
      )}
      <button
        onClick={testConnection}
        className="ml-1 p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
        title="Retry connection"
        aria-label="Retry connection"
      >
        <RefreshCw size={12} className={status === 'checking' ? 'animate-spin' : ''} />
      </button>
    </div>
  );
};
