import React, { useEffect, useState } from 'react';

export default function AIHistory({ API }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/ai/creative/history`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewSession = async (sessionId) => {
    setSelectedSession(sessionId);
    try {
      const response = await fetch(`${API}/api/ai/creative/${sessionId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSessionDetails(data);
      }
    } catch (err) {
      console.error('Error loading session:', err);
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('Delete this session?')) return;
    try {
      const response = await fetch(`${API}/api/ai/creative/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
        setSelectedSession(null);
        setSessionDetails(null);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading history...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', overflow: 'hidden' }}>
      {/* Sessions List */}
      <div style={{
        width: '340px',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        paddingRight: '16px'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Session History
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.length === 0 ? (
            <p style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              padding: '24px 0'
            }}>
              No sessions yet
            </p>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => viewSession(session.id)}
                style={{
                  padding: '12px',
                  borderRadius: '4px',
                  border: selectedSession === session.id ? '1px solid #7c3aed' : '1px solid var(--border)',
                  backgroundColor: selectedSession === session.id ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 200ms'
                }}
                onMouseEnter={e => {
                  if (selectedSession !== session.id) {
                    e.currentTarget.style.borderColor = 'var(--border-soft)';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedSession !== session.id) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }
                }}
              >
                <p style={{
                  margin: '0 0 4px 0',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {session.topic || 'Untitled'}
                </p>
                <p style={{
                  margin: '0 0 4px 0',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}>
                  {session.category} · {session.niche}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{
                    margin: 0,
                    fontSize: '10px',
                    color: 'var(--text-faint)'
                  }}>
                    {new Date(session.created_at).toLocaleDateString()}
                  </p>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    fontWeight: '500',
                    backgroundColor: session.status === 'completed' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                    color: session.status === 'completed' ? '#4ade80' : '#fbbf24'
                  }}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Session Details */}
      <div style={{
        flex: 1,
        overflowY: 'auto'
      }}>
        {selectedSession && sessionDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Session Info */}
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                {sessionDetails.session.topic}
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '12px'
              }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Tone</p>
                  <p style={{ margin: 0, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {sessionDetails.session.tone}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Niche</p>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {sessionDetails.session.niche}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Category</p>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {sessionDetails.session.category}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Created</p>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {new Date(sessionDetails.session.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteSession(selectedSession)}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(248, 113, 113, 0.2)',
                  color: '#f87171',
                  cursor: 'pointer',
                  transition: 'all 200ms'
                }}
                onMouseEnter={e => e.target.style.backgroundColor = 'rgba(248, 113, 113, 0.3)'}
                onMouseLeave={e => e.target.style.backgroundColor = 'rgba(248, 113, 113, 0.2)'}
              >
                🗑️ Delete Session
              </button>
            </div>

            {/* Generated Content */}
            {sessionDetails.content && (
              <div style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Generated Content
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Headline</p>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: '500' }}>
                      {sessionDetails.content.headline}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Post Content</p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {sessionDetails.content.post_content}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontWeight: '500' }}>Hashtags</p>
                    <p style={{ margin: 0, color: '#7c3aed' }}>
                      {sessionDetails.content.hashtags}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Phase Logs */}
            {sessionDetails.phases && sessionDetails.phases.length > 0 && (
              <div style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Phase Logs ({sessionDetails.phases.length})
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '8px'
                }}>
                  {sessionDetails.phases.map(log => (
                    <div
                      key={log.id}
                      style={{
                        padding: '8px',
                        backgroundColor: log.status === 'pass' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                        borderRadius: '4px',
                        border: `1px solid ${log.status === 'pass' ? '#4ade80' : '#f87171'}`,
                        fontSize: '10px'
                      }}
                    >
                      <p style={{ margin: '0 0 2px 0', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Phase {log.phase_number}
                      </p>
                      <p style={{ margin: '0 0 2px 0', color: 'var(--text-muted)', fontSize: '9px' }}>
                        {log.phase_name}
                      </p>
                      <p style={{ margin: 0, color: log.status === 'pass' ? '#4ade80' : '#f87171' }}>
                        {log.status === 'pass' ? '✅' : '❌'} {log.duration_ms}ms
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)'
          }}>
            <p>Select a session to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
