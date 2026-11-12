/** Phase 1A master directories — API base `/api/directories/:resource` */

export const directoryMenu = [
  { key: 'usStates', label: 'US States', path: '/directories/usStates', scope: 'platform' },
  { key: 'specialties', label: 'Specialties', path: '/directories/specialties', scope: 'platform' },
  { key: 'licenseTypes', label: 'License Types', path: '/directories/licenseTypes', scope: 'platform' },
  { key: 'degreeTypes', label: 'Degree Types', path: '/directories/degreeTypes', scope: 'platform' },
  { key: 'educationTypes', label: 'Education Types', path: '/directories/educationTypes', scope: 'platform' },
  { key: 'residencyTypes', label: 'Residency Types', path: '/directories/residencyTypes', scope: 'platform' },
  { key: 'fellowshipTypes', label: 'Fellowship Types', path: '/directories/fellowshipTypes', scope: 'platform' },
  { key: 'boardCertificationCategories', label: 'Board Certifications', path: '/directories/boardCertificationCategories', scope: 'platform' },
  { key: 'certificationTypes', label: 'Certification Types', path: '/directories/certificationTypes', scope: 'platform' },
  { key: 'credentialCategories', label: 'Credential Categories', path: '/directories/credentialCategories', scope: 'hybrid' },
  { key: 'payers', label: 'Payers', path: '/payers', scope: 'platform', external: true },
  { key: 'plans', label: 'Payer Plans', path: '/plans', scope: 'platform', external: true },
  { key: 'payerContacts', label: 'Payer Contacts', path: '/directories/payerContacts', scope: 'tenant' },
  { key: 'billingEntities', label: 'Billing Entities', path: '/directories/billingEntities', scope: 'tenant' },
  { key: 'payerRequirements', label: 'Payer Requirements', path: '/directories/payerRequirements', scope: 'hybrid' }
];

const statusField = ['status', 'Status', 'select', ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']];

export const directoryConfig = {
  usStates: {
    title: 'US States', singular: 'US State', resource: 'usStates', search: 'Search state or abbreviation',
    fields: [
      ['name', 'State Name', 'text', true],
      ['abbreviation', 'Abbreviation', 'text', true],
      ['fipsCode', 'FIPS Code', 'text'],
      statusField
    ],
    columns: [['name', 'State'], ['abbreviation', 'Abbr'], ['fipsCode', 'FIPS'], ['status', 'Status']]
  },
  specialties: {
    title: 'Specialties', singular: 'Specialty', resource: 'specialties', search: 'Search specialty',
    fields: [
      ['name', 'Name', 'text', true],
      ['code', 'Code', 'text'],
      ['description', 'Description', 'textarea'],
      statusField
    ],
    columns: [['name', 'Specialty'], ['code', 'Code'], ['status', 'Status']]
  },
  licenseTypes: {
    title: 'License Types', singular: 'License Type', resource: 'licenseTypes', search: 'Search license type',
    fields: [
      ['code', 'Code', 'text', true],
      ['name', 'Display Name', 'text', true],
      ['profession', 'Profession', 'text'],
      ['description', 'Description', 'textarea'],
      statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['profession', 'Profession'], ['status', 'Status']]
  },
  degreeTypes: {
    title: 'Degree Types', singular: 'Degree Type', resource: 'degreeTypes', search: 'Search degree type',
    fields: [
      ['code', 'Code', 'text', true], ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'], statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['status', 'Status']]
  },
  educationTypes: {
    title: 'Education Types', singular: 'Education Type', resource: 'educationTypes', search: 'Search education type',
    fields: [
      ['code', 'Code', 'text', true], ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'], statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['status', 'Status']]
  },
  residencyTypes: {
    title: 'Residency Types', singular: 'Residency Type', resource: 'residencyTypes', search: 'Search residency type',
    fields: [
      ['code', 'Code', 'text', true], ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'], statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['status', 'Status']]
  },
  fellowshipTypes: {
    title: 'Fellowship Types', singular: 'Fellowship Type', resource: 'fellowshipTypes', search: 'Search fellowship type',
    fields: [
      ['code', 'Code', 'text', true], ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'], statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['status', 'Status']]
  },
  boardCertificationCategories: {
    title: 'Board Certification Categories', singular: 'Board Category', resource: 'boardCertificationCategories', search: 'Search board category',
    fields: [
      ['code', 'Code', 'text', true], ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'], statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['status', 'Status']]
  },
  certificationTypes: {
    title: 'Certification Types', singular: 'Certification Type', resource: 'certificationTypes', search: 'Search certification type',
    fields: [
      ['code', 'Code', 'text', true], ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'], statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['status', 'Status']]
  },
  credentialCategories: {
    title: 'Credential Categories', singular: 'Credential Category', resource: 'credentialCategories', search: 'Search category',
    fields: [
      ['scope', 'Scope', 'select', ['PLATFORM', 'TENANT']],
      ['code', 'Code', 'text', true],
      ['name', 'Name', 'text', true],
      ['description', 'Description', 'textarea'],
      ['requiredDefault', 'Required by default', 'select', ['true', 'false']],
      ['tracksExpiration', 'Tracks expiration', 'select', ['true', 'false']],
      ['defaultWarningDays', 'Default warning days', 'text'],
      ['sortOrder', 'Sort order', 'text'],
      statusField
    ],
    columns: [['code', 'Code'], ['name', 'Name'], ['scope', 'Scope'], ['status', 'Status']]
  },
  payerContacts: {
    title: 'Payer Contacts', singular: 'Payer Contact', resource: 'payerContacts', search: 'Search payer contact',
    fields: [
      ['payerId', 'Payer', 'relation', 'payers', true],
      ['payerPlanId', 'Payer Plan', 'relation', 'plans'],
      ['name', 'Contact Name', 'text', true],
      ['department', 'Department', 'text'],
      ['jobTitle', 'Job Title', 'text'],
      ['contactType', 'Contact Type', 'text'],
      ['phone', 'Phone', 'text'],
      ['fax', 'Fax', 'text'],
      ['email', 'Email', 'email'],
      ['notes', 'Notes', 'textarea'],
      statusField
    ],
    columns: [
      ['name', 'Contact'], ['payer.name', 'Payer'], ['department', 'Department'],
      ['phone', 'Phone'], ['email', 'Email'], ['status', 'Status']
    ]
  },
  billingEntities: {
    title: 'Billing Entities', singular: 'Billing Entity', resource: 'billingEntities', search: 'Search billing entity',
    fields: [
      ['legalName', 'Legal Name', 'text', true],
      ['dba', 'DBA', 'text'],
      ['taxId', 'Tax ID / EIN', 'text'],
      ['npi', 'NPI', 'text'],
      ['entityType', 'Entity Type', 'text'],
      ['organizationId', 'Related Organization', 'relation', 'organizations'],
      ['contactName', 'Contact Name', 'text'],
      ['contactTitle', 'Contact Title', 'text'],
      ['phone', 'Phone', 'text'],
      ['fax', 'Fax', 'text'],
      ['email', 'Email', 'email'],
      statusField
    ],
    columns: [
      ['legalName', 'Legal name'], ['dba', 'DBA'], ['taxId', 'Tax ID'],
      ['npi', 'NPI'], ['entityType', 'Type'], ['status', 'Status']
    ]
  },
  payerRequirements: {
    title: 'Payer Requirements', singular: 'Payer Requirement', resource: 'payerRequirements', search: 'Search requirement',
    fields: [
      ['scope', 'Scope', 'select', ['PLATFORM', 'TENANT']],
      ['payerId', 'Payer', 'relation', 'payers'],
      ['payerPlanId', 'Payer Plan', 'relation', 'plans'],
      ['code', 'Code', 'text'],
      ['title', 'Title', 'text', true],
      ['description', 'Description', 'textarea'],
      ['category', 'Category', 'select', [
        'PROVIDER_DEMOGRAPHIC', 'NPI', 'SPECIALTY', 'STATE_LICENSE', 'DEA', 'BOARD_CERTIFICATION',
        'EDUCATION', 'RESIDENCY', 'FELLOWSHIP', 'PROFESSIONAL_HISTORY', 'MALPRACTICE', 'TAX_W9',
        'GROUP_PRACTICE', 'BILLING_ENTITY', 'FACILITY', 'PAYER_APPLICATION_FORM', 'CORRESPONDENCE', 'OTHER'
      ]],
      ['requirementKind', 'Requirement Kind', 'text'],
      ['isRequired', 'Required', 'select', ['true', 'false']],
      ['documentCategoryCode', 'Document category code', 'text'],
      ['tracksExpiration', 'Tracks expiration', 'select', ['true', 'false']],
      ['appliesToFacility', 'Applies to facility', 'select', ['true', 'false']],
      ['appliesToGroup', 'Applies to group', 'select', ['true', 'false']],
      ['source', 'Requirement source', 'text'],
      ['sourceReference', 'Source reference / URL', 'text'],
      ['instructions', 'Instructions', 'textarea'],
      ['effectiveFrom', 'Effective from', 'date'],
      ['effectiveTo', 'Effective to', 'date'],
      ['sortOrder', 'Sort order', 'text'],
      statusField
    ],
    columns: [
      ['title', 'Requirement'], ['code', 'Code'], ['category', 'Category'],
      ['payer.name', 'Payer'], ['payerPlan.name', 'Plan'], ['isRequired', 'Required'],
      ['scope', 'Scope'], ['status', 'Status']
    ]
  }
};
