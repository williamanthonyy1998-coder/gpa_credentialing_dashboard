export const menu = [
  { label: 'Dashboard', path: '/', icon: 'Gauge' },
  { label: 'Organizations', path: '/organizations', icon: 'Building2' },
  { label: 'Practices', path: '/practices', icon: 'Landmark' },
  { label: 'Providers', path: '/providers', icon: 'Stethoscope' },
  { label: 'Facilities', path: '/facilities', icon: 'MapPin' },
  { label: 'Payers', path: '/payers', icon: 'ShieldCheck' },
  { label: 'Payer Enrollment', path: '/enrollments', icon: 'CreditCard' },
  { label: 'Credentialing', path: '/cases', icon: 'ClipboardCheck' },
  { label: 'Credentials', path: '/credentials', icon: 'FileText' },
  { label: 'Documents', path: '/documents', icon: 'FileText' },
  { label: 'Employees', path: '/employees', icon: 'Users' },
  { label: 'Tasks', path: '/tasks', icon: 'CheckSquare' },
  { label: 'Audit Log', path: '/audit', icon: 'Activity' }
];

export const config = {
  organizations: {
    title: 'Organizations', singular: 'Organization', resource: 'organizations',
    search: 'Search organization or DBA',
    fields: [
      ['legalName', 'Legal Name', 'text', true], ['dba', 'DBA', 'text'], ['taxId', 'Tax ID', 'text'],
      ['establishedAt', 'Established Date', 'date'], ['contactName', 'Contact Name', 'text'],
      ['contactTitle', 'Contact Title', 'text'], ['phone', 'Phone', 'text'], ['fax', 'Fax', 'text'],
      ['email', 'Email', 'email'],
      ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']]
    ],
    columns: [
      ['legalName', 'Organization Name'], ['dba', 'DBA / Legal DBA'], ['taxId', 'Tax ID'],
      ['contactName', 'Contact'], ['phone', 'Phone'], ['status', 'Status'], ['createdAt', 'Created']
    ]
  },
  practices: {
    title: 'Practices', singular: 'Practice', resource: 'practices',
    search: 'Search practice or NPI',
    fields: [
      ['organizationId', 'Organization', 'relation', 'organizations', true],
      ['name', 'Practice Name', 'text', true], ['legalName', 'Legal Business Name', 'text'],
      ['npi', 'NPI', 'text'], ['taxId', 'Tax ID', 'text'], ['dba', 'DBA', 'text'],
      ['taxonomyCode', 'Taxonomy Code', 'text'], ['establishedAt', 'Established Date', 'date'],
      ['contactName', 'Contact Name', 'text'], ['contactTitle', 'Contact Title', 'text'],
      ['phone', 'Phone', 'text'], ['fax', 'Fax', 'text'], ['email', 'Email', 'email'],
      ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']]
    ],
    columns: [
      ['name', 'Practice'], ['legalName', 'Legal name'], ['npi', 'NPI'], ['taxId', 'Tax ID'],
      ['organization.legalName', 'Organization'], ['status', 'Status']
    ]
  },
  facilities: {
    title: 'Facilities', singular: 'Facility', resource: 'facilities',
    search: 'Search facilities',
    fields: [
      ['organizationId', 'Organization', 'relation', 'organizations'],
      ['practiceId', 'Practice', 'relation', 'practices'],
      ['name', 'Facility Name', 'text', true], ['npi', 'NPI', 'text'],
      ['contactName', 'Contact Person', 'text'], ['contactTitle', 'Contact Title', 'text'],
      ['phone', 'Phone', 'text'], ['fax', 'Fax', 'text'], ['email', 'Email', 'email'],
      ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']]
    ],
    columns: [
      ['name', 'Facility'], ['npi', 'NPI'], ['practice.name', 'Practice'],
      ['organization.legalName', 'Organization'], ['contactName', 'Contact'], ['status', 'Status']
    ]
  },
  providers: {
    title: 'Individual Providers', singular: 'Provider', resource: 'providers',
    search: 'Search provider name or NPI',
    fields: [
      ['firstName', 'First Name', 'text', true], ['middleName', 'Middle Name', 'text'],
      ['lastName', 'Last Name', 'text', true], ['npi', 'NPI', 'text'],
      ['dateOfBirth', 'Date of Birth', 'date'], ['placeOfBirth', 'Place of Birth', 'text'],
      ['citizenship', 'Citizenship', 'text'],
      ['gender', 'Gender', 'select', ['Female', 'Male', 'Other', 'Prefer not to say']],
      ['email', 'Email', 'email'], ['homePhone', 'Home Phone', 'text'], ['workPhone', 'Work Phone', 'text'],
      ['primarySpecialty', 'Primary Specialty', 'text'], ['secondarySpecialty', 'Secondary Specialty', 'text'],
      ['taxonomyCode', 'Taxonomy Code', 'text'], ['professionalType', 'Professional Type', 'text'],
      ['supervisorName', 'Supervisor Physician', 'text'],
      ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']]
    ],
    columns: [
      ['firstName', 'First name'], ['lastName', 'Last name'], ['npi', 'NPI'],
      ['primarySpecialty', 'Primary specialty'], ['professionalType', 'Type'], ['status', 'Status']
    ]
  },
  providerOrganizations: {
    title: 'Provider Organization Affiliations', singular: 'Provider Affiliation',
    resource: 'providerOrganizations', search: 'Search provider or organization',
    fields: [
      ['providerId', 'Provider', 'relation', 'providers', true],
      ['organizationId', 'Organization', 'relation', 'organizations', true],
      ['affiliationTitle', 'Affiliation / Role', 'text'],
      ['effectiveAt', 'Effective Date', 'date'], ['endAt', 'End Date', 'date'],
      ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']]
    ],
    columns: [
      ['provider.firstName', 'Provider first'], ['provider.lastName', 'Provider last'],
      ['provider.npi', 'NPI'], ['organization.legalName', 'Organization'],
      ['affiliationTitle', 'Role'], ['effectiveAt', 'Effective'], ['endAt', 'End date'], ['status', 'Status']
    ]
  },
  licenses: {
    title: 'Provider Licenses & Certifications', singular: 'License / Certification',
    resource: 'licenses', search: 'Search license, type, or state',
    fields: [
      ['providerId', 'Provider', 'relation', 'providers', true],
      ['type', 'License / Certification Type', 'text', true], ['number', 'License Number', 'text'],
      ['state', 'State', 'text'], ['issuingBody', 'Issuing Board / Authority', 'text'],
      ['issuedAt', 'Issue Date', 'date'], ['expiresAt', 'Expiry Date', 'date'],
      ['status', 'Status', 'select', ['MISSING', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED']],
      ['notes', 'Notes', 'textarea']
    ],
    columns: [
      ['provider.firstName', 'Provider first'], ['provider.lastName', 'Provider last'],
      ['type', 'Credential'], ['number', 'Number'], ['state', 'State'],
      ['expiresAt', 'Expires'], ['status', 'Status']
    ]
  },
  documents: {
    title: 'Document Center', singular: 'Document', resource: 'documents',
    search: 'Search document title or type',
    fields: [
      ['title', 'Document Title', 'text', true], ['type', 'Document Type', 'text', true],
      ['status', 'Status', 'select', ['MISSING', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED']],
      ['originalName', 'Original File Name', 'text'], ['issuedAt', 'Issue Date', 'date'],
      ['expiresAt', 'Expiry Date', 'date'],
      ['providerId', 'Provider', 'relation', 'providers'],
      ['organizationId', 'Organization', 'relation', 'organizations'],
      ['practiceId', 'Practice', 'relation', 'practices'],
      ['facilityId', 'Facility', 'relation', 'facilities'],
      ['notes', 'Notes', 'textarea']
    ],
    columns: [
      ['title', 'Document'], ['type', 'Type'], ['provider.lastName', 'Provider'],
      ['expiresAt', 'Expires'], ['status', 'Status']
    ]
  },
  cases: {
    title: 'Credentialing Cases', singular: 'Credentialing Case', resource: 'cases',
    search: 'Search case number',
    fields: [
      ['caseNumber', 'Case Number', 'text', true],
      ['providerId', 'Provider', 'relation', 'providers', true],
      ['practiceId', 'Practice', 'relation', 'practices'],
      ['status', 'Status', 'select', ['DRAFT', 'INFORMATION_NEEDED', 'UNDER_REVIEW', 'VERIFICATION_PENDING', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD']],
      ['dueAt', 'Due Date', 'date'], ['submittedAt', 'Submitted Date', 'date'],
      ['decisionAt', 'Decision Date', 'date'], ['decisionBy', 'Decision By', 'text'],
      ['decisionReason', 'Decision Reason', 'textarea'], ['notes', 'Notes', 'textarea']
    ],
    columns: [
      ['caseNumber', 'Case #'], ['provider.firstName', 'Provider first'],
      ['provider.lastName', 'Provider last'], ['practice.name', 'Practice'],
      ['status', 'Status'], ['dueAt', 'Due date']
    ]
  },
  payers: {
    title: 'Payers', singular: 'Payer', resource: 'payers', search: 'Search payer',
    fields: [
      ['name', 'Payer Name', 'text', true], ['payerCode', 'Payer Code', 'text'],
      ['website', 'Website', 'text'], ['phone', 'Phone', 'text'],
      ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']]
    ],
    columns: [
      ['name', 'Payer'], ['payerCode', 'Payer code'], ['phone', 'Phone'],
      ['website', 'Website'], ['status', 'Status']
    ]
  },
  plans: {
    title: 'Payer Plans', singular: 'Payer Plan', resource: 'plans', search: 'Search payer plan',
    fields: [
      ['payerId', 'Payer', 'relation', 'payers', true],
      ['name', 'Plan Name', 'text', true], ['planType', 'Plan Type', 'text']
    ],
    columns: [['name', 'Plan'], ['planType', 'Type'], ['payer.name', 'Payer']]
  },
  enrollments: {
    title: 'Payer Enrollment Applications', singular: 'Enrollment Application',
    resource: 'enrollments', search: 'Search application number or reference',
    fields: [
      ['applicationNo', 'Application Number', 'text', true],
      ['providerId', 'Individual Provider (optional)', 'relation', 'providers'],
      ['organizationId', 'Organization / Group (optional)', 'relation', 'organizations'],
      ['practiceId', 'Practice', 'relation', 'practices'],
      ['facilityId', 'Facility', 'relation', 'facilities'],
      ['payerPlanId', 'Payer Plan', 'relation', 'plans', true],
      ['status', 'Status', 'select', ['NOT_STARTED', 'PREPARING', 'READY_TO_SUBMIT', 'SUBMITTED', 'PAYER_REVIEW', 'ADDITIONAL_INFORMATION_NEEDED', 'APPROVED', 'DENIED', 'WITHDRAWN']],
      ['dueAt', 'Due Date', 'date'], ['submittedAt', 'Submitted Date', 'date'],
      ['referenceNo', 'Payer Reference Number', 'text'],
      ['lastFollowUpAt', 'Last Follow-up', 'date'], ['nextFollowUpAt', 'Next Follow-up', 'date'],
      ['effectiveAt', 'Effective Date', 'date'], ['decisionAt', 'Decision Date', 'date'],
      ['decisionReason', 'Decision Reason', 'textarea'], ['notes', 'Notes', 'textarea']
    ],
    columns: [
      ['applicationNo', 'Application #'], ['provider.firstName', 'Provider first'],
      ['provider.lastName', 'Provider last'], ['organization.legalName', 'Organization'],
      ['facility.name', 'Facility'], ['payerPlan.payer.name', 'Payer'],
      ['payerPlan.name', 'Plan'], ['status', 'Status'], ['nextFollowUpAt', 'Next follow-up']
    ]
  },
  tasks: {
    title: 'Tasks & Follow-ups', singular: 'Task', resource: 'tasks', search: 'Search task',
    fields: [
      ['title', 'Task Title', 'text', true], ['description', 'Description', 'textarea'],
      ['status', 'Status', 'select', ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']],
      ['priority', 'Priority', 'select', ['LOW', 'NORMAL', 'HIGH', 'URGENT']],
      ['dueAt', 'Due Date', 'date'],
      ['assignedToId', 'Assigned Employee', 'relation', 'employees'],
      ['caseId', 'Credentialing Case ID', 'text'],
      ['enrollmentId', 'Enrollment Application ID', 'text']
    ],
    columns: [
      ['title', 'Task'], ['priority', 'Priority'], ['status', 'Status'],
      ['assignedTo.name', 'Assignee'], ['dueAt', 'Due date']
    ]
  }
};

export const organizationSections = [
  { key: 'overview', label: 'Overview', icon: 'Gauge' },
  { key: 'profile', label: 'Organization Profile', icon: 'Building2' },
  { key: 'practices', label: 'Practices', icon: 'Landmark' },
  { key: 'providers', label: 'Providers', icon: 'Stethoscope' },
  { key: 'facilities', label: 'Facilities', icon: 'MapPin' },
  { key: 'payers', label: 'Payers', icon: 'ShieldCheck' },
  { key: 'enrollments', label: 'Payer Enrollment', icon: 'CreditCard' },
  { key: 'cases', label: 'Credentialing', icon: 'ClipboardCheck' },
  { key: 'documents', label: 'Document Management', icon: 'FileText' },
  { key: 'employees', label: 'Employees & HR', icon: 'Users' },
  { key: 'tasks', label: 'Tasks & Workflow', icon: 'CheckSquare' },
  { key: 'audit', label: 'Activity & Audit', icon: 'Activity' }
];

export const sectionResource = {
  practices: 'practices', providers: 'providers', facilities: 'facilities',
  payers: 'payers', enrollments: 'enrollments', cases: 'cases',
  documents: 'documents', employees: 'employees', tasks: 'tasks', audit: 'audit'
};
