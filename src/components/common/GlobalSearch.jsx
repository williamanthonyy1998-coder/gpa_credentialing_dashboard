import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../../api/client';

export default function GlobalSearch() {
  const nav = useNavigate();
  const wrapRef = useRef(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/search', { params: { q: term, limit: 8 } });
        setResults(r.data?.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(r) {
    if (r.href) nav(r.href);
    setQ('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="global-search-wrap" ref={wrapRef}>
      <div className="global-search-box">
        <Search size={15} />
        <input
          type="search"
          placeholder="Search directory, enrollments, tasks…"
          value={q}
          aria-label="Global search"
          aria-expanded={open && results.length > 0}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length >= 2) setOpen(true);
          }}
          onFocus={() => { if (results.length) setOpen(true); }}
        />
        {loading && <span className="global-search-hint">…</span>}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="global-search-dropdown">
          {!results.length && !loading && (
            <div className="global-search-empty">No matches for “{q.trim()}”.</div>
          )}
          {results.map((r) => (
            <button
              type="button"
              key={`${r.type}-${r.id}`}
              className="global-search-row"
              onClick={() => pick(r)}
            >
              <b>{r.label}</b>
              <span>
                <em>{r.type}</em>
                {r.meta ? ` · ${r.meta}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
