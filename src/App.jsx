import React, { useState } from 'react';
import { getAiReply } from './ai';

export function App() {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Build a one-week launch checklist for my app MVP.');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const output = await getAiReply({ apiKey, prompt });
      setAnswer(output);
    } catch (err) {
      setError(err.message || 'Failed to fetch AI response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <h1>Acedex MVP</h1>
      <p className="subtext">Frontend-first MVP with direct AI integration. Backend deferred for later upgrades.</p>

      <form onSubmit={handleSubmit}>
        <label>
          OpenAI API key (temporary for MVP)
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            required
          />
        </label>

        <label>
          Prompt
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} required />
        </label>

        <button type="submit" disabled={loading}>{loading ? 'Thinking...' : 'Run AI'}</button>
      </form>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>AI Output</h2>
        <pre>{answer || 'Output will appear here.'}</pre>
      </section>
    </main>
  );
}
