import React from 'react';
import { Check, Plus } from 'lucide-react';
import Spinner from './Spinner';

// Always rendered, so the action never disappears — demo tailors that haven't
// claimed a DORI account show it disabled with the reason on hover.
export default function FollowButton({ following, busy, linked = true, isSelf = false, onToggle, size = 'sm', block = false }) {
  if (isSelf) return <span className={`btn btn-${size} btn-ghost follow-btn is-self ${block ? 'btn-block' : ''}`}>This is you</span>;
  const label = following ? 'Following' : 'Follow';
  return (
    <button
      type="button"
      className={`btn btn-${size} follow-btn ${following ? 'btn-ghost is-following' : 'btn-solid'} ${block ? 'btn-block' : ''}`}
      disabled={!linked || busy}
      title={linked ? undefined : 'This tailor hasn’t claimed their DORI account yet, so they can’t be followed.'}
      aria-pressed={following}
      onClick={(event) => { event.stopPropagation(); onToggle?.(); }}
    >
      {busy ? <Spinner size="sm" /> : following ? <Check /> : <Plus />}
      <span className="follow-label" data-hover={following ? 'Unfollow' : label}>{label}</span>
    </button>
  );
}
