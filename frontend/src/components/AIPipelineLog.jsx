import React from 'react';

const STATUS_ICONS = {
  running: '⏳',
  pass: '✅',
  fail: '❌',
  skip: '⏭️'
};

const STATUS_COLORS = {
  running: { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
  pass: { text: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)' },
  fail: { text: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' },
  skip: { text: 'var(--text-muted)', bg: 'transparent' }
};

export default function AIPipelineLog({ phases, isRunning, error }) {
  if (error) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        borderLeft: '3px solid #f87171',
        borderRadius: '4px'
      }}>
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: '#f87171',
          fontWeight: '500'
        }}>
          Error: {error}
        </p>
      </div>
    );
  }

  // Calculate phase statistics
  const totalPhases = 19;
  const completedPhases = phases.filter(p => p.status !== 'running').length;
  const successfulPhases = phases.filter(p => p.status === 'pass').length;
  const failedPhases = phases.filter(p => p.status === 'fail').length;
  const skippedPhases = phases.filter(p => p.status === 'skip').length;

  return (
    <div>
      <h3 style={{
        margin: '0 0 12px 0',
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        Pipeline Log
        {isRunning && <span style={{ color: '#fbbf24' }}>● LIVE</span>}
      </h3>

      {/* Phase Summary */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: 'var(--bg-deep)',
        borderRadius: '4px'
      }}>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          <span style={{ color: '#4ade80' }}>✅ {successfulPhases}</span> | 
          <span style={{ color: '#f87171' }}> ❌ {failedPhases}</span> | 
          <span style={{ color: 'var(--text-muted)' }}> ⏭️ {skippedPhases}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          {completedPhases}/{totalPhases} completed
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {phases.map((phase) => (
          <div
            key={phase.phaseNumber}
            style={{
              padding: '10px 12px',
              backgroundColor: STATUS_COLORS[phase.status].bg,
              border: `1px solid ${STATUS_COLORS[phase.status].text}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: phase.scores ? '8px' : 0
            }}>
              <span style={{ color: STATUS_COLORS[phase.status].text, fontWeight: '500' }}>
                {STATUS_ICONS[phase.status]} Phase {phase.phaseNumber}
              </span>
              {phase.duration_ms && (
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {phase.duration_ms}ms
                </span>
              )}
            </div>

            <p style={{
              margin: '4px 0 0 0',
              color: 'var(--text-secondary)',
              fontWeight: '500',
              fontSize: '11px'
            }}>
              {phase.phaseName}
            </p>

            {/* Validation scores */}
            {phase.scores && (
              <div style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-soft)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {Object.entries(phase.scores).map(([key, check]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '10px'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      color: check.pass ? '#4ade80' : '#f87171',
                      fontWeight: '600'
                    }}>
                      {check.score}/100
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {phases.length === 0 && !isRunning && (
          <p style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            padding: '24px 0'
          }}>
            Pipeline logs will appear here when you run the engine
          </p>
        )}
      </div>
    </div>
  );
}