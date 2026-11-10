import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, FolderOpen,
  Pencil, Plus, Search, Settings, Share2, Trash2, Upload, X, ZoomIn, ZoomOut
} from 'lucide-react';
import api from '../../api/client';
import DirectoryProfileShell from '../../components/layout/DirectoryProfileShell';
import { currentListPath, saveListReturn } from '../../navigation/listReturn';
import { fmt } from '../../utils/format';

const FACILITY_STEPS = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'address', label: 'Address & Contact Information' },
  { key: 'timings', label: 'Facility Timings & Duration' },
  { key: 'providers', label: 'Individual Providers' },
  { key: 'contacts', label: 'Contacts' }
];

const WARNING_OPTIONS = [
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
  { value: 120, label: '120 Days' }
];

const INSURANCE_TYPES = new Set(['General Liability Insurance', 'Professional Liability Insurance']);
const BANKING_TYPES = new Set(['Bank Letter', 'Voided Check']);
const BANK_ACCOUNT_TYPES = ['Checking', 'Savings', 'Other'];
const SECURE_IMAGE_PDF_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const BANKING_ACCEPT = SECURE_IMAGE_PDF_ACCEPT;
const OTHER_DOCS_ACCEPT = SECURE_IMAGE_PDF_ACCEPT;
const AGREEMENTS_ACCEPT = SECURE_IMAGE_PDF_ACCEPT;
const OTHER_DOCUMENTS_CATEGORY = 'other';
const AGREEMENTS_CATEGORY = 'agreements';

function isInsuranceType(type) {
  return INSURANCE_TYPES.has(type);
}

function isBankingType(type) {
  return BANKING_TYPES.has(type);
}

function isOtherDocumentsCategory(key) {
  return key === OTHER_DOCUMENTS_CATEGORY;
}

function isAgreementsCategory(key) {
  return key === AGREEMENTS_CATEGORY;
}

function usesSecureImagePdfAccept(type, categoryKey) {
  return isInsuranceType(type)
    || isBankingType(type)
    || isOtherDocumentsCategory(categoryKey)
    || isAgreementsCategory(categoryKey);
}

function isVoidedCheckType(type) {
  return type === 'Voided Check';
}

function isSiteSurveyType(type) {
  return type === 'Site Survey';
}

function maskRoutingDisplay(value) {
  if (!value) return '—';
  const s = String(value);
  if (s.includes('•') || s.includes('*')) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••${digits.slice(-4)}`;
}

function isValidRoutingClient(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{9}$/.test(digits) || digits === '000000000') return false;
  const d = digits.split('').map(Number);
  const checksum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return checksum % 10 === 0;
}

function isValidPhoneClient(value) {
  if (!value) return true;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function issuedDateLabel(type) {
  return isSiteSurveyType(type) ? 'Issued/Survey Date' : 'Issued At';
}

function toDateInput(v) {
  return v ? String(v).slice(0, 10) : '';
}

function formatMoneyInput(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
}

function formatMoneyDisplay(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function confidenceLabel(score) {
  if (score == null) return null;
  if (score >= 0.75) return 'High';
  if (score >= 0.5) return 'Med';
  return 'Low';
}

function MultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  searchPlaceholder,
  emptyLabel,
  getOptionLabel,
  allowSelectAll = true
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter(o => getOptionLabel(o).toLowerCase().includes(term));
  }, [options, q, getOptionLabel]);

  const selected = options.filter(o => selectedIds.includes(o.id));

  function toggle(id) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id));
    else onChange([...selectedIds, id]);
  }

  return (
    <div className="msel span-2" ref={rootRef}>
      <div className="msel-label">{label}</div>
      <div className="msel-box">
        <div className="msel-chips">
          {selected.map(o => (
            <button key={o.id} type="button" className="msel-chip" onClick={() => toggle(o.id)}>
              {getOptionLabel(o)} <X size={12} />
            </button>
          ))}
          {!selected.length && <span className="muted">{emptyLabel || 'None selected'}</span>}
        </div>
        <button type="button" className="secondary msel-toggle" onClick={() => setOpen(v => !v)}>
          {open ? 'Close' : 'Select…'}
        </button>
      </div>
      {open && (
        <div className="msel-dropdown">
          <div className="msel-search">
            <Search size={14} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={searchPlaceholder || 'Search…'} />
          </div>
          <div className="msel-actions">
            {allowSelectAll && filtered.length > 0 && (
              <button type="button" className="linkish" onClick={() => onChange([...new Set([...selectedIds, ...filtered.map(o => o.id)])])}>
                Select All
              </button>
            )}
            <button type="button" className="linkish" onClick={() => onChange([])}>Clear Selection</button>
          </div>
          <div className="msel-list">
            {!filtered.length && <div className="msel-empty muted">No matching records</div>}
            {filtered.map(o => (
              <label key={o.id} className="msel-option">
                <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} />
                <span>{getOptionLabel(o)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentPreviewPane({
  previewUrl,
  mimeType,
  originalName,
  uploadedAt,
  zoom,
  setZoom,
  page,
  setPage,
  pageCount,
  uploading,
  extracting,
  onPickFile,
  onReplace,
  onRemove,
  hasFile,
  accept,
  docTitle = 'Document',
  uploadLabel = 'Upload document',
  extractingLabel = 'Extracting fields from document…',
  onDropFile
}) {
  const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(originalName || '');
  const isImage = (mimeType || '').startsWith('image/') || /\.(jpe?g|png)$/i.test(originalName || '');
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) (onDropFile || onPickFile)?.(file);
  }

  return (
    <div className="ins-doc-pane">
      <div className="ins-doc-toolbar">
        <div>
          <b>{docTitle}</b>
          <small>
            {originalName || (hasFile ? 'Attached file' : 'No document uploaded')}
            {hasFile && uploadedAt ? ` · Uploaded ${fmt(uploadedAt)}` : ''}
          </small>
        </div>
        <div className="ins-doc-actions">
          {hasFile && (
            <>
              <button type="button" className="icon-round" title="Zoom out" onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(2))))}>
                <ZoomOut size={13} />
              </button>
              <button type="button" className="icon-round" title="Zoom in" onClick={() => setZoom(z => Math.min(2.5, Number((z + 0.1).toFixed(2))))}>
                <ZoomIn size={13} />
              </button>
              {isPdf && pageCount > 1 && (
                <>
                  <button type="button" className="icon-round" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft size={13} />
                  </button>
                  <span className="muted" style={{ fontSize: 10 }}>Page {page}/{pageCount}</span>
                  <button type="button" className="icon-round" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>
                    <ChevronRight size={13} />
                  </button>
                </>
              )}
              <label className="secondary upload-action" title="Replace document">
                Replace
                <input hidden type="file" accept={accept} onChange={e => onReplace(e.target.files?.[0])} />
              </label>
              <button type="button" className="secondary danger-text" onClick={onRemove}>Remove</button>
            </>
          )}
        </div>
      </div>

      {!hasFile && (
        <label
          className={`ins-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload size={22} />
          <b>{uploading ? 'Uploading…' : uploadLabel}</b>
          <span>PDF, JPG, JPEG, or PNG · drag & drop · max 20 MB</span>
          <input hidden type="file" accept={accept} disabled={uploading} onChange={e => onPickFile(e.target.files?.[0])} />
        </label>
      )}

      {hasFile && previewUrl && (
        <div className="ins-preview-frame">
          <div className="ins-preview-scaler" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
            {isPdf && (
              <iframe
                title={`${docTitle} PDF preview`}
                src={`${previewUrl}#page=${page}`}
                className="ins-pdf-frame"
              />
            )}
            {isImage && (
              <img src={previewUrl} alt={originalName || docTitle} className="ins-img-preview" />
            )}
            {!isPdf && !isImage && (
              <div className="ins-preview-fallback muted">Preview unavailable for this file type. Use Download.</div>
            )}
          </div>
        </div>
      )}

      {extracting && <div className="ins-extract-banner">{extractingLabel}</div>}
    </div>
  );
}

export default function FacilityCredentials() {
  const { id } = useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState(null);
  const [practices, setPractices] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState('');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('insurance');
  const [expanded, setExpanded] = useState({ insurance: true });
  const [rows, setRows] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [attention, setAttention] = useState({ counts: {}, expiringSoon: [] });
  const [selectedType, setSelectedType] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ignoreType, setIgnoreType] = useState(false);
  const [detailView, setDetailView] = useState(null);

  // Insurance form state
  const [form, setForm] = useState({});
  const [selectedFacilityIds, setSelectedFacilityIds] = useState([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [ocrConfirmed, setOcrConfirmed] = useState(false);
  const [sessionDraftId, setSessionDraftId] = useState(null);
  const [fieldConfidence, setFieldConfidence] = useState({});

  const completion = useMemo(() => {
    if (!detail) return 0;
    const addr = detail.address || {};
    const basic = detail.name && (detail.organizationId || detail.practiceId);
    const address = addr.street && addr.city;
    const sched = detail.schedule && Object.keys(detail.schedule).length;
    const providersOk = (detail.providers || []).length > 0;
    const contacts = (detail.contacts || []).length > 0;
    return Math.round(([basic, address, sched, providersOk, contacts].filter(Boolean).length / 5) * 100);
  }, [detail]);

  const activeType = form.type || selectedType || editing?.type;
  const otherMode = isOtherDocumentsCategory(category)
    || isOtherDocumentsCategory(editing?.category)
    || isOtherDocumentsCategory(form.category);
  const agreementsMode = !otherMode && (
    isAgreementsCategory(category)
    || isAgreementsCategory(editing?.category)
    || isAgreementsCategory(form.category)
  );
  // Other Documents always uses the custom-document UI, even if the free-text type
  // name happens to match an insurance/banking catalog type.
  const insuranceMode = !otherMode && !agreementsMode && isInsuranceType(activeType);
  const bankingMode = !otherMode && !agreementsMode && isBankingType(activeType);
  const voidedCheckMode = isVoidedCheckType(activeType);
  const splitDocMode = insuranceMode || bankingMode || otherMode || agreementsMode;

  async function loadShell() {
    setProvidersLoading(true);
    setProvidersError('');
    setDetail(prev => (prev?.id === id ? prev : null));
    try {
      const [d, p, f, cats, prov] = await Promise.all([
        api.get(`/directory/facilities/${id}/detail`),
        api.get('/practices', { params: { limit: 100 } }),
        api.get('/facilities', { params: { limit: 100 } }),
        api.get('/credentials/categories'),
        api.get('/providers', { params: { limit: 200 } })
      ]);
      setDetail(d.data);
      setPractices(p.data);
      setFacilities(f.data);
      setCategories(cats.data);
      setProviders(prov.data);
      setProvidersError('');
    } catch (e) {
      setProvidersError(e.response?.data?.error || 'Could not load providers for this facility.');
      throw e;
    } finally {
      setProvidersLoading(false);
    }
  }

  const facilityProviders = useMemo(() => (
    (detail?.providers || [])
      .map(a => a.provider)
      .filter(Boolean)
      .map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        primarySpecialty: p.primarySpecialty,
        status: p.status
      }))
  ), [detail]);

  async function loadDocs() {
    const [list, attn, all] = await Promise.all([
      api.get('/credentials', { params: { facilityId: id, category, limit: 100 } }),
      api.get('/credentials/attention', { params: { facilityId: id } }),
      api.get('/credentials', { params: { facilityId: id, limit: 200 } })
    ]);
    setRows(list.data);
    setAttention(attn.data);
    setAllDocs(all.data);
    if (!selectedType && list.data[0]) setSelectedType(list.data[0].type);
  }

  useEffect(() => {
    setProvidersLoading(true);
    setProvidersError('');
    setDetail(null);
    loadShell().catch(e => setError(e.response?.data?.error || 'Could not load facility.'));
  }, [id]);

  useEffect(() => {
    if (id) loadDocs().catch(e => setError(e.response?.data?.error || 'Could not load credentials.'));
  }, [id, category]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const typesInCategory = useMemo(() => {
    const catMeta = categories.find(c => c.key === category);
    const catalog = catMeta?.types || [];
    const map = new Map();
    catalog.forEach(t => map.set(t.type, { type: t.type, docs: [], required: !!t.required, reporting: !!t.reporting }));
    allDocs.filter(d => d.category === category).forEach(d => {
      if (!map.has(d.type)) map.set(d.type, { type: d.type, docs: [], required: !!d.required, reporting: !!d.reportingRequired });
      map.get(d.type).docs.push(d);
    });
    return [...map.values()].map(entry => {
      const { type, docs } = entry;
      const attentions = docs.map(d => d.attention);
      let status = 'MISSING';
      if (docs.length && docs.every(d => d.attention === 'IGNORED' || d.ignored)) status = 'IGNORED';
      else if (docs.length && attentions.every(a => a === 'EXPIRED')) status = 'EXPIRED';
      else if (docs.length && attentions.includes('EXPIRING_SOON')) status = 'EXPIRING_SOON';
      else if (docs.length && attentions.includes('AVAILABLE')) status = 'AVAILABLE';
      else if (!docs.length || attentions.every(a => a === 'MISSING')) status = 'MISSING';
      return {
        type,
        docs,
        required: docs.length ? docs.some(d => d.required) : entry.required,
        reporting: docs.length ? docs.some(d => d.reportingRequired) : entry.reporting,
        status,
        ignored: docs.length ? docs.every(d => d.ignored) : false
      };
    });
  }, [allDocs, category, categories]);

  const tableRows = useMemo(() => {
    if (selectedType) return rows.filter(r => r.type === selectedType);
    return rows;
  }, [rows, selectedType]);

  useEffect(() => {
    if (selectedType) {
      const match = typesInCategory.find(t => t.type === selectedType);
      setIgnoreType(!!match?.ignored);
    }
  }, [selectedType, typesInCategory]);

  function openCreateModal() {
    const type = selectedType || '';
    const other = isOtherDocumentsCategory(category);
    setEditing(null);
    setSessionDraftId(null);
    setExtraction(null);
    setOcrConfirmed(false);
    setFieldConfidence({});
    setZoom(1);
    setPage(1);
    setPageCount(1);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setForm({
      title: other ? (type || '') : type,
      type,
      category,
      issuedAt: '',
      expiresAt: '',
      warningDays: 30,
      notes: '',
      required: !!typesInCategory.find(t => t.type === type)?.required,
      reportingRequired: !!typesInCategory.find(t => t.type === type)?.reporting,
      ignored: false,
      policyNumber: '',
      perOccurrence: '',
      aggregate: '',
      insuranceCompany: '',
      namedInsured: '',
      bankName: '',
      bankTitle: '',
      bankRoutingNumber: '',
      bankAccountType: isVoidedCheckType(type) ? 'Checking' : '',
      bankPhoneNumber: '',
      bankAccountHolder: ''
    });
    setSelectedFacilityIds(id ? [id] : []);
    setSelectedProviderIds([]);
    setModal(true);
  }

  async function openEditModal(row) {
    setError('');
    let full = row;
    try {
      const r = await api.get(`/credentials/${row.id}`);
      full = r.data;
    } catch {
      full = row;
    }
    setEditing(full);
    setSessionDraftId(null);
    setExtraction(null);
    setOcrConfirmed(true);
    setFieldConfidence({});
    setZoom(1);
    setPage(1);
    setForm({
      title: full.title || '',
      type: full.type || '',
      category: full.category || category,
      issuedAt: toDateInput(full.issuedAt),
      expiresAt: toDateInput(full.expiresAt),
      warningDays: full.warningDays || 30,
      notes: full.notes || '',
      required: !!full.required,
      reportingRequired: !!full.reportingRequired,
      ignored: !!full.ignored,
      policyNumber: full.policyNumber || '',
      perOccurrence: formatMoneyInput(full.perOccurrence),
      aggregate: formatMoneyInput(full.aggregate),
      insuranceCompany: full.insuranceCompany || '',
      namedInsured: full.namedInsured || '',
      bankName: full.bankName || '',
      bankTitle: full.bankTitle || '',
      bankRoutingNumber: full.bankRoutingNumber || '',
      bankAccountType: full.bankAccountType || '',
      bankPhoneNumber: full.bankPhoneNumber || '',
      bankAccountHolder: full.bankAccountHolder || ''
    });
    const fids = full.facilityIds?.length ? full.facilityIds : (full.facilityId ? [full.facilityId] : (id ? [id] : []));
    const pids = full.providerIds?.length ? full.providerIds : (full.providerId ? [full.providerId] : []);
    setSelectedFacilityIds(fids);
    setSelectedProviderIds(pids);
    setModal(true);
    if (full.storageKey) await loadPreview(full.id);
  }

  async function loadPreview(docId) {
    try {
      const r = await api.get(`/documents/${docId}/file`, {
        params: { inline: 1 },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(r.data);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      if ((r.data.type || '').includes('pdf')) setPageCount(1);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load document preview.');
    }
  }

  function applyExtractionSuggestions(result) {
    setExtraction(result);
    if (!result?.ok) {
      setOcrConfirmed(false);
      return;
    }
    const conf = {};
    const insuranceMap = {
      insuranceCompany: 'insuranceCompany',
      policyNumber: 'policyNumber',
      issuedAt: 'issuedAt',
      expiresAt: 'expiresAt',
      perOccurrence: 'perOccurrence',
      aggregate: 'aggregate',
      namedInsured: 'namedInsured'
    };
    const bankingMap = {
      bankName: 'bankName',
      bankTitle: 'bankTitle',
      bankRoutingNumber: 'bankRoutingNumber',
      bankPhoneNumber: 'bankPhoneNumber',
      bankAccountType: 'bankAccountType',
      bankAccountHolder: 'bankAccountHolder',
      issuedAt: 'issuedAt'
    };
    const map = bankingMode ? bankingMap : insuranceMap;
    setForm(prev => {
      const next = { ...prev };
      Object.entries(map).forEach(([src, dest]) => {
        const f = result.fields?.[src];
        if (f?.value != null && f.value !== '') {
          next[dest] = src === 'perOccurrence' || src === 'aggregate'
            ? formatMoneyInput(f.value)
            : String(f.value);
          conf[dest] = f.confidence;
        }
      });
      if (result.fields?.documentType?.value) {
        const suggested = String(result.fields.documentType.value);
        if (!next.type || next.type === selectedType) {
          next.type = suggested;
          if (!next.title || next.title === selectedType || next.title === prev.type) next.title = suggested;
        }
      }
      return next;
    });
    setFieldConfidence(conf);
    setOcrConfirmed(false);
  }

  async function ensureDraftRecord() {
    if (editing?.id) return editing;
    if (sessionDraftId) {
      return { id: sessionDraftId, type: form.type, storageKey: editing?.storageKey };
    }
    const type = (form.type || selectedType || '').trim();
    if (!type) {
      const err = new Error(isOtherDocumentsCategory(category)
        ? 'Enter a Credential Type before uploading a document.'
        : 'Select a credential type before uploading a document.');
      throw err;
    }
    const draftCategory = isBankingType(type)
      ? 'banking'
      : (isInsuranceType(type)
        ? 'insurance'
        : (isOtherDocumentsCategory(category)
          ? OTHER_DOCUMENTS_CATEGORY
          : (isAgreementsCategory(category) ? AGREEMENTS_CATEGORY : category)));
    const body = {
      title: (form.title || type || 'Credential').trim(),
      type,
      category: draftCategory,
      facilityId: id,
      organizationId: detail?.organizationId || detail?.organization?.id || detail?.practice?.organizationId || undefined,
      practiceId: detail?.practiceId || undefined,
      warningDays: Number(form.warningDays) || 30,
      required: !!form.required,
      reportingRequired: !!form.reportingRequired,
      ignored: false,
      draft: true,
      facilityIds: selectedFacilityIds,
      providerIds: selectedProviderIds
    };
    const created = await api.post('/credentials', body);
    setSessionDraftId(created.data.id);
    setEditing(created.data);
    return created.data;
  }

  async function uploadToCredential(doc, file, replace = false) {
    const body = new FormData();
    body.append('file', file);
    const r = await api.post(`/documents/${doc.id}/file${replace ? '?replace=true' : ''}`, body, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data;
  }

  async function runExtract(docId) {
    setExtracting(true);
    try {
      const r = await api.post(`/documents/${docId}/extract`);
      applyExtractionSuggestions(r.data);
      if (!r.data.ok) setError(r.data.message || 'Extraction did not find usable fields.');
      else setError('');
    } catch (e) {
      setExtraction({ ok: false, message: e.response?.data?.error || 'Extraction failed.' });
      setError(e.response?.data?.error || 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  }

  async function handlePickFile(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const doc = await ensureDraftRecord();
      await uploadToCredential(doc, file, false);
      const refreshed = await api.get(`/credentials/${doc.id}`);
      setEditing(refreshed.data);
      await loadPreview(doc.id);
      if (isInsuranceType(doc.type || form.type) || isBankingType(doc.type || form.type)) {
        await runExtract(doc.id);
      }
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleReplaceFile(file) {
    if (!file || !editing?.id) return;
    if (!confirm('Replace the existing document? The previous file will be removed.')) return;
    setUploading(true);
    setError('');
    try {
      await uploadToCredential(editing, file, true);
      const refreshed = await api.get(`/credentials/${editing.id}`);
      setEditing(refreshed.data);
      await loadPreview(editing.id);
      if (isInsuranceType(refreshed.data.type) || isBankingType(refreshed.data.type)) {
        await runExtract(editing.id);
      }
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Replace failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveFile() {
    if (!editing?.id || !editing.storageKey) return;
    if (!confirm('Remove the attached document?')) return;
    try {
      await api.delete(`/documents/${editing.id}/file`);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      const refreshed = await api.get(`/credentials/${editing.id}`);
      setEditing(refreshed.data);
      setExtraction(null);
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not remove document.');
    }
  }

  async function closeModal(discardDraft = true) {
    if (discardDraft && sessionDraftId && !confirm('Discard this draft credential and uploaded document?')) return;
    if (discardDraft && sessionDraftId) {
      try { await api.delete(`/credentials/${sessionDraftId}`); } catch { /* may lack delete role */ }
    }
    setModal(false);
    setEditing(null);
    setSessionDraftId(null);
    setExtraction(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    await loadDocs();
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    if ((insuranceMode || bankingMode) && extraction?.ok && !ocrConfirmed) {
      setError('Review extracted suggestions and confirm the values before saving.');
      setSaving(false);
      return;
    }

    if (insuranceMode) {
      for (const key of ['perOccurrence', 'aggregate']) {
        const raw = form[key];
        if (raw !== '' && raw != null) {
          const n = Number(String(raw).replace(/[$,\s]/g, ''));
          if (!Number.isFinite(n) || n < 0) {
            setError(`${key === 'perOccurrence' ? 'Per Occurrence' : 'Aggregate'} must be a valid non-negative amount.`);
            setSaving(false);
            return;
          }
        }
      }
    }

    if (bankingMode) {
      if (voidedCheckMode) {
        if (!form.bankRoutingNumber || !isValidRoutingClient(form.bankRoutingNumber)) {
          setError('Routing number must be a valid 9-digit ABA routing number.');
          setSaving(false);
          return;
        }
        if (!form.bankTitle?.trim()) {
          setError('Bank Title is required for Voided Check.');
          setSaving(false);
          return;
        }
        if (!BANK_ACCOUNT_TYPES.includes(form.bankAccountType)) {
          setError('Account Type must be Checking, Savings, or Other.');
          setSaving(false);
          return;
        }
        if (!form.bankName?.trim()) {
          setError('Bank Name is required for Voided Check.');
          setSaving(false);
          return;
        }
        if (!form.bankPhoneNumber?.trim() || !isValidPhoneClient(form.bankPhoneNumber)) {
          setError('Bank Phone Number is required and must be a valid phone format.');
          setSaving(false);
          return;
        }
      } else if (form.bankRoutingNumber && !isValidRoutingClient(form.bankRoutingNumber)) {
        setError('Routing number must be a valid 9-digit ABA routing number.');
        setSaving(false);
        return;
      } else if (form.bankPhoneNumber && !isValidPhoneClient(form.bankPhoneNumber)) {
        setError('Bank phone number must be a valid phone format.');
        setSaving(false);
        return;
      }
    }

    if (otherMode || agreementsMode) {
      if (!String(form.title || '').trim()) {
        setError('Credential Name is required.');
        setSaving(false);
        return;
      }
      if (!String(form.type || '').trim()) {
        setError('Credential Type is required.');
        setSaving(false);
        return;
      }
    }

    const body = {
      title: form.title,
      type: form.type,
      category: bankingMode
        ? 'banking'
        : (insuranceMode
          ? 'insurance'
          : (otherMode
            ? OTHER_DOCUMENTS_CATEGORY
            : (agreementsMode ? AGREEMENTS_CATEGORY : category))),
      facilityId: id,
      organizationId: detail?.organizationId || detail?.organization?.id || detail?.practice?.organizationId || undefined,
      practiceId: detail?.practiceId || undefined,
      warningDays: Number(form.warningDays) || 30,
      notes: form.notes || null,
      required: !!form.required,
      reportingRequired: !!form.reportingRequired,
      ignored: !!form.ignored,
      issuedAt: form.issuedAt ? new Date(`${form.issuedAt}T12:00:00`).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T12:00:00`).toISOString() : null
    };

    if (insuranceMode) {
      body.policyNumber = form.policyNumber || null;
      body.perOccurrence = form.perOccurrence === '' || form.perOccurrence == null
        ? null
        : Number(String(form.perOccurrence).replace(/[$,\s]/g, ''));
      body.aggregate = form.aggregate === '' || form.aggregate == null
        ? null
        : Number(String(form.aggregate).replace(/[$,\s]/g, ''));
      body.insuranceCompany = form.insuranceCompany || null;
      body.namedInsured = form.namedInsured || null;
      body.facilityIds = selectedFacilityIds;
      body.providerIds = selectedProviderIds;
    }

    if (bankingMode) {
      body.bankName = form.bankName || null;
      body.bankTitle = form.bankTitle || null;
      body.bankRoutingNumber = form.bankRoutingNumber ? String(form.bankRoutingNumber).replace(/\D/g, '') : null;
      body.bankAccountType = form.bankAccountType || null;
      body.bankPhoneNumber = form.bankPhoneNumber || null;
      body.bankAccountHolder = form.bankAccountHolder || null;
      body.facilityIds = selectedFacilityIds;
      body.providerIds = selectedProviderIds;
    }

    try {
      const targetId = editing?.id || sessionDraftId;
      if (targetId) {
        await api.patch(`/credentials/${targetId}`, body);
      } else {
        await api.post('/credentials', body);
      }
      setSessionDraftId(null);
      setModal(false);
      setEditing(null);
      setExtraction(null);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      await loadDocs();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Could not save credential.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`Delete credential "${row.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/credentials/${row.id}`);
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  }

  async function upload(row, file) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    const replace = !!row.storageKey;
    if (replace && !confirm('Replace the existing document?')) return;
    try {
      await api.post(`/documents/${row.id}/file${replace ? '?replace=true' : ''}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed.');
    }
  }

  async function download(row) {
    try {
      const r = await api.get(`/documents/${row.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.originalName || row.title || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || 'Download failed.');
    }
  }

  async function toggleIgnoreType(checked) {
    setIgnoreType(checked);
    const targets = tableRows.length ? tableRows : rows.filter(r => r.type === selectedType);
    try {
      await Promise.all(targets.map(r => api.patch(`/credentials/${r.id}`, { ignored: checked })));
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update ignore flag.');
    }
  }

  function statusDot(status) {
    const map = { MISSING: 'miss', EXPIRED: 'exp', EXPIRING_SOON: 'soon', AVAILABLE: 'ok', IGNORED: 'ign' };
    return map[status] || 'miss';
  }

  const facilityOptions = useMemo(() => {
    const orgId = detail?.organizationId || detail?.organization?.id || detail?.practice?.organizationId;
    if (!orgId && !detail?.practiceId) return facilities;
    return facilities.filter(f => {
      if (detail?.practiceId && f.practiceId === detail.practiceId) return true;
      if (orgId && (f.organizationId === orgId || f.organization?.id === orgId)) return true;
      // Facilities without org metadata remain selectable for global/admin seed data
      if (!f.organizationId && !f.organization?.id) return true;
      return false;
    });
  }, [facilities, detail]);

  const providerOptions = useMemo(() => {
    // Prefer providers affiliated to this facility, then org-scoped list
    const affiliated = (detail?.providers || []).map(pf => pf.provider).filter(Boolean);
    if (affiliated.length) {
      const ids = new Set(affiliated.map(p => p.id));
      const extras = providers.filter(p => !ids.has(p.id));
      return [...affiliated, ...extras];
    }
    return providers;
  }, [detail, providers]);

  function ConfLabel({ field }) {
    const c = fieldConfidence[field];
    const label = confidenceLabel(c);
    if (!label) return null;
    return <span className={`ocr-conf ocr-${label.toLowerCase()}`}>{label}</span>;
  }

  return (
    <DirectoryProfileShell
      entityType="FACILITY"
      title={detail?.name || 'Facility'}
      status={detail?.status || 'ACTIVE'}
      npi={detail?.npi}
      taxId={practices.find(p => p.id === detail?.practiceId)?.taxId}
      completion={completion}
      breadcrumb={[
        { label: 'Directory', to: '/organizations' },
        { label: 'Facilities', to: '/facilities' },
        { label: detail?.name || 'Facility', to: `/facilities/${id}/profile` },
        { label: 'Credentials' }
      ]}
      listKey="facilities"
      backLabel="Back to Facility"
      backFallback={`/facilities/${id}/profile`}
      backHints={{ facilityId: id, practiceId: detail?.practiceId, organizationId: detail?.organizationId }}
      practices={practices}
      selectedPracticeId={detail?.practiceId || ''}
      onSelectPractice={(pid) => pid && nav(`/practices/${pid}/profile`)}
      facilities={facilities}
      selectedFacilityId={id}
      onSelectFacility={(fid) => nav(`/facilities/${fid}/credentials`)}
      providers={facilityProviders}
      providersLoading={providersLoading}
      providersError={providersError}
      onSelectProvider={(providerId) => {
        if (!providerId) return;
        const returnTo = currentListPath(`/facilities/${id}/credentials`);
        saveListReturn('providers', '/providers');
        nav(`/providers/${providerId}/profile`, {
          state: {
            returnTo,
            listKey: 'facilities',
            facilityId: id,
            practiceId: detail?.practiceId,
            organizationId: detail?.organizationId,
            providerId
          }
        });
      }}
      steps={FACILITY_STEPS}
      activeStepKey="basic"
      onStepChange={(key) => nav(`/facilities/${id}/profile?step=${key}`)}
      rightMode="facility"
      attention={attention}
      onRequestInfo={() => alert('Request facility info queued for the responsible assignee.')}
      quickActions={[
        {
          key: 'w9',
          label: 'W-9 Form',
          icon: FileText,
          onClick: () => {
            setCategory('irs');
            setExpanded(e => ({ ...e, irs: true }));
            setSelectedType('W-9 Form');
          }
        },
        { key: 'credentials', label: 'Credentials', icon: FolderOpen, onClick: () => nav(`/facilities/${id}/credentials`) },
        { key: 'enrollments', label: 'Enrollments', icon: FileText, onClick: () => nav('/enrollments') },
        {
          key: 'share',
          label: 'Share',
          icon: Share2,
          onClick: () => { navigator.clipboard?.writeText(window.location.href); alert('Credentials link copied.'); }
        },
        { key: 'alerts', label: 'Alerts', icon: Bell, onClick: () => document.querySelector('.attn-box')?.scrollIntoView({ behavior: 'smooth' }) },
        { key: 'activity', label: 'Activity', icon: Activity, onClick: () => nav('/audit') },
        { key: 'settings', label: 'Settings', icon: Settings, onClick: () => nav(`/facilities/${id}/profile?step=basic`) }
      ]}
      stepIndex={0}
      stepCount={5}
      stepLabel="Credentials"
      onPrev={() => nav(`/facilities/${id}/profile?step=contacts`)}
      onNext={() => nav(`/facilities/${id}/profile?step=basic`)}
    >
      {error && <div className="error banner">{error}</div>}

      <div className="cred-split">
        <aside className="cred-left-panel">
          <div className="cred-left-head">
            <FolderOpen size={16} />
            <div>
              <b>Credentials</b>
              <small>Document categories</small>
            </div>
          </div>
          <div className="cred-legend">
            <span><i className="dot miss" /> Missing</span>
            <span><i className="dot exp" /> Expired</span>
            <span><i className="dot soon" /> Expiring soon</span>
            <span><i className="dot ok" /> Available</span>
            <span><i className="dot ign" /> Ignored</span>
          </div>
          <div className="cred-acc-list">
            {categories.map(c => {
              const open = !!expanded[c.key];
              const isActive = category === c.key;
              return (
                <div key={c.key} className={`cred-acc ${isActive ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="cred-acc-btn"
                    onClick={() => {
                      setCategory(c.key);
                      setExpanded(prev => ({ ...prev, [c.key]: !prev[c.key] }));
                      setSelectedType(null);
                    }}
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{c.label}</span>
                  </button>
                  {open && isActive && (
                    <div className="cred-acc-body">
                      <table className="cred-mini-table">
                        <thead>
                          <tr><th>NAME</th><th>REQUIRED</th><th>REPORTING</th></tr>
                        </thead>
                        <tbody>
                          {typesInCategory.length === 0 && (
                            <tr><td colSpan="3" className="muted">No documents in category</td></tr>
                          )}
                          {typesInCategory.map(t => (
                            <tr
                              key={t.type}
                              className={selectedType === t.type ? 'selected' : ''}
                              onClick={() => setSelectedType(t.type)}
                            >
                              <td>
                                <i className={`dot ${statusDot(t.status)}`} />
                                {t.type}
                              </td>
                              <td>{t.required ? <Check size={14} className="ok-ico" /> : <X size={14} className="bad-ico" />}</td>
                              <td>{t.reporting ? <Check size={14} className="ok-ico" /> : <X size={14} className="bad-ico" />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="cred-right-panel">
          <div className="cred-right-head">
            <div>
              <h2>{selectedType || categories.find(c => c.key === category)?.label || 'Credentials'}</h2>
              <label className="ignore-toggle">
                <input
                  type="checkbox"
                  checked={ignoreType}
                  disabled={!selectedType || !tableRows.length}
                  onChange={e => toggleIgnoreType(e.target.checked)}
                />
                Ignore this credential
              </label>
            </div>
            <button type="button" className="primary" onClick={openCreateModal}>
              <Plus size={15} /> Add New
            </button>
          </div>

          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>S. NO</th>
                  <th>CREDENTIAL</th>
                  <th>EXPIRATION DATE</th>
                  <th>STATUS</th>
                  <th>CREATED BY</th>
                  <th>FILE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">
                      <button type="button" className="linkish" onClick={() => setDetailView(row)}>{row.title}</button>
                      {isInsuranceType(row.type) && row.policyNumber && (
                        <div className="muted" style={{ fontSize: 10 }}>Policy {row.policyNumber}</div>
                      )}
                      {isBankingType(row.type) && (row.bankName || row.bankRoutingNumber) && (
                        <div className="muted" style={{ fontSize: 10 }}>
                          {[row.bankName, row.bankRoutingNumber ? `RTN ${maskRoutingDisplay(row.bankRoutingNumber)}` : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>{fmt(row.expiresAt)}</td>
                    <td><span className={`status-pill status-${statusDot(row.attention)}`}>{row.attention?.replace('_', ' ')}</span></td>
                    <td>{row.createdBy?.name || '—'}</td>
                    <td>{row.storageKey ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="row-actions">
                        {row.storageKey && (
                          <button type="button" className="icon-round" title="Download" onClick={() => download(row)}>
                            <Download size={13} />
                          </button>
                        )}
                        <label className="icon-round upload-action" title="Upload">
                          <Upload size={13} />
                          <input
                            hidden
                            type="file"
                            accept={
                              usesSecureImagePdfAccept(row.type, row.category)
                                ? SECURE_IMAGE_PDF_ACCEPT
                                : '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx'
                            }
                            onChange={e => upload(row, e.target.files?.[0])}
                          />
                        </label>
                        <button type="button" className="icon-round" title="Edit" onClick={() => openEditModal(row)}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="icon-round danger" title="Delete" onClick={() => remove(row)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!tableRows.length && (
                  <tr><td colSpan="7" className="table-empty">No credentials yet. Click Add New.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {detailView && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDetailView(null)}>
          <div className="record-modal wide">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">VIEW</span>
                <h2>{detailView.title}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setDetailView(null)}><X size={20} /></button>
            </div>
            <div className="form-grid cred-detail-grid">
              <div><b>Type</b><div>{detailView.type}</div></div>
              <div><b>Status</b><div>{detailView.attention}</div></div>
              <div><b>{issuedDateLabel(detailView.type)}</b><div>{fmt(detailView.issuedAt)}</div></div>
              <div><b>Expiration</b><div>{fmt(detailView.expiresAt)}</div></div>
              <div><b>Warning Days</b><div>{detailView.warningDays || 30}</div></div>
              {isInsuranceType(detailView.type) && (
                <>
                  <div><b>Policy Number</b><div>{detailView.policyNumber || '—'}</div></div>
                  <div><b>Per Occurrence</b><div>{formatMoneyDisplay(detailView.perOccurrence)}</div></div>
                  <div><b>Aggregate</b><div>{formatMoneyDisplay(detailView.aggregate)}</div></div>
                  <div><b>Insurance Company</b><div>{detailView.insuranceCompany || '—'}</div></div>
                  <div><b>Named Insured</b><div>{detailView.namedInsured || '—'}</div></div>
                  <div className="span-2">
                    <b>Facilities</b>
                    <div>{(detailView.facilities || []).map(f => f.name).join(', ') || detailView.facility?.name || '—'}</div>
                  </div>
                  <div className="span-2">
                    <b>Providers</b>
                    <div>
                      {(detailView.providers || []).map(p => `${p.firstName} ${p.lastName}${p.npi ? ` (${p.npi})` : ''}`).join(', ') || '—'}
                    </div>
                  </div>
                </>
              )}
              {isBankingType(detailView.type) && (
                <>
                  <div><b>Bank Name</b><div>{detailView.bankName || '—'}</div></div>
                  <div><b>Bank Title</b><div>{detailView.bankTitle || '—'}</div></div>
                  <div><b>Routing Number</b><div>{maskRoutingDisplay(detailView.bankRoutingNumberMasked || detailView.bankRoutingNumber)}</div></div>
                  <div><b>Account Type</b><div>{detailView.bankAccountType || '—'}</div></div>
                  <div><b>Bank Phone</b><div>{detailView.bankPhoneNumber || '—'}</div></div>
                  <div><b>Account Holder</b><div>{detailView.bankAccountHolder || '—'}</div></div>
                  <div className="span-2">
                    <b>Facilities</b>
                    <div>{(detailView.facilities || []).map(f => f.name).join(', ') || detailView.facility?.name || '—'}</div>
                  </div>
                  <div className="span-2">
                    <b>Providers</b>
                    <div>
                      {(detailView.providers || []).map(p => `${p.firstName} ${p.lastName}${p.npi ? ` (${p.npi})` : ''}`).join(', ') || '—'}
                    </div>
                  </div>
                </>
              )}
              <div className="span-2"><b>Notes</b><div>{detailView.notes || '—'}</div></div>
              <div><b>Document</b><div>{detailView.originalName || (detailView.storageKey ? 'Attached' : 'None')}</div></div>
              {detailView.uploadedAt && <div><b>Uploaded</b><div>{fmt(detailView.uploadedAt)}</div></div>}
            </div>
            <div className="modal-footer">
              {detailView.storageKey && (
                <button type="button" className="secondary" onClick={() => download(detailView)}>Download</button>
              )}
              <button type="button" className="secondary" onClick={() => { setDetailView(null); openEditModal(detailView); }}>Edit</button>
              <button type="button" className="primary" onClick={() => setDetailView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeModal(true)}>
          <form className={`record-modal ${splitDocMode ? 'insurance-modal' : ''}`} onSubmit={save}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{editing && !sessionDraftId ? 'UPDATE' : 'NEW'}</span>
                <h2>
                  {editing && !sessionDraftId
                    ? (bankingMode
                      ? `Edit ${form.type || 'banking credential'}`
                      : (otherMode
                        ? `Edit ${form.type || 'other document'}`
                        : (agreementsMode
                          ? `Edit ${form.type || 'agreement / contract'}`
                          : 'Edit credential')))
                    : (bankingMode
                      ? `Add ${form.type || 'banking credential'}`
                      : (otherMode
                        ? 'Add other document'
                        : (agreementsMode
                          ? `Add ${form.type || selectedType || 'agreement / contract'}`
                          : 'Add credential')))}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => closeModal(true)}><X size={20} /></button>
            </div>

            {splitDocMode ? (
              <div className="ins-split">
                <DocumentPreviewPane
                  previewUrl={previewUrl}
                  mimeType={editing?.mimeType}
                  originalName={editing?.originalName}
                  uploadedAt={editing?.uploadedAt}
                  zoom={zoom}
                  setZoom={setZoom}
                  page={page}
                  setPage={setPage}
                  pageCount={pageCount}
                  uploading={uploading}
                  extracting={extracting}
                  hasFile={!!editing?.storageKey}
                  accept={otherMode || agreementsMode ? (agreementsMode ? AGREEMENTS_ACCEPT : OTHER_DOCS_ACCEPT) : BANKING_ACCEPT}
                  docTitle={
                    otherMode || agreementsMode
                      ? 'Document'
                      : (bankingMode ? (voidedCheckMode ? 'Voided check' : 'Bank letter') : 'Policy document')
                  }
                  uploadLabel={
                    agreementsMode
                      ? 'Upload agreement / contract'
                      : (otherMode
                        ? 'Upload document'
                        : (bankingMode ? (voidedCheckMode ? 'Upload voided check' : 'Upload bank letter') : 'Upload insurance policy'))
                  }
                  extractingLabel={bankingMode ? 'Extracting banking fields from document…' : 'Extracting policy fields from document…'}
                  onPickFile={handlePickFile}
                  onReplace={handleReplaceFile}
                  onRemove={handleRemoveFile}
                  onDropFile={editing?.storageKey ? handleReplaceFile : handlePickFile}
                />

                <div className="ins-form-pane">
                  {extraction && !otherMode && !agreementsMode && (
                    <div className={`ins-ocr-banner ${extraction.ok ? 'ok' : 'warn'}`}>
                      {extraction.ok
                        ? 'Suggested values extracted from the document. Review each field, correct as needed, then confirm before saving. Nothing is saved until you confirm.'
                        : (extraction.message || 'No fields could be extracted. Enter values manually.')}
                    </div>
                  )}
                  <div className="form-grid">
                    <label>Credential Name<input required value={form.title || ''} onChange={e => setField('title', e.target.value)} /></label>
                    {otherMode ? (
                      <label>Type
                        <input
                          required
                          list="other-doc-types"
                          placeholder="Custom document type"
                          value={form.type || ''}
                          onChange={e => {
                            const nextType = e.target.value;
                            setForm(prev => ({
                              ...prev,
                              type: nextType,
                              title: !prev.title || prev.title === prev.type ? nextType : prev.title,
                              category: OTHER_DOCUMENTS_CATEGORY
                            }));
                          }}
                        />
                        <datalist id="other-doc-types">
                          {typesInCategory.map(t => <option key={t.type} value={t.type} />)}
                        </datalist>
                      </label>
                    ) : (
                      <label>Type
                        <select
                          required
                          value={form.type || ''}
                          onChange={e => {
                            const nextType = e.target.value;
                            const typeCategoryKey = agreementsMode
                              ? AGREEMENTS_CATEGORY
                              : (bankingMode ? 'banking' : 'insurance');
                            const meta = (categories.find(c => c.key === typeCategoryKey)?.types || [])
                              .find(t => t.type === nextType);
                            setForm(prev => ({
                              ...prev,
                              type: nextType,
                              title: !prev.title || prev.title === prev.type ? nextType : prev.title,
                              category: agreementsMode ? AGREEMENTS_CATEGORY : prev.category,
                              required: meta ? !!meta.required : !!prev.required,
                              reportingRequired: meta ? !!meta.reporting : !!prev.reportingRequired,
                              bankAccountType: isVoidedCheckType(nextType) && !prev.bankAccountType ? 'Checking' : prev.bankAccountType
                            }));
                          }}
                        >
                          <option value="">Select…</option>
                          {(categories.find(c => c.key === (agreementsMode
                            ? AGREEMENTS_CATEGORY
                            : (bankingMode ? 'banking' : 'insurance')))?.types || []).map(t => (
                            <option key={t.type} value={t.type}>{t.type}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {insuranceMode && (
                      <>
                        <label>Policy Number
                          <span className="label-with-conf"><ConfLabel field="policyNumber" /></span>
                          <input value={form.policyNumber || ''} onChange={e => setField('policyNumber', e.target.value)} />
                        </label>
                        <label>Per Occurrence
                          <span className="label-with-conf"><ConfLabel field="perOccurrence" /></span>
                          <input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={form.perOccurrence || ''}
                            onChange={e => setField('perOccurrence', e.target.value)}
                          />
                        </label>
                        <label>Aggregate
                          <span className="label-with-conf"><ConfLabel field="aggregate" /></span>
                          <input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={form.aggregate || ''}
                            onChange={e => setField('aggregate', e.target.value)}
                          />
                        </label>
                        <label>Insurance Company
                          <span className="label-with-conf"><ConfLabel field="insuranceCompany" /></span>
                          <input value={form.insuranceCompany || ''} onChange={e => setField('insuranceCompany', e.target.value)} />
                        </label>
                        <label>Named Insured
                          <span className="label-with-conf"><ConfLabel field="namedInsured" /></span>
                          <input value={form.namedInsured || ''} onChange={e => setField('namedInsured', e.target.value)} />
                        </label>
                      </>
                    )}

                    {bankingMode && (
                      <>
                        <label>Bank Name
                          <span className="label-with-conf"><ConfLabel field="bankName" /></span>
                          <input
                            required={voidedCheckMode}
                            value={form.bankName || ''}
                            onChange={e => setField('bankName', e.target.value)}
                          />
                        </label>
                        <label>Bank Title
                          <span className="label-with-conf"><ConfLabel field="bankTitle" /></span>
                          <input
                            required={voidedCheckMode}
                            value={form.bankTitle || ''}
                            onChange={e => setField('bankTitle', e.target.value)}
                          />
                        </label>
                        <label>Routing Number
                          <span className="label-with-conf"><ConfLabel field="bankRoutingNumber" /></span>
                          <input
                            required={voidedCheckMode}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder={voidedCheckMode ? '9-digit ABA routing' : 'Optional if present on letter'}
                            value={form.bankRoutingNumber || ''}
                            onChange={e => setField('bankRoutingNumber', e.target.value.replace(/[^\d\-]/g, ''))}
                          />
                        </label>
                        {voidedCheckMode && (
                          <>
                            <label>Account Type
                              <span className="label-with-conf"><ConfLabel field="bankAccountType" /></span>
                              <select
                                required
                                value={form.bankAccountType || ''}
                                onChange={e => setField('bankAccountType', e.target.value)}
                              >
                                <option value="">Select…</option>
                                {BANK_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </label>
                            <label>Bank Phone Number
                              <span className="label-with-conf"><ConfLabel field="bankPhoneNumber" /></span>
                              <input
                                required
                                type="tel"
                                autoComplete="off"
                                value={form.bankPhoneNumber || ''}
                                onChange={e => setField('bankPhoneNumber', e.target.value)}
                              />
                            </label>
                          </>
                        )}
                        <label>Account Holder / Business Name
                          <span className="label-with-conf"><ConfLabel field="bankAccountHolder" /></span>
                          <input value={form.bankAccountHolder || ''} onChange={e => setField('bankAccountHolder', e.target.value)} />
                        </label>
                      </>
                    )}

                    <label>Issued At
                      <span className="label-with-conf"><ConfLabel field="issuedAt" /></span>
                      <input type="date" value={form.issuedAt || ''} onChange={e => setField('issuedAt', e.target.value)} />
                    </label>
                    {(insuranceMode || otherMode || agreementsMode) && (
                      <label>Expiration Date
                        <span className="label-with-conf"><ConfLabel field="expiresAt" /></span>
                        <input type="date" value={form.expiresAt || ''} onChange={e => setField('expiresAt', e.target.value)} />
                      </label>
                    )}
                    {bankingMode && !voidedCheckMode && (
                      <label>Expiration Date
                        <input type="date" value={form.expiresAt || ''} onChange={e => setField('expiresAt', e.target.value)} />
                      </label>
                    )}
                    <label>Warning Days
                      <select value={form.warningDays || 30} onChange={e => setField('warningDays', Number(e.target.value))}>
                        {WARNING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>

                    {!otherMode && !agreementsMode && (
                      <>
                        {!facilityOptions.length ? (
                          <div className="span-2 field-help">No facilities available in your authorized organization scope.</div>
                        ) : (
                          <MultiSelect
                            label="Facilities"
                            options={facilityOptions}
                            selectedIds={selectedFacilityIds}
                            onChange={setSelectedFacilityIds}
                            searchPlaceholder="Search facilities…"
                            emptyLabel="Select one or more facilities"
                            getOptionLabel={o => o.name}
                            allowSelectAll={facilityOptions.length <= 50}
                          />
                        )}

                        {!providerOptions.length ? (
                          <div className="span-2 field-help">No providers available. Add providers to the directory first.</div>
                        ) : (
                          <MultiSelect
                            label="Providers"
                            options={providerOptions}
                            selectedIds={selectedProviderIds}
                            onChange={setSelectedProviderIds}
                            searchPlaceholder="Search by name or NPI…"
                            emptyLabel="Select one or more providers"
                            getOptionLabel={o => `${o.firstName || ''} ${o.lastName || ''}${o.npi ? ` · NPI ${o.npi}` : ''}`.trim()}
                            allowSelectAll={providerOptions.length <= 50}
                          />
                        )}
                      </>
                    )}

                    <label className="span-2">Notes<textarea rows="2" value={form.notes || ''} onChange={e => setField('notes', e.target.value)} /></label>
                    <label><span><input type="checkbox" checked={!!form.required} onChange={e => setField('required', e.target.checked)} /> Required</span></label>
                    <label><span><input type="checkbox" checked={!!form.reportingRequired} onChange={e => setField('reportingRequired', e.target.checked)} /> Reporting requirement</span></label>
                    <label><span><input type="checkbox" checked={!!form.ignored} onChange={e => setField('ignored', e.target.checked)} /> Ignore</span></label>
                    {extraction?.ok && !otherMode && !agreementsMode && (
                      <label className="span-2 ocr-confirm">
                        <span>
                          <input type="checkbox" checked={ocrConfirmed} onChange={e => setOcrConfirmed(e.target.checked)} />
                          I reviewed and confirm the extracted values (suggestions are not saved until confirmed)
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <label>Credential Name<input required value={form.title || ''} onChange={e => setField('title', e.target.value)} /></label>
                <label>Type
                  <select
                    required
                    value={form.type || ''}
                    onChange={e => {
                      const nextType = e.target.value;
                      const meta = typesInCategory.find(t => t.type === nextType);
                      setForm(prev => ({
                        ...prev,
                        type: nextType,
                        title: !prev.title || prev.title === prev.type ? nextType : prev.title,
                        required: meta ? !!meta.required : !!prev.required,
                        reportingRequired: meta ? !!meta.reporting : !!prev.reportingRequired
                      }));
                    }}
                  >
                    <option value="">Select…</option>
                    {(categories.find(c => c.key === category)?.types || []).map(t => (
                      <option key={t.type} value={t.type}>{t.type}</option>
                    ))}
                    {form.type && !(categories.find(c => c.key === category)?.types || []).some(t => t.type === form.type) && (
                      <option value={form.type}>{form.type}</option>
                    )}
                  </select>
                </label>
                <label>{issuedDateLabel(form.type)}
                  <input type="date" value={form.issuedAt || ''} onChange={e => setField('issuedAt', e.target.value)} />
                </label>
                <label>Expiration Date<input type="date" value={form.expiresAt || ''} onChange={e => setField('expiresAt', e.target.value)} /></label>
                <label>Warning Days
                  <select value={form.warningDays || 30} onChange={e => setField('warningDays', Number(e.target.value))}>
                    {WARNING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="span-2">Notes<textarea rows="2" value={form.notes || ''} onChange={e => setField('notes', e.target.value)} /></label>
                <label><span><input type="checkbox" checked={!!form.required} onChange={e => setField('required', e.target.checked)} /> Required</span></label>
                <label><span><input type="checkbox" checked={!!form.reportingRequired} onChange={e => setField('reportingRequired', e.target.checked)} /> Reporting requirement</span></label>
                <label><span><input type="checkbox" checked={!!form.ignored} onChange={e => setField('ignored', e.target.checked)} /> Ignore</span></label>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => closeModal(true)}>Cancel</button>
              <button className="primary" disabled={saving || uploading || extracting}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </DirectoryProfileShell>
  );
}
