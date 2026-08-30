import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ListingReadinessIssue, ListingReadinessStep } from '../utils/listingReadiness';
import type { ListingQualityAssessment } from '../utils/listingQuality';

type ListingReadinessPanelProps = {
  issues: ListingReadinessIssue[];
  quality?: ListingQualityAssessment;
  onNavigate: (step: ListingReadinessStep) => void;
};

const STEPS: Array<{ id: ListingReadinessStep; label: string }> = [
  { id: 'details', label: 'Item' },
  { id: 'category', label: 'Category' },
  { id: 'shipping', label: 'Shipping & photos' },
  { id: 'price', label: 'Price & description' },
];

export default function ListingReadinessPanel({ issues, quality, onNavigate }: ListingReadinessPanelProps) {
  const blockers = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - blockers;
  const groupedIssues = STEPS.map((step) => ({
    ...step,
    issues: issues.filter((issue) => issue.step === step.id),
  })).filter((group) => group.issues.length > 0);

  if (issues.length === 0) {
    return (
      <section className="listingReadinessReady" aria-label="Listing readiness">
        <div className="listingReadinessBar" role="status">
          <span className="ready"><CheckCircle2 size={14} aria-hidden="true"/> Ready to stage{quality ? ` · Quality ${quality.score}` : ''}</span>
        </div>
      </section>
    );
  }

  return (
    <details className="listingReadinessDetails" aria-labelledby="listing-readiness-heading">
      <summary><span id="listing-readiness-heading">Listing readiness</span>{quality ? <span className={quality.grade === 'Blocked' ? 'missing' : 'ready'}>Quality {quality.score}</span> : null}<span className={blockers > 0 ? 'missing' : 'ready'}>{blockers} {blockers === 1 ? 'blocker' : 'blockers'}</span>{warnings ? <span className="missing">{warnings} {warnings === 1 ? 'warning' : 'warnings'}</span> : null}<small>Show details</small></summary>
      <div className="listingReadinessGroups">{groupedIssues.map((group) => {
        const groupBlockers = group.issues.filter((issue) => issue.severity === 'error').length;

        return (
          <section className="listingReadinessGroup" key={group.id} aria-labelledby={`readiness-${group.id}`}>
            <div className="actions">
              <div>
                <h3 id={`readiness-${group.id}`}>{group.label}</h3>
                <small>{groupBlockers > 0 ? `${groupBlockers} blocking ${groupBlockers === 1 ? 'issue' : 'issues'}` : 'Review recommended'}</small>
              </div>
              <button type="button" className="secondary" onClick={() => onNavigate(group.id)} aria-label={`Review ${group.label} issues`}>
                Review
              </button>
            </div>
            <ul>
              {group.issues.map((issue) => (
                <li key={`${issue.step}-${issue.field}`}>
                  <AlertTriangle size={15} aria-hidden="true"/>
                  <span><strong>{issue.blocking ? 'Required' : 'Check'}</strong> {issue.message}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}</div>
    </details>
  );
}
