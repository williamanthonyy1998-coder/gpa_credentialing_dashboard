import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function MaskedField({ label, value, revealable = true }) {
  const [show, setShow] = useState(false);
  const has = value !== null && value !== undefined && String(value).length > 0;
  const display = !has ? '—' : show ? value : '•'.repeat(Math.min(12, Math.max(8, String(value).length)));

  return (
    <div className="info-field">
      <span className="info-label">{label}</span>
      <div className="info-value masked-value">
        <span>{display}</span>
        {has && revealable && (
          <button type="button" className="mask-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide' : 'Show'}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}
