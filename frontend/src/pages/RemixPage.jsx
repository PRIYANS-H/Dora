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

export default function RemixPage({ post, onProceedToMatch }) {
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [remixedImageUrl, setRemixedImageUrl] = useState('');
  const [remixObject, setRemixObject] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (post) {
      setSelectedAttributes(post.base_attributes || {
        neckline: 'mandarin',
        sleeves: 'full',
        fabric: 'heavy cotton twill',
        color: 'onyx',
        fit: 'regular'
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
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 text-left">
        <div>
          <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">
            Remix Studio
          </span>
          <h2 className="text-2xl font-bold text-gray-100 m-0">
            {post.title}
          </h2>
          <p className="text-xs text-gray-400 font-mono">Original by {post.designer_name} ({post.designer_handle})</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block font-mono">Reference Price</span>
          <span className="text-lg font-bold text-amber-400 font-mono">${post.price_reference}</span>
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
              className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-amber-400 border border-amber-400/40 text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Synthesizing Image...' : 'Preview Attribute Diff'}
            </button>

            <button
              onClick={handleMakeThis}
              disabled={isGenerating}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 hover:scale-[1.02] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-gray-950 stroke-none" />
              MAKE THIS (Match Tailor)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Tactile Attribute Chips */}
        <div className="lg:col-span-6 space-y-5 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/80">
          <div>
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2 m-0">
              <Layers className="w-4 h-4 text-amber-400" />
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
              <div key={cat} className="space-y-2 border-b border-gray-800/60 pb-4 last:border-none">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-300 uppercase tracking-wider font-mono">
                    {cat}
                  </span>
                  {isChanged && (
                    <span className="text-[10px] bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-mono">
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
                            ? 'bg-amber-400 text-gray-950 font-bold shadow-md shadow-amber-400/30 border border-amber-300'
                            : 'bg-gray-950 text-gray-300 hover:border-gray-600 border border-gray-800'
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
