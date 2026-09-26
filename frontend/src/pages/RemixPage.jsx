import React, { useState, useEffect, useMemo } from 'react';
import { createRemix } from '../api/client';
import BeforeAfter from '../components/BeforeAfter';
import { Sparkles, ArrowRight, RefreshCw, Layers, Check } from 'lucide-react';

const CATEGORIES = {
  neckline: ['mandarin', 'v-neck', 'sweetheart', 'turtleneck', 'open lapel', 'funnel neck', 'shawl collar'],
  sleeves: ['full', 'sleeveless', 'bell', 'three-quarter', 'off-shoulder', 'cap sleeves'],
  fabric: ['heavy cotton twill', 'mulberry silk', 'raw linen', 'cotton velvet', 'merino wool knit', 'chanderi silk', 'organic canvas'],
  color: ['onyx', 'emerald', 'earth tones', 'burgundy', 'ivory', 'sapphire', 'ochre', 'navy', 'rose'],
  fit: ['regular', 'relaxed', 'oversized', 'slim', 'bodycon', 'tailored', 'draped', 'flared']
};

export default function RemixPage({ post, onProceedToMatch, on3DPreview, onTryOn }) {
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [remixedImageUrl, setRemixedImageUrl] = useState('');
  const [remixObject, setRemixObject] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (post) {
      const defaultAttrs = {
        neckline: 'mandarin',
        sleeves: 'full',
        fabric: 'heavy cotton twill',
        color: 'onyx',
        fit: 'regular',
      };
      setSelectedAttributes({
        ...defaultAttrs,
        ...(post.base_attributes || {}),
      });
      setRemixedImageUrl(post.image_url);
      setRemixObject(null);
    }
  }, [post]);

  // Compute attribute diff string
  const diffPrompt = useMemo(() => {
    if (!post?.base_attributes) return '';
    const diffs = [];
    Object.keys(selectedAttributes).forEach((key) => {
      const baseVal = post.base_attributes[key];
      const newVal = selectedAttributes[key];
      if (baseVal && newVal && baseVal.toLowerCase() !== newVal.toLowerCase()) {
        diffs.push(`${key}: ${baseVal} → ${newVal}`);
      }
    });
    return diffs.join(' | ');
  }, [selectedAttributes, post]);

  const handleToggleChip = (category, value) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [category]: value
    }));
  };

  const handleGenerateRemix = async () => {
    if (!post) return;
    setIsGenerating(true);
    try {
      const remix = await createRemix(post.id, selectedAttributes);
      setRemixedImageUrl(remix.remixed_image_url);
      setRemixObject(remix);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMakeThis = () => {
    if (!post) return;
    if (remixObject) {
      onProceedToMatch(remixObject, selectedAttributes);
    } else {
      setIsGenerating(true);
      createRemix(post.id, selectedAttributes).then((remix) => {
        setIsGenerating(false);
        onProceedToMatch(remix, selectedAttributes);
      }).catch((err) => {
        console.error(err);
        setIsGenerating(false);
      });
    }
  };

  if (!post) {
    return (
      <div className="p-12 text-center text-gray-400 font-mono text-xs">
        No garment post selected. Please select a post from the Feed first.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-white/20 pb-4 text-left">
        <div>
          <span className="text-xs font-mono text-white uppercase tracking-widest">
            Remix Studio
          </span>
          <h2 className="text-2xl font-bold text-gray-100 m-0">
            {post.title}
          </h2>
          <p className="text-xs text-gray-400 font-mono">Original by {post.designer_name} ({post.designer_handle})</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block font-mono">Reference Price</span>
          <span className="text-lg font-bold text-white font-mono">${post.price_reference}</span>
        </div>
      </div>

      {/* Main Grid: Left Visualizer, Right Tactile Attribute Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        
        {/* Left Column: Visualizer & Compare */}
        <div className="lg:col-span-6 space-y-4">
          <BeforeAfter
            baseImageUrl={post.image_url}
            remixedImageUrl={remixedImageUrl || post.image_url}
            diffPrompt={diffPrompt}
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleGenerateRemix}
              disabled={isGenerating}
              className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white border border-amber-400/40 text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Synthesizing Image...' : 'Preview Attribute Diff'}
            </button>

            <button
              onClick={handleMakeThis}
              disabled={isGenerating}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 hover:scale-[1.02] transition-all disabled:opacity-50 cursor-pointer text-gray-950"
            >
              <Sparkles className="w-4 h-4 fill-gray-950 stroke-none" />
              MAKE THIS (Match Tailor)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {onTryOn && (
              <button
                onClick={() => onTryOn({
                  ...post,
                  image_url: remixedImageUrl || post.image_url,
                  title: `${post.title} (Custom Remix)`,
                  base_attributes: selectedAttributes
                })}
                className="py-2.5 rounded-xl bg-sky-950/80 hover:bg-sky-900/90 text-sky-300 hover:text-sky-200 border border-sky-500/40 hover:border-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>👗</span>
                Try On This Remix
              </button>
            )}

            {on3DPreview && (
              <button
                onClick={() => on3DPreview({
                  ...post,
                  image_url: remixedImageUrl || post.image_url,
                  title: `${post.title} (Custom Remix)`
                })}
                className="py-2.5 rounded-xl bg-gray-900/90 hover:bg-amber-400/10 text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>🧊</span>
                View in 3D Studio
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Tactile Attribute Chips */}
        <div className="lg:col-span-6 space-y-5 bg-gray-900/50 p-6 rounded-2xl border border-white/20/80">
          <div>
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2 m-0">
              <Layers className="w-4 h-4 text-white" />
              Structured Attribute Toggles
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Select garment attributes to modify silhouette, fabric composition & colorways.
            </p>
          </div>

          {Object.entries(CATEGORIES).map(([cat, options]) => {
            const currentVal = selectedAttributes[cat] || '';
            const baseVal = post.base_attributes?.[cat] || '';
            const isChanged = currentVal && baseVal && currentVal.toLowerCase() !== baseVal.toLowerCase();

            return (
              <div key={cat} className="space-y-2 border-b border-white/20/60 pb-4 last:border-none">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-300 uppercase tracking-wider font-mono">
                    {cat}
                  </span>
                  {isChanged && (
                    <span className="text-[10px] lp-glass-button/10 text-gray-300 border border-amber-400/30 px-2 py-0.5 rounded font-mono">
                      Modified (base: {baseVal})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const isSelected = currentVal && currentVal.toLowerCase() === option.toLowerCase();
                    return (
                      <button
                        key={option}
                        onClick={() => handleToggleChip(cat, option)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'lp-glass-button  font-bold shadow-md shadow-amber-400/30 border border-amber-300'
                            : 'lp-glass-input text-gray-300 hover:border-gray-600 border border-white/20'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
