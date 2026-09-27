import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Ruler, Save, ScanLine, Shirt } from 'lucide-react';
import { createOrder, fetchCatalog, fetchMeasurementProfiles, saveMeasurementProfile, updateMeasurementProfile } from '../api/client';
import MeasurementCapture from '../components/MeasurementCapture';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import { fabricTexture } from '../utils/attributes';
import { postPrice } from '../utils/time';
import { toast } from '../utils/toast';

const FIELDS = {
  womens: {
    upper_body: [['bust', 'Bust'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['half_length', 'Half length']],
    lower_body: [['waist', 'Waist'], ['hip', 'Hip'], ['height', 'Height'], ['inseam', 'Inside leg'], ['outseam', 'Outside leg']],
    full_body: [['bust', 'Bust'], ['waist', 'Waist'], ['hip', 'Hip'], ['shoulder', 'Shoulder'], ['full_length', 'Full length']],
    accessory: [['head', 'Head'], ['neck', 'Neck']], custom: [['height', 'Height'], ['waist', 'Waist']],
  },
  mens: {
    upper_body: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['shirt_length', 'Shirt length']],
    lower_body: [['waist', 'Waist'], ['hip', 'Hip'], ['leg_length', 'Leg length'], ['inseam', 'Inside leg'], ['outseam', 'Outside leg']],
    full_body: [['chest', 'Chest'], ['waist', 'Waist'], ['hip', 'Hip'], ['shoulder', 'Shoulder'], ['full_length', 'Full length']],
    accessory: [['head', 'Head'], ['neck', 'Neck']], custom: [['height', 'Height'], ['waist', 'Waist']],
  },
  // Kept for measurement profiles saved before the Male / Female choice existed.
  custom: { upper_body: [['chest_or_bust', 'Chest / bust'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['length', 'Garment length']], lower_body: [['waist', 'Waist'], ['hip', 'Hip'], ['inseam', 'Inside leg']], full_body: [['chest_or_bust', 'Chest / bust'], ['waist', 'Waist'], ['hip', 'Hip'], ['length', 'Full length']], accessory: [['size', 'Size']], custom: [['height', 'Height'], ['waist', 'Waist']] },
};

const FIT_OPTIONS = [{ id: 'mens', label: 'Male' }, { id: 'womens', label: 'Female' }];
const UNIT_OPTIONS = [{ id: 'in', label: 'Inches' }, { id: 'cm', label: 'Centimeters' }];

function Segmented({ options, value, onChange, label }) {
  const index = options.findIndex((option) => option.id === value);
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {index >= 0 && <span className="segmented-thumb" style={{ left: 4, width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />}
      {options.map((option) => (
        <button key={option.id} type="button" role="radio" aria-checked={option.id === value} className={option.id === value ? 'is-active' : ''} onClick={() => onChange(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}

export default function BriefPage({ remix, tailor, post, onOrderPlaced, onBack }) {
  const [fit, setFit] = useState('');
  const [unit, setUnit] = useState('in');
  const [garments, setGarments] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [garmentId, setGarmentId] = useState('');
  const [fabricId, setFabricId] = useState('');
  const [measurements, setMeasurements] = useState({});
  const [fromCamera, setFromCamera] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (tailor?.id) {
      fetchCatalog(tailor.id).then((catalog) => {
        if (!active) return;
        const list = catalog.garments || [];
        const cloths = catalog.fabrics || [];
        setGarments(list);
        setFabrics(cloths);
        setGarmentId(list.find((item) => item.name.toLowerCase() === String(remix?.attributes?.garment_type || post?.garment_type || '').toLowerCase())?.id || '');
        setFabricId(cloths.find((item) => item.name.toLowerCase() === String(remix?.attributes?.fabric || '').toLowerCase())?.id || '');
      }).catch((cause) => setError(cause.message));
    }
    fetchMeasurementProfiles().then((rows) => { if (active) setProfiles(rows); }).catch(() => {});
    return () => { active = false; };
  }, [tailor?.id, post?.garment_type, remix?.attributes?.garment_type, remix?.attributes?.fabric]);

  const garment = garments.find((item) => item.id === garmentId);
  const originalGarment = remix?.attributes?.garment_type || post?.garment_type || 'custom';
  // Seeded designs often lack a garment type, so the title helps pick the right measurements.
  const garmentName = `${originalGarment} ${post?.title || ''}`.toLowerCase();
  const inferredCategory = /trouser|pant|jean|skirt|short|lower/.test(garmentName) ? 'lower_body' : /dress|gown|jumpsuit|coat|overall|full|trench|kurta|cape|midi|maxi|saree|lehenga|anarkali/.test(garmentName) ? 'full_body' : /shirt|blouse|top|jacket|tie|upper|blazer|vest|kimono|sherwani|kurti/.test(garmentName) ? 'upper_body' : 'custom';
  const category = garment?.category || inferredCategory;
  const fields = useMemo(() => (fit ? FIELDS[fit]?.[category] || FIELDS[fit]?.custom : null), [fit, category]);
  const selectedFabric = fabrics.find((item) => item.id === fabricId);
  const filled = (fields || []).filter(([key]) => Number(measurements[key]) > 0).length;

  const cleanMeasurements = () => Object.fromEntries(Object.entries(measurements).filter(([, value]) => value !== '' && Number(value) > 0).map(([key, value]) => [key, Number(value)]));

  const chooseFit = (next) => { setFit(next); setProfileId(''); setMeasurements({}); setFromCamera(false); };

  const applyProfile = (saved) => {
    if (profileId === saved.id) { setProfileId(''); setMeasurements({}); return; }
    setProfileId(saved.id);
    setFit(saved.fit_template);
    setUnit(saved.unit);
    setFromCamera(false);
    setMeasurements(Object.fromEntries(Object.entries(saved.measurements || {}).map(([key, value]) => [key, String(value)])));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const values = cleanMeasurements();
    if (!fit) { setError('Choose Male or Female so we can ask for the right measurements.'); return; }
    if (!Object.keys(values).length) { setError('Add your measurements, or measure with your camera.'); return; }
    setBusy(true);
    try {
      const notes = [customerNote.trim(), selectedFabric ? `Fabric preference: ${selectedFabric.name}${selectedFabric.color ? ` (${selectedFabric.color})` : ''}` : ''].filter(Boolean).join('\n');
      const order = await createOrder(remix.id, tailor.id, { ...values, unit, fit_template: fit }, {
        measurement_profile_id: profileId || undefined, customer_note: notes, garment_type: garment?.name || originalGarment,
        phone_number: phone.trim() || undefined, fabric_id: fabricId || undefined,
      });
      onOrderPlaced(order);
    } catch (cause) {
      setError(cause.message || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = async () => {
    const values = cleanMeasurements();
    if (!Object.keys(values).length) { setError('Add measurements before saving them.'); return; }
    try {
      const existing = profiles.find((item) => item.id === profileId);
      const payload = { label: existing?.label || `${fit === 'womens' ? 'Female' : 'Male'} · ${unit}`, fit_template: fit, unit, measurements: values };
      const saved = profileId ? await updateMeasurementProfile(profileId, payload) : await saveMeasurementProfile(payload);
      setProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setProfileId(saved.id);
      toast('Measurements saved to your profile');
    } catch (cause) { setError(cause.message); }
  };

  if (!remix || !tailor) {
    return <div className="empty glass feed-empty"><Avatar size={52} /><strong>Pick a design and a tailor first</strong><p>Start in Remix Studio, then choose a tailor to make it.</p></div>;
  }

  return (
    <form className="brief" onSubmit={submit}>
      <header className="brief-head">
        <div>
          <span className="kicker live">Make it yours</span>
          <h2 className="display title-lg">Fit it to you.</h2>
          <p className="lede">Choose how {tailor.name.split(' ')[0]} makes it, add your measurements, and send the request. You’ll agree the final price in Messages before paying.</p>
        </div>
        {onBack && <button type="button" className="btn btn-sm btn-ghost" onClick={onBack}><ArrowLeft /> Change tailor</button>}
      </header>

      {error && <p className="notice tone-bad" role="alert">{error}</p>}

      <div className="brief-grid">
        <div className="brief-steps">
          <section className="brief-card glass">
            <h3 className="brief-card-title"><span className="step-num">1</span> Garment & fabric</h3>
            <div className="brief-tiles">
              <button type="button" className={`brief-tile ${!garmentId ? 'is-selected' : ''}`} onClick={() => setGarmentId('')}>
                <span className="brief-tile-art">{remix.remixed_image_url || post?.image_url ? <img src={remix.remixed_image_url || post?.image_url} alt="" /> : <Shirt />}</span>
                <strong>As designed</strong><em>{originalGarment}</em>
                {!garmentId && <span className="option-check"><Check /></span>}
              </button>
              {garments.map((item) => (
                <button type="button" key={item.id} className={`brief-tile ${garmentId === item.id ? 'is-selected' : ''}`} onClick={() => { setGarmentId(item.id); setProfileId(''); setMeasurements({}); }}>
                  <span className="brief-tile-art">{item.image_url ? <img src={item.image_url} alt="" /> : <Shirt />}</span>
                  <strong>{item.name}</strong><em>{String(item.category || '').replaceAll('_', ' ')}</em>
                  {garmentId === item.id && <span className="option-check"><Check /></span>}
                </button>
              ))}
            </div>
            {fabrics.length > 0 && <>
              <span className="field-label brief-sub">Fabric from this tailor</span>
              <div className="brief-tiles is-fabric">
                <button type="button" className={`brief-tile ${!fabricId ? 'is-selected' : ''}`} onClick={() => setFabricId('')}>
                  <span className="brief-tile-art is-swatch" style={{ background: fabricTexture(remix?.attributes?.fabric) }} /><strong>No preference</strong><em>{remix?.attributes?.fabric || 'Tailor’s choice'}</em>
                  {!fabricId && <span className="option-check"><Check /></span>}
                </button>
                {fabrics.map((item) => (
                  <button type="button" key={item.id} className={`brief-tile ${fabricId === item.id ? 'is-selected' : ''}`} onClick={() => setFabricId(item.id)}>
                    <span className="brief-tile-art is-swatch" style={item.image_url ? undefined : { background: fabricTexture(item.name) }}>{item.image_url && <img src={item.image_url} alt="" />}</span>
                    <strong>{item.name}</strong><em>{[item.color, item.price_delta_minor > 0 ? `+${item.currency} ${(item.price_delta_minor / 100).toFixed(0)}` : ''].filter(Boolean).join(' · ') || 'Included'}</em>
                    {fabricId === item.id && <span className="option-check"><Check /></span>}
                  </button>
                ))}
              </div>
            </>}
          </section>

          <section className="brief-card glass">
            <h3 className="brief-card-title"><span className="step-num">2</span> Your fit</h3>
            <div className="brief-fit-row">
              <div className="field"><span className="field-label">Fit profile</span><Segmented options={FIT_OPTIONS} value={fit} onChange={chooseFit} label="Fit profile" /></div>
              <div className="field"><span className="field-label">Units</span><Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} label="Units" /></div>
            </div>

            {profiles.length > 0 && (
              <div className="brief-saved">
                <span className="field-label">Saved measurements</span>
                <div className="brief-saved-row">
                  {profiles.map((saved) => (
                    <button type="button" key={saved.id} className={`chip brief-saved-chip ${profileId === saved.id ? 'is-selected' : ''}`} onClick={() => applyProfile(saved)}>
                      {profileId === saved.id && <Check />}{saved.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {fields ? <>
              <button type="button" className="measure-cta" onClick={() => setCaptureOpen(true)}>
                <span className="measure-cta-icon"><ScanLine /></span>
                <span><strong>Measure with your camera</strong><em>Green guide lines mark each measurement on your body, live.</em></span>
                <ArrowRight />
              </button>
              <div className="measure-fields">
                {fields.map(([key, label]) => (
                  <label className={`measure-field ${Number(measurements[key]) > 0 ? 'is-filled' : ''}`} key={key}>
                    <span className="field-label">{label}{fromCamera && Number(measurements[key]) > 0 && <em className="measure-source">camera</em>}</span>
                    <span className="measure-input">
                      <input className="input" type="number" inputMode="decimal" min="1" max="500" step="0.1" value={measurements[key] || ''} onChange={(event) => { setMeasurements((current) => ({ ...current, [key]: event.target.value })); setFromCamera(false); if (profileId) setProfileId(''); }} placeholder="0" />
                      <i>{unit}</i>
                    </span>
                  </label>
                ))}
              </div>
              <div className="brief-fit-foot">
                <span className="muted tiny"><Ruler /> {filled} of {fields.length} measurements added</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={saveCurrent} disabled={!filled}><Save /> {profileId ? 'Update saved' : 'Save for next time'}</button>
              </div>
            </> : <p className="notice tone-info">Choose <strong>Male</strong> or <strong>Female</strong> to see the measurements this tailor needs.</p>}
          </section>

          <section className="brief-card glass">
            <h3 className="brief-card-title"><span className="step-num">3</span> Notes for {tailor.name.split(' ')[0]}</h3>
            <label className="field"><span className="field-label">Anything to discuss</span><textarea className="input" maxLength="2000" rows="4" value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Fit preferences, delivery date, questions about the fabric…" /></label>
            <label className="field"><span className="field-label">Phone (optional)</span><input className="input" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Only shared with this order’s tailor" /></label>
          </section>
        </div>

        <aside className="brief-summary glass">
          <img src={remix.remixed_image_url || post?.image_url} alt="" />
          <div className="brief-summary-body">
            <span className="kicker">Your request</span>
            <h3 className="display title-sm">{post?.title || 'Remixed design'}</h3>
            <dl>
              <div><dt>Tailor</dt><dd><Avatar src={tailor.photo_url} name={tailor.name} size={22} /> {tailor.name}</dd></div>
              <div><dt>Garment</dt><dd>{garment?.name || originalGarment}</dd></div>
              <div><dt>Fabric</dt><dd>{selectedFabric?.name || remix?.attributes?.fabric || 'Tailor’s choice'}</dd></div>
              <div><dt>Fit</dt><dd>{fit ? `${FIT_OPTIONS.find((option) => option.id === fit)?.label || 'Custom'} · ${unit}` : '—'}</dd></div>
              <div><dt>Measurements</dt><dd>{fields ? `${filled} / ${fields.length}` : '—'}</dd></div>
              <div className="is-total"><dt>Starting price</dt><dd>{postPrice(post)}</dd></div>
            </dl>
            <button type="submit" className="btn btn-solid btn-lg btn-block" disabled={busy}>{busy ? <><Spinner size="sm" /> Sending…</> : <>Request this garment <ArrowRight /></>}</button>
            <p className="muted tiny">No payment yet — {tailor.name.split(' ')[0]} confirms the final price with you in Messages first.</p>
          </div>
        </aside>
      </div>

      {captureOpen && fields && (
        <MeasurementCapture
          fields={fields}
          unit={unit}
          onClose={() => setCaptureOpen(false)}
          onApply={(values) => { setMeasurements(values); setProfileId(''); setFromCamera(true); setCaptureOpen(false); toast('Measurements added from your camera'); }}
        />
      )}
    </form>
  );
}
