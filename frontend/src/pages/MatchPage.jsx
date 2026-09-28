import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, Check, MapPin, Scissors, Star, Users } from 'lucide-react';
import { fetchTailors, matchTailors, sendCollabInvite } from '../api/client';
import Avatar from '../components/Avatar';
import MatchBars from '../components/MatchBars';
import Spinner from '../components/Spinner';
import { ATTRIBUTE_LABELS, colorName, swatchFor } from '../utils/attributes';
import { toast } from '../utils/toast';

function ScoreRing({ value }) {
  const score = Math.round(Number(value) || 0);
  return (
    <div className="score-ring" style={{ '--score': score }} role="img" aria-label={`${score}% match`}>
      <span><strong>{score}</strong><em>%</em></span>
    </div>
  );
}

function TailorCard({ tailor, rank, isOriginal, canShare, collab, onSelect, onShare }) {
  const linked = Boolean(tailor.profile_id);
  return (
    <article className={`tailor-card glass rise ${rank === 0 ? 'is-top' : ''}`} style={{ '--i': rank }}>
      <div className="tailor-card-badges">
        {rank === 0 && <span className="tailor-badge glass-capsule"><Award /> Best match</span>}
        {isOriginal && <span className="tailor-badge is-original">Original maker</span>}
      </div>
      <header className="tailor-card-head">
        <Avatar src={tailor.photo_url} name={tailor.name} size={60} />
        <div>
          <h3>{tailor.name}</h3>
          <span className="tailor-meta">
            {tailor.reviews_count > 0 ? <><Star fill="currentColor" /> {Number(tailor.rating).toFixed(1)} <em>({tailor.reviews_count})</em></> : <em>New on DORI</em>}
            {tailor.price_band && <span className="chip">{tailor.price_band}</span>}
          </span>
        </div>
        <ScoreRing value={tailor.match_score} />
      </header>
      <MatchBars breakdown={tailor.breakdown} />
      {(tailor.skills || []).length > 0 && (
        <div className="tailor-skills">{tailor.skills.slice(0, 5).map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
      )}
      <div className="tailor-actions">
        <button type="button" className={`btn ${rank === 0 ? 'btn-solid' : ''}`} onClick={() => onSelect(tailor)} disabled={!linked} title={linked ? undefined : 'This demo tailor hasn’t connected a DORI account yet.'}>
          <Scissors /> {linked ? `Choose ${tailor.name.split(' ')[0]}` : 'Not on DORI yet'} {linked && <ArrowRight />}
        </button>
        {canShare && (
          <button type="button" className="btn btn-ghost" onClick={() => onShare(tailor)} disabled={!linked || collab === 'sending' || collab === 'sent'}>
            {collab === 'sending' ? <Spinner size="sm" /> : collab === 'sent' ? <Check /> : <Users />}
            {collab === 'sent' ? 'Design shared' : 'Share to collaborate'}
          </button>
        )}
      </div>
    </article>
  );
}

export default function MatchPage({ remix, attributes, post, onSelectTailor, onBack }) {
  const [tailors, setTailors] = useState(null);
  const [collab, setCollab] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([matchTailors(attributes), post?.tailor_id ? fetchTailors() : Promise.resolve([])])
      .then(([matches, all]) => {
        let ranked = matches;
        if (post?.tailor_id) {
          const original = matches.find((item) => item.id === post.tailor_id) || all.find((item) => item.id === post.tailor_id);
          if (original) ranked = [original, ...matches.filter((item) => item.id !== post.tailor_id)].slice(0, 4);
        }
        if (active) setTailors(ranked);
      })
      .catch(() => { if (active) setTailors([]); });
    return () => { active = false; };
  }, [attributes, post?.tailor_id]);

  const share = async (tailor) => {
    setCollab((current) => ({ ...current, [tailor.id]: 'sending' }));
    try {
      await sendCollabInvite(tailor.id, post?.id, attributes);
      setCollab((current) => ({ ...current, [tailor.id]: 'sent' }));
      toast(`Design shared with ${tailor.name}`);
    } catch (error) {
      setCollab((current) => ({ ...current, [tailor.id]: 'error' }));
      toast(error.message || 'Couldn’t share the design', 'bad');
    }
  };

  const spec = ['neckline', 'sleeves', 'fabric', 'color', 'fit'].filter((key) => attributes?.[key]);

  return (
    <div className="match">
      <section className="match-summary glass">
        <img src={remix?.remixed_image_url || post?.image_url} alt="" />
        <div className="match-summary-copy">
          <span className="kicker live">Matching tailors for</span>
          <h2 className="display title-md">{post?.title || 'Your remix'}</h2>
          <div className="match-spec">
            {spec.map((key) => (
              <span className="chip" key={key}>
                {key === 'color' && <i className="chip-dot" style={{ background: swatchFor(attributes[key]) || '#888' }} />}
                <em>{ATTRIBUTE_LABELS[key]}</em> {key === 'color' ? colorName(attributes[key]) : attributes[key]}
              </span>
            ))}
          </div>
          <p className="muted tiny"><MapPin /> Ranked by skill overlap, proximity, rating and portfolio fit.</p>
        </div>
        {onBack && <button type="button" className="btn btn-sm btn-ghost match-back" onClick={onBack}><ArrowLeft /> Edit remix</button>}
      </section>

      {tailors === null ? (
        <div className="tailor-grid">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="tailor-card glass is-skeleton"><span className="dori-skeleton" /><i className="dori-skeleton" /><i className="dori-skeleton" /><i className="dori-skeleton" /></div>)}
        </div>
      ) : tailors.length === 0 ? (
        <div className="empty glass feed-empty"><Avatar size={52} /><strong>No tailors matched yet</strong><p>Try relaxing the fabric or fit — or check back as more tailors join DORI.</p></div>
      ) : (
        <div className="tailor-grid">
          {tailors.map((tailor, index) => (
            <TailorCard key={tailor.id} tailor={tailor} rank={index} isOriginal={post?.tailor_id === tailor.id} canShare={Boolean(post?.id)} collab={collab[tailor.id]} onSelect={onSelectTailor} onShare={share} />
          ))}
        </div>
      )}
    </div>
  );
}
