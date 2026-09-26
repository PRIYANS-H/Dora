import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Pipette, RefreshCw, Shirt, Sparkles, Undo2 } from 'lucide-react';
import { createRemix, fetchCatalog } from '../api/client';
import AttributeArt, { hasArt } from '../components/AttributeArt';
import BeforeAfter from '../components/BeforeAfter';
import CapsuleTabs from '../components/CapsuleTabs';
import Avatar from '../components/Avatar';
import { ATTRIBUTE_LABELS, ATTRIBUTE_NOTES, ATTRIBUTE_OPTIONS, COLOR_SWATCHES, colorName, fabricTexture, isCustomColor, isLightColor, swatchFor } from '../utils/attributes';
import { getPosts } from '../utils/postsCache';
import { postPrice } from '../utils/time';

const CATEGORIES = Object.keys(ATTRIBUTE_OPTIONS);
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const DEFAULTS = { neckline: 'mandarin', sleeves: 'full', fabric: 'heavy cotton twill', color: 'onyx', fit: 'regular' };

export function describeGarment(post, attributes = {}) {
  const color = attributes.color && (isCustomColor(attributes.color) ? `custom ${attributes.color}` : attributes.color);
  const parts = [color, attributes.fabric, attributes.garment_type || post?.garment_type || 'garment'].filter(Boolean).join(' ');
  const details = [attributes.neckline && `${attributes.neckline} neckline`, attributes.sleeves && `${attributes.sleeves} sleeves`, attributes.fit && `${attributes.fit} fit`].filter(Boolean).join(', ');
  return details ? `${parts} with ${details}` : parts;
}

function DesignPicker({ onPick }) {
  const [posts, setPosts] = useState(null);
  useEffect(() => { getPosts().then(setPosts).catch(() => setPosts([])); }, []);
  return (
    <div className="remix-picker">
      <header>
        <span className="kicker live">Remix Studio</span>
        <h2 className="display title-lg">Pick a design to make yours.</h2>
        <p className="lede">Choose any design, then change its neckline, sleeves, fabric, colour and fit — and try it on.</p>
      </header>
      <div className="maker-portfolio remix-picker-grid">
        {(posts || Array.from({ length: 8 }, (_, index) => ({ id: `s${index}` }))).map((post, index) => (post.image_url ? (
          <button type="button" key={post.id} className="maker-portfolio-item rise" style={{ '--i': index }} onClick={() => onPick(post)}>
            <img src={post.image_url} alt="" loading="lazy" />
            <span><strong>{post.title}</strong><em>{post.designer_name} · from {postPrice(post)}</em></span>
          </button>
        ) : <div key={post.id} className="maker-portfolio-item dori-skeleton" />))}
      </div>
    </div>
  );
}

function OptionTile({ category, option, selected, isBase, fallbackImage, onChoose }) {
  const art = hasArt(category, option);
  return (
    <button type="button" className={`option-tile ${selected ? 'is-selected' : ''}`} onClick={() => onChoose(option)} aria-pressed={selected}>
      <span className="option-art">
        {art ? <AttributeArt category={category} value={option} /> : fallbackImage ? <img src={fallbackImage} alt="" /> : <Shirt />}
      </span>
      <span className="option-name">{option}</span>
      {isBase && <span className="option-badge">Original</span>}
      {selected && <span className="option-check"><Check /></span>}
    </button>
  );
}

function ColorPicker({ value, base, onChoose }) {
  const custom = isCustomColor(value) ? value : null;
  const names = ATTRIBUTE_OPTIONS.color.includes(String(base || '').toLowerCase()) || !base ? ATTRIBUTE_OPTIONS.color : [base, ...ATTRIBUTE_OPTIONS.color];
  return (
    <div className="swatch-grid">
      {names.map((name) => {
        const fill = swatchFor(name) || '#888';
        const selected = same(value, name);
        return (
          <button key={name} type="button" className={`swatch ${selected ? 'is-selected' : ''}`} onClick={() => onChoose(name)} aria-pressed={selected}>
            <span className="swatch-dot" style={{ background: fill, color: isLightColor(fill) ? '#0b1a26' : '#fff' }}>{selected && <Check />}</span>
            <span className="swatch-name">{name}{same(base, name) && <em>Original</em>}</span>
          </button>
        );
      })}
      <label className={`swatch is-custom ${custom ? 'is-selected' : ''}`}>
        <span className="swatch-dot" style={custom ? { background: custom, color: isLightColor(custom) ? '#0b1a26' : '#fff' } : undefined}>
          <input type="color" value={custom || '#c25b7a'} onChange={(event) => onChoose(event.target.value)} aria-label="Pick a custom colour" />
          {custom ? <Check /> : <Pipette />}
        </span>
        <span className="swatch-name">{custom ? custom.toUpperCase() : 'Custom'}</span>
      </label>
    </div>
  );
}

function FabricPicker({ value, base, catalogFabrics, onChoose }) {
  const options = catalogFabrics.length
    ? catalogFabrics.map((fabric) => ({ name: fabric.name, image: fabric.image_url, meta: [fabric.color, fabric.composition].filter(Boolean).join(' · ') }))
    : ATTRIBUTE_OPTIONS.fabric.map((name) => ({ name }));
  if (base && !options.some((option) => same(option.name, base))) options.unshift({ name: base });
  return (
    <div className="fabric-grid">
      {options.map((option) => {
        const selected = same(value, option.name);
        return (
          <button key={option.name} type="button" className={`fabric-tile ${selected ? 'is-selected' : ''}`} onClick={() => onChoose(option.name)} aria-pressed={selected}>
            <span className="fabric-swatch" style={option.image ? undefined : { background: fabricTexture(option.name) }}>{option.image && <img src={option.image} alt="" />}</span>
            <span className="option-name">{option.name}</span>
            {option.meta && <span className="fabric-meta">{option.meta}</span>}
            {same(base, option.name) && <span className="option-badge">Original</span>}
            {selected && <span className="option-check"><Check /></span>}
          </button>
        );
      })}
    </div>
  );
}

// Shows what the chosen option means, with real DORI designs that use it.
function ReferencePanel({ category, value, posts, currentPostId }) {
  if (!value) return <div className="ref-panel is-empty"><p className="muted">Choose a {ATTRIBUTE_LABELS[category].toLowerCase()} to see references.</p></div>;
  const references = (posts || []).filter((post) => post.id !== currentPostId && same(post.base_attributes?.[category], value)).slice(0, 3);
  const note = ATTRIBUTE_NOTES[category]?.[String(value).toLowerCase()];
  const visual = category === 'color'
    ? <span className="ref-swatch" style={{ background: swatchFor(value) || '#888' }} />
    : category === 'fabric'
      ? <span className="ref-swatch is-fabric" style={{ background: fabricTexture(value) }} />
      : hasArt(category, value) ? <AttributeArt category={category} value={value} /> : <Shirt />;
  return (
    <div className="ref-panel" key={`${category}-${value}`}>
      <div className="ref-visual">{visual}</div>
      <div className="ref-copy">
        <span className="kicker">{ATTRIBUTE_LABELS[category]} reference</span>
        <h4 className="display">{category === 'color' ? colorName(value) : value}</h4>
        <p>{note || (category === 'color' ? 'Rendered on the garment when you generate your remix.' : 'Your tailor will match this on the finished piece.')}</p>
      </div>
      <div className="ref-photos">
        {references.length > 0 ? references.map((post) => (
          <figure key={post.id}>
            <img src={post.image_url} alt={`${post.title} — ${value}`} loading="lazy" />
            <figcaption>{post.title}</figcaption>
          </figure>
        )) : <p className="ref-none">No DORI design uses this yet — yours would be the first.</p>}
      </div>
    </div>
  );
}

export default function RemixPage({ post, onPickPost, onProceedToMatch, onTryOn }) {
  const [attributes, setAttributes] = useState({});
  const [tab, setTab] = useState('neckline');
  const [remixedImageUrl, setRemixedImageUrl] = useState('');
  const [remixObject, setRemixObject] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [catalog, setCatalog] = useState({ garments: [], fabrics: [] });
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!post) return;
    setAttributes({ ...DEFAULTS, ...(post.base_attributes || {}) });
    setRemixedImageUrl('');
    setRemixObject(null);
  }, [post]);

  useEffect(() => { getPosts().then(setPosts).catch(() => setPosts([])); }, []);

  useEffect(() => {
    let active = true;
    setCatalog({ garments: [], fabrics: [] });
    if (post?.tailor_id) fetchCatalog(post.tailor_id).then((value) => { if (active) setCatalog(value); }).catch(() => {});
    return () => { active = false; };
  }, [post?.tailor_id]);

  const base = post?.base_attributes || {};
  const changes = useMemo(() => CATEGORIES.filter((key) => base[key] && attributes[key] && !same(base[key], attributes[key])), [attributes, base]);
  const allChosen = CATEGORIES.every((key) => Boolean(attributes[key]));

  if (!post) return <DesignPicker onPick={onPickPost} />;

  const choose = (category, value) => {
    setAttributes((current) => ({ ...current, [category]: value }));
    setRemixObject(null);
  };

  const generate = async () => {
    if (!allChosen) return null;
    setIsGenerating(true);
    setError('');
    try {
      const remix = await createRemix(post.id, attributes);
      setRemixedImageUrl(remix.remixed_image_url);
      setRemixObject(remix);
      return remix;
    } catch (cause) {
      setError(cause.message || 'Could not generate this remix. Try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const makeThis = async () => {
    const remix = remixObject || await generate();
    if (remix) onProceedToMatch(remix, attributes);
  };

  const tryOn = () => onTryOn?.({
    image_url: remixedImageUrl || post.image_url,
    title: post.title,
    description: describeGarment(post, attributes),
    remixed: Boolean(remixedImageUrl),
    post,
  });

  // Until a render exists, preview a colour change as a tint over the garment.
  const pendingColor = !remixObject && attributes.color && base.color && !same(attributes.color, base.color) ? swatchFor(attributes.color) : null;
  const currentGarment = attributes.garment_type || catalog.garments.find((item) => same(item.name, post.garment_type))?.name || catalog.garments[0]?.name;
  const tabOptions = CATEGORIES.map((key) => ({ id: key, label: <>{ATTRIBUTE_LABELS[key]}{changes.includes(key) && <i className="tab-dot" aria-label="changed" />}</> }));

  return (
    <div className="remix">
      <header className="remix-head">
        <div className="remix-title">
          <Avatar name={post.designer_name} size={44} />
          <div>
            <span className="kicker live">Remixing</span>
            <h2 className="display title-md">{post.title}</h2>
            <span className="muted tiny">Original by {post.designer_name || 'a DORI designer'}{post.designer_handle ? ` · ${post.designer_handle}` : ''}</span>
          </div>
        </div>
        <div className="remix-head-actions">
          <span className="remix-price"><span className="muted tiny">Reference price</span><strong>{postPrice(post)}</strong></span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onPickPost(null)}>Change design</button>
        </div>
      </header>

      <div className="remix-grid">
        <div className="remix-visual">
          <div className="glass remix-visual-card">
            <BeforeAfter
              beforeSrc={post.image_url}
              afterSrc={remixedImageUrl || post.image_url}
              afterLabel={remixObject ? 'Your remix' : 'Preview'}
              tint={pendingColor}
              tintLabel="Colour preview"
              busy={isGenerating}
              sweepKey={remixedImageUrl}
            />
            <div className="remix-changes">
              {changes.length === 0 ? <span className="muted tiny">No changes yet — pick new options on the right.</span> : changes.map((key) => (
                <span className="chip is-change" key={key}>
                  <em>{ATTRIBUTE_LABELS[key]}</em>
                  <s>{key === 'color' ? colorName(base[key]) : base[key]}</s>
                  <ArrowRight />
                  {key === 'color' && <i className="chip-dot" style={{ background: swatchFor(attributes[key]) || '#888' }} />}
                  {key === 'color' ? colorName(attributes[key]) : attributes[key]}
                </span>
              ))}
              {changes.length > 0 && <button type="button" className="btn btn-sm btn-quiet" onClick={() => { setAttributes({ ...DEFAULTS, ...base }); setRemixObject(null); setRemixedImageUrl(''); }}><Undo2 /> Reset</button>}
            </div>
            <div className="remix-actions">
              <button type="button" className="btn btn-glass" onClick={generate} disabled={isGenerating || !allChosen}><RefreshCw className={isGenerating ? 'animate-spin' : ''} />{remixObject ? 'Re-render' : 'Render remix'}</button>
              <button type="button" className="btn" onClick={tryOn} disabled={isGenerating}><Shirt /> Try it on</button>
              <button type="button" className="btn btn-solid" onClick={makeThis} disabled={isGenerating || !allChosen}><Sparkles /> Make this <ArrowRight /></button>
            </div>
            {!allChosen && <p className="notice tone-info">Choose a neckline, sleeves, fabric, colour and fit to render or order your remix.</p>}
            {error && <p className="notice tone-bad" role="alert">{error}</p>}
          </div>
        </div>

        <section className="studio glass" aria-label="Make it yours">
          <header className="studio-head">
            <div><span className="kicker live">Make it yours</span><h3 className="display title-md">Change anything.</h3></div>
            <span className="studio-count">{changes.length} {changes.length === 1 ? 'change' : 'changes'}</span>
          </header>
          <CapsuleTabs options={tabOptions} value={tab} onChange={setTab} size="sm" ariaLabel="Garment attribute" />
          <div className="studio-body" key={tab}>
            {tab === 'color' && <ColorPicker value={attributes.color} base={base.color} onChoose={(value) => choose('color', value)} />}
            {tab === 'fabric' && <FabricPicker value={attributes.fabric} base={base.fabric} catalogFabrics={catalog.fabrics || []} onChoose={(value) => choose('fabric', value)} />}
            {!['color', 'fabric'].includes(tab) && (
              <div className={`option-grid ${tab === 'fit' ? 'is-fit' : ''}`}>
                {(base[tab] && !ATTRIBUTE_OPTIONS[tab].some((option) => same(option, base[tab])) ? [base[tab], ...ATTRIBUTE_OPTIONS[tab]] : ATTRIBUTE_OPTIONS[tab]).map((option) => (
                  <OptionTile key={option} category={tab} option={option} selected={same(attributes[tab], option)} isBase={same(base[tab], option)} fallbackImage={same(base[tab], option) ? post.image_url : null} onChoose={(value) => choose(tab, value)} />
                ))}
              </div>
            )}
            <ReferencePanel category={tab} value={attributes[tab]} posts={posts} currentPostId={post.id} />
          </div>
          {catalog.garments.length > 0 && (
            <div className="studio-garments">
              <span className="kicker">Made by this tailor</span>
              <div className="studio-garment-row">
                {catalog.garments.map((item) => (
                  <button type="button" key={item.id} className={`studio-garment ${currentGarment === item.name ? 'is-selected' : ''}`} onClick={() => choose('garment_type', item.name)}>
                    {item.image_url ? <img src={item.image_url} alt="" /> : <Shirt />}<span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
