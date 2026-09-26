import React, { useState, useEffect } from 'react';
import { fetchPosts } from '../api/client';
import { Sparkles, Tag, ArrowRight, Search, Heart } from 'lucide-react';

export default function FeedPage({ onSelectPost, on3DPreview }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchPosts()
      .then((data) => {
        setPosts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredPosts = posts.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.designer_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (selectedFilter === 'all') return matchesSearch;
    return matchesSearch && p.base_attributes?.fabric?.toLowerCase().includes(selectedFilter.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Loading Couture Feed...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="relative rounded-3xl p-8 overflow-hidden bg-gradient-to-r from-gray-900 via-gray-950 to-purple-950 border border-white/20 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-3 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full lp-glass-button/10 border border-amber-400/30 text-gray-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Remixable Couture Network</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight m-0">
            See high fashion. <br />
            <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
              Remix attributes. Wear it.
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-xl">
            Pick any design below, customize necklines, fabrics & silhouettes with tactile chips, and match to master tailors to craft your custom fit.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search designs or designers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900/80 border border-white/20 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {['all', 'silk', 'linen', 'cotton', 'wool'].map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                selectedFilter === f
                  ? 'lp-glass-button  font-bold shadow-md shadow-amber-400/20'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-white/20'
              }`}
            >
              {f === 'all' ? 'All Fabrics' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Garment Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => onSelectPost(post)}
            className="group lp-glass-panel rounded-2xl overflow-hidden border border-white/20/80 cursor-pointer lp-glass-panel-hover flex flex-col justify-between"
          >
            <div>
              {/* Image / Video Container */}
              <div className="relative h-72 w-full overflow-hidden lp-glass-input">
                {post.image_url?.endsWith('.mp4') || post.base_attributes?.media_type === 'video' ? (
                  <video
                    src={post.image_url}
                    muted
                    loop
                    playsInline
                    autoPlay
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute top-3 left-3 lp-glass-input/80 backdrop-blur px-3 py-1 rounded-full border border-white/20 text-[11px] font-semibold text-gray-200">
                  {post.designer_name}
                </div>
                <div className="absolute top-3 right-3 lp-glass-input/80 backdrop-blur p-2 rounded-full border border-white/20 text-gray-400 hover:text-rose-400 transition-colors">
                  <Heart className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 text-left space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-gray-100 group-hover:text-gray-300 transition-colors m-0">
                    {post.title}
                  </h3>
                  <span className="text-xs font-mono font-semibold text-white lp-glass-button/10 px-2 py-0.5 rounded border border-amber-400/30">
                    ${post.price_reference}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  {post.designer_handle}
                </p>

                {/* AI / Designer Caption */}
                {post.base_attributes?.description && (
                  <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                    {post.base_attributes.description}
                  </p>
                )}

                {/* Base Attribute Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(post.base_attributes || {})
                    .filter(([k]) => k !== 'description' && k !== 'media_type')
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-md bg-gray-900 border border-white/20 text-[10px] text-gray-300 font-mono capitalize"
                      >
                        {k}: {v}
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-5 pt-0 text-left flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onSelectPost(post); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 group-hover:lp-glass-button text-gray-300 text-xs font-bold flex items-center justify-center gap-2 border border-white/20 group-hover:border-white transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Remix
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
              {on3DPreview && (
                <button
                  onClick={(e) => { e.stopPropagation(); on3DPreview(post); }}
                  title="Generate 3D Preview with Microsoft TRELLIS"
                  className="px-3 py-2.5 rounded-xl bg-gray-900 text-gray-400 hover:text-amber-400 text-xs font-bold border border-white/20 hover:border-amber-400/50 transition-all flex items-center gap-1.5"
                >
                  🧊 3D
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
