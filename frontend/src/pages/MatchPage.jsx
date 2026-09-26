import React, { useState, useEffect } from 'react';
import { matchTailors } from '../api/client';
import MatchBars from '../components/MatchBars';
import { Scissors, Star, MapPin, CheckCircle, ArrowRight, Award, ShieldCheck } from 'lucide-react';

export default function MatchPage({ remix, attributes, onSelectTailor }) {
  const [tailors, setTailors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    matchTailors(attributes)
      .then((data) => {
        setTailors(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [attributes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Running AI Tailor Matching Matrix...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/20 pb-4">
        <div>
          <span className="text-xs font-mono text-white uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            AI Tailor Matching Engine
          </span>
          <h2 className="text-2xl font-extrabold text-gray-100 m-0 mt-1">
            Top Matched Tailors for Your Spec
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Ranked by multi-factor score: skill overlap, proximity, artisan rating & portfolio tags.
          </p>
        </div>
      </div>

      {/* Tailor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tailors.map((tailor, idx) => (
          <div
            key={tailor.id}
            className={`lp-glass-panel rounded-2xl p-6 border flex flex-col justify-between transition-all relative overflow-hidden ${
              idx === 0 ? 'border-amber-400/50 glow-gold bg-gray-900/80' : 'border-white/20'
            }`}
          >
            {idx === 0 && (
              <div className="absolute top-0 right-0 lp-glass-button  text-[10px] font-extrabold font-mono px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3 h-3" />
                #1 Best Match
              </div>
            )}

            <div className="space-y-4">
              {/* Tailor Avatar & Name */}
              <div className="flex items-center gap-3">
                <img
                  src={tailor.photo_url}
                  alt={tailor.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-md"
                />
                <div>
                  <h3 className="text-base font-bold text-gray-100 m-0">
                    {tailor.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1 text-white font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 stroke-none" />
                      {tailor.rating}
                    </span>
                    <span>({tailor.reviews_count} reviews)</span>
                    <span className="capitalize px-2 py-0.5 rounded bg-gray-800 text-[10px] text-gray-300 font-mono">
                      {tailor.price_band}
                    </span>
                  </div>
                </div>
              </div>

              {/* Overall Match Score Banner */}
              <div className="lp-glass-input rounded-xl p-3 border border-white/20/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Overall Match Score</span>
                <span className="text-xl font-extrabold font-mono text-white">
                  {tailor.match_score}%
                </span>
              </div>

              {/* Explainable Score Breakdown Bars */}
              <MatchBars breakdown={tailor.breakdown} />

              {/* Artisan Skills Badges */}
              <div className="pt-2">
                <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
                  Artisan Skills
                </span>
                <div className="flex flex-wrap gap-1">
                  {tailor.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-md bg-gray-900 border border-white/20 text-[10px] text-gray-300 font-mono capitalize"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Select Action */}
            <div className="pt-6">
              <button
                onClick={() => onSelectTailor(tailor)}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  idx === 0
                    ? 'lp-glass-button  hover:bg-white/10 shadow-lg shadow-amber-400/20'
                    : 'bg-gray-900 text-gray-200 hover:bg-gray-800 border border-gray-700'
                }`}
              >
                <Scissors className="w-4 h-4" />
                Select {tailor.name.split(' ')[0]}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
