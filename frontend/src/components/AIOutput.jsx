import React, { useState } from 'react';

export default function AIOutput({ result, phases, sessionId, API, isRunning }) {
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  if (!result && !isRunning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
        <p style={{ fontSize: '16px', margin: 0 }}>Run the pipeline to see output here</p>
        <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-faint)' }}>
          Fill the form on the left and click Run
        </p>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)'
      }}>
        <div style={{
          fontSize: '32px',
          marginBottom: '16px',
          animation: 'pulse 2s infinite'
        }}>
          ⚙️
        </div>
        <p style={{ fontSize: '14px', margin: 0 }}>Pipeline is running...</p>
        <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-faint)' }}>
          Phase {phases.length > 0 ? phases[phases.length - 1].phaseNumber : 0} of 19
        </p>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {phases.filter(p => p.status === 'pass').length} of 19 phases completed
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const { content } = result;
  const completedPhases = phases.filter(p => p.status !== 'running');
  const successfulPhases = phases.filter(p => p.status === 'pass');
  const failedPhases = phases.filter(p => p.status === 'fail');
  const skippedPhases = phases.filter(p => p.status === 'skip');

  // Function to handle publishing the content
  const handlePublish = () => {
    setShowPublishModal(true);
  };

  // Function to close the modal
  const closeModal = () => {
    setShowPublishModal(false);
  };

  // Function to actually post to social platforms
  const postToPlatforms = async (platforms) => {
    try {
      const response = await fetch(`${API}/api/posts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'credentials': 'include'
        },
        body: JSON.stringify({
          content: `${content.headline}\n\n${content.post_content}\n\n${content.hashtags}`,
          platforms: platforms,
          generation_source: 'ai_creative_engine',
          generation_batch_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      alert(`Content published to ${platforms.join(', ')} successfully!`);
      closeModal();
    } catch (error) {
      console.error('Error publishing content:', error);
      alert(`Failed to publish: ${error.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '100%', overflowX: 'auto' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Pipeline Summary Card */}
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: '13px',
          fontWeight: '600',
          color: '#7c3aed',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          📊 Pipeline Summary
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Total Phases</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{completedPhases.length}/19</p>
          </div>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Successful</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>{successfulPhases.length}</p>
          </div>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Failed</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{failedPhases.length}</p>
          </div>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Skipped</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{skippedPhases.length}</p>
          </div>
        </div>
      </div>

      {/* Generated Content Card */}
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: '13px',
          fontWeight: '600',
          color: '#7c3aed',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>📝 Generated Content</span>
          <button
            onClick={handlePublish}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#7c3aed',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 200ms'
            }}
            onMouseEnter={e => e.target.style.backgroundColor = '#6d28d9'}
            onMouseLeave={e => e.target.style.backgroundColor = '#7c3aed'}
          >
            🚀 Publish
          </button>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '6px',
              fontWeight: '500',
              textTransform: 'uppercase'
            }}>
              Headline
            </label>
            <p style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              lineHeight: '1.4'
            }}>
              {content.headline}
            </p>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '6px',
              fontWeight: '500',
              textTransform: 'uppercase'
            }}>
              Post Content
            </label>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              {content.post_content}
            </p>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '6px',
              fontWeight: '500',
              textTransform: 'uppercase'
            }}>
              Hashtags
            </label>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: '#7c3aed'
            }}>
              {content.hashtags}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '4px',
                fontWeight: '500',
                textTransform: 'uppercase'
              }}>
                Image Ratio
              </label>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--text-primary)',
                fontWeight: '500',
                fontFamily: 'monospace'
              }}>
                {content.image_ratio}
              </p>
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '4px',
                fontWeight: '500',
                textTransform: 'uppercase'
              }}>
                Style
              </label>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--text-primary)',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}>
                {content.image_style}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Image Prompt Card */}
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border-soft)',
        borderColor: 'rgba(124, 58, 237, 0.3)'
      }}>
        <h2 style={{
          margin: '0 0 12px 0',
          fontSize: '13px',
          fontWeight: '600',
          color: '#7c3aed',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          🎨 Engineered Image Prompt
        </h2>

        <div style={{
          backgroundColor: 'var(--bg-deep)',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          fontFamily: 'monospace',
          maxHeight: '200px',
          overflowY: 'auto',
          marginBottom: '12px',
          whiteSpace: 'normal',
          wordWrap: 'break-word'
        }}>
          {content.image_prompt}
        </div>

        <button
          onClick={() => {
            // Copy to clipboard
            navigator.clipboard.writeText(content.image_prompt).then(() => {
              alert('Prompt copied to clipboard!');
            });
          }}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: '500',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#7c3aed',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 200ms'
          }}
          onMouseEnter={e => e.target.style.backgroundColor = '#6d28d9'}
          onMouseLeave={e => e.target.style.backgroundColor = '#7c3aed'}
        >
          📋 Copy Prompt
        </button>
      </div>

      {/* Phase Details */}
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          margin: '0 0 12px 0',
          fontSize: '13px',
          fontWeight: '600',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          📋 All Phase Details ({completedPhases.length}/19 completed)
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {completedPhases.map(phase => (
            <div
              key={phase.phaseNumber}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              <button
                onClick={() => setExpandedPhase(expandedPhase === phase.phaseNumber ? null : phase.phaseNumber)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'var(--text-primary)',
                  transition: 'background-color 200ms',
                  ...(phase.status === 'pass' ? { color: '#4ade80' } : phase.status === 'fail' ? { color: '#f87171' } : { color: 'var(--text-muted)' })
                }}
                onMouseEnter={e => e.target.style.backgroundColor = 'var(--bg-elevated)'}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
              >
                <span>
                  <span style={{ marginRight: '8px' }}>
                    {phase.status === 'pass' ? '✅' : phase.status === 'fail' ? '❌' : phase.status === 'skip' ? '⏭️' : '⏳'}
                  </span>
                  Phase {phase.phaseNumber}: {phase.phaseName}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {expandedPhase === phase.phaseNumber ? '▲' : '▼'}
                </span>
              </button>

              {expandedPhase === phase.phaseNumber && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-deep)',
                  borderTop: '1px solid var(--border)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Status:</strong> <span style={{ color: phase.status === 'pass' ? '#4ade80' : phase.status === 'fail' ? '#f87171' : 'var(--text-muted)' }}>{phase.status}</span>
                    {phase.duration_ms && <span>, Duration: {phase.duration_ms}ms</span>}
                  </div>
                  {phase.scores && Object.keys(phase.scores).length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Validation Scores:</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        {Object.entries(phase.scores).map(([key, check]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{key.replace(/_/g, ' ')}:</span>
                            <span style={{ color: check.pass ? '#4ade80' : '#f87171', fontWeight: '600' }}>{check.score}/100</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {phase.output && (
                    <div>
                      <strong>Output:</strong>
                      <pre style={{
                        margin: '8px 0 0 0',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowX: 'auto'
                      }}>
                        {JSON.stringify(phase.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90vw',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)'
            }}>🚀 Publish Content</h3>
            <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
              Select the platforms you want to publish this content to:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" id="facebook" style={{ width: '16px', height: '16px' }} defaultChecked/>
                <span style={{ color: 'var(--text-primary)' }}>Facebook</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" id="instagram" style={{ width: '16px', height: '16px' }} defaultChecked/>
                <span style={{ color: 'var(--text-primary)' }}>Instagram</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" id="linkedin" style={{ width: '16px', height: '16px' }} defaultChecked/>
                <span style={{ color: 'var(--text-primary)' }}>LinkedIn</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const selectedPlatforms = [];
                  if (document.getElementById('facebook').checked) selectedPlatforms.push('facebook');
                  if (document.getElementById('instagram').checked) selectedPlatforms.push('instagram');
                  if (document.getElementById('linkedin').checked) selectedPlatforms.push('linkedin');
                  postToPlatforms(selectedPlatforms);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}