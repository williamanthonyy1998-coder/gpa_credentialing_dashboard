import React from 'react';
import DirectorySelect from './DirectorySelect';

export { DirectorySelect };

export function SpecialtySelect(props) {
  return <DirectorySelect resource="specialties" placeholder="Select specialty" {...props} />;
}

/** Value is UsState.id — use for License.usStateId and similar FKs. */
export function StateSelect(props) {
  return (
    <DirectorySelect
      resource="usStates"
      placeholder="Select state"
      emptyLabel="—"
      {...props}
    />
  );
}

/** Value is USPS abbreviation — use for address.state JSON fields. */
export function StateAbbrevSelect(props) {
  return (
    <DirectorySelect
      resource="usStates"
      valueField="abbreviation"
      placeholder="Select state"
      emptyLabel="—"
      {...props}
    />
  );
}

export function LicenseTypeSelect(props) {
  return <DirectorySelect resource="licenseTypes" placeholder="Select license type" {...props} />;
}

export function PayerSelect(props) {
  return (
    <DirectorySelect
      resource="payers"
      source="resources"
      placeholder="Select payer"
      {...props}
    />
  );
}

export function PayerPlanSelect({ payerId, ...props }) {
  return (
    <DirectorySelect
      resource="plans"
      source="resources"
      placeholder={payerId ? 'Select plan' : 'Select payer first'}
      disabled={!payerId || props.disabled}
      params={payerId ? { payerId, limit: 500 } : { limit: 1 }}
      {...props}
    />
  );
}

export function BillingEntitySelect(props) {
  return (
    <DirectorySelect
      resource="billingEntities"
      placeholder="Select billing entity"
      {...props}
    />
  );
}

export function CredentialCategorySelect(props) {
  return (
    <DirectorySelect
      resource="credentialCategories"
      placeholder="Select category"
      {...props}
    />
  );
}
