// hooks/useSettings.js  (frontend)
import { useState, useEffect, useCallback } from 'react';
import { fetchSection, saveSection, fetchSessions, revokeSession } from '../lib/api';

// ── useSettings(section) ──────────────────────────────────────────────────────
// Returns: { data, loading, saving, error, setData, save }
export function useSettings(section) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!section) return;
    setLoading(true);
    fetchSection(section)
      .then(json => { setData(json.data); setError(null); })
      .catch(err  => setError(err.message))
      .finally(()  => setLoading(false));
  }, [section]);

  const save = useCallback(async (payload) => {
    setSaving(true);
    setError(null);
    try {
      await saveSection(section, payload);
      setData(payload);          // optimistic local update
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [section]);

  return { data, loading, saving, error, setData, save };
}

// ── useSessions() ─────────────────────────────────────────────────────────────
// Returns: { sessions, loading, error, revoke }
export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    fetchSessions()
      .then(json => { setSessions(json.sessions || []); setError(null); })
      .catch(err  => setError(err.message))
      .finally(()  => setLoading(false));
  }, []);

  const revoke = useCallback(async (id) => {
    await revokeSession(id);                         // throws on error
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  return { sessions, loading, error, revoke };
}