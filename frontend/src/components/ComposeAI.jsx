import React, { useState, useRef, useEffect } from 'react';
import AIInput from './AIInput';
import AIPipelineLog from './AIPipelineLog';
import AIOutput from './AIOutput';
import AIHistory from './AIHistory';

export default function ComposeAI({ API }) {
  const [phases, setPhases] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline'); // pipeline | history
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const startPipeline = async (formData) => {
    setIsRunning(true);
    setPhases([]);
    setResult(null);
    setError(null);
    setSessionId(null);
    setProvider(null);

    try {
      const response = await fetch(`${API}/api/ai/creative/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // SSE reading via fetch streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          
          if (line.startsWith('event: ')) {
            const eventType = line.replace('event: ', '').trim();
            const dataLine = lines[i + 1];
            
            if (dataLine && dataLine.startsWith('data: ')) {
              try {
                const data = JSON.parse(dataLine.slice(6));
                
                if (eventType === 'session') {
                  setSessionId(data.sessionId);
                  setProvider(data.provider || 'gemini');
                } else if (eventType === 'phase') {
                  setPhases(prev => {
                    const existing = prev.findIndex(p => p.phaseNumber === data.phaseNumber);
                    if (existing >= 0) {
                      const updated = [...prev];
                      updated[existing] = data;
                      return updated;
                    }
                    // Insert phase in the correct order to maintain sequence
                    const updated = [...prev, data];
                    updated.sort((a, b) => a.phaseNumber - b.phaseNumber);
                    return updated;
                  });
                } else if (eventType === 'complete') {
                  setResult(data.result);
                  setIsRunning(false);
                } else if (eventType === 'error') {
                  setError(data.message || 'Unknown error');
                  setIsRunning(false);
                }
              } catch (e) {
                console.error('Failed to parse event data:', e);
              }
            }
            i++; // Skip the data line we just processed
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Pipeline failed to start');
      setIsRunning(false);
    }
  };

  // Calculate phase progress
  const completedPhases = phases.filter(p => p.status !== 'running').length;
  const totalPhases = 19; // Total phases in the pipeline (including phase 0)
  const progressPercentage = isRunning ? Math.min(100, Math.floor((completedPhases / totalPhases) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h2 style={{
            margin: '0 0 4px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            ✨ AI Creative Engine
          </h2>
          {provider && (
            <p style={{
              margin: 0,
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              Using {provider === 'gemini' ? 'Google Gemini 2.0 Flash' : 'BigModel GLM 4 Flash'}
            </p>
          )}
          {isRunning && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ height: '4px', backgroundColor: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${progressPercentage}%`, 
                    backgroundColor: '#7c3aed', 
                    transition: 'width 0.3s ease' 
                  }}
                ></div>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                {completedPhases} of {totalPhases} phases completed ({progressPercentage}%)
              </p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('pipeline')}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: activeTab === 'pipeline' ? '#7c3aed' : 'var(--bg-elevated)',
              color: activeTab === 'pipeline' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 200ms'
            }}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: activeTab === 'history' ? '#7c3aed' : 'var(--bg-elevated)',
              color: activeTab === 'history' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 200ms'
            }}
          >
            History
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT: Input + Log */}
        <div style={{
          width: '340px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            overflowY: 'auto',
            maxHeight: '400px'
          }}>
            <AIInput onSubmit={startPipeline} isRunning={isRunning} />
          </div>
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto'
          }}>
            <AIPipelineLog phases={phases} isRunning={isRunning} error={error} />
          </div>
        </div>

        {/* RIGHT: Output */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {activeTab === 'pipeline' && (
            <AIOutput result={result} phases={phases} sessionId={sessionId} API={API} isRunning={isRunning} />
          )}
          {activeTab === 'history' && <AIHistory API={API} />}
        </div>
      </div>
    </div>
  );
}