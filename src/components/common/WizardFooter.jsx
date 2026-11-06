import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function WizardFooter({
  stepIndex,
  stepCount,
  stepLabel,
  onPrev,
  onNext,
  nextDisabled,
  prevDisabled
}) {
  const pct = ((stepIndex + 1) / stepCount) * 100;
  const isLast = stepIndex >= stepCount - 1;
  return (
    <div className="wizard-nav-bar">
      <button type="button" className="wizard-nav-btn ghost" disabled={prevDisabled || stepIndex === 0} onClick={onPrev}>
        <ArrowLeft size={15} /> Previous
      </button>
      <div className="wizard-nav-center">
        <span>PROFILE NAVIGATION · {stepIndex + 1} of {stepCount} — {stepLabel}</span>
        <div className="wizard-nav-track">
          <div className="wizard-nav-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button type="button" className="wizard-nav-btn solid" disabled={nextDisabled} onClick={onNext}>
        {isLast ? 'Done' : <>Next <ArrowRight size={15} /></>}
      </button>
    </div>
  );
}
