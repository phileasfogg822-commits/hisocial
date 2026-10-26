import React, { useState } from 'react';

export default function AIInput({ onSubmit, isRunning }) {
  const [form, setForm] = useState({
    tone: '',
    niche: '',
    category: '',
    topic: '',
    provider: 'gemini'
  });

  const toneOptions = [
    'Professional',
    'Friendly',
    'Urgent',
    'Luxury',
    'Playful',
    'Inspirational',
    'Educational',
    'Casual'
  ];

  const providerOptions = [
    { id: 'gemini', name: 'Google Gemini 2.0 Flash', desc: 'Fast & recommended' },
    { id: 'bigmodel', name: 'BigModel GLM 4 Flash', desc: 'Reliable fallback' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.tone && form.niche && form.category && form.topic) {
      onSubmit(form);
    }
  };

  const isValid = form.tone && form.niche && form.category && form.topic;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Input Parameters
      </h3>

      <div>
        <label style={{
          display: 'block',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '4px',
          fontWeight: '500'
        }}>
          Tone
        </label>
        <select
          value={form.tone}
          onChange={e => setForm({ ...form, tone: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            boxSizing: 'border-box'
          }}
        >
          <option value="">Select tone...</option>
          {toneOptions.map(t => (
            <option key={t} value={t.toLowerCase()}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{
          display: 'block',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '4px',
          fontWeight: '500'
        }}>
          Niche
        </label>
        <input
          type="text"
          value={form.niche}
          onChange={e => setForm({ ...form, niche: e.target.value })}
          placeholder="e.g. sustainable gardening"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div>
        <label style={{
          display: 'block',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '4px',
          fontWeight: '500'
        }}>
          Category
        </label>
        <input
          type="text"
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          placeholder="e.g. biodegradable pots"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div>
        <label style={{
          display: 'block',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '4px',
          fontWeight: '500'
        }}>
          Topic
        </label>
        <textarea
          value={form.topic}
          onChange={e => setForm({ ...form, topic: e.target.value })}
          placeholder="e.g. New eco-friendly pots for urban gardeners"
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      <div>
        <label style={{
          display: 'block',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '4px',
          fontWeight: '500'
        }}>
          AI Provider
        </label>
        <select
          value={form.provider}
          onChange={e => setForm({ ...form, provider: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            boxSizing: 'border-box'
          }}
        >
          {providerOptions.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.desc})
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isRunning || !isValid}
        style={{
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: '600',
          border: 'none',
          borderRadius: '4px',
          cursor: isRunning || !isValid ? 'not-allowed' : 'pointer',
          backgroundColor: isRunning || !isValid ? 'var(--text-faint)' : '#7c3aed',
          color: '#fff',
          opacity: isRunning || !isValid ? 0.5 : 1,
          transition: 'all 200ms'
        }}
      >
        {isRunning ? '⚡ Pipeline Running...' : '🚀 Run Creative Engine'}
      </button>
    </form>
  );
}
