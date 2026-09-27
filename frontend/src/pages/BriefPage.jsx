import React, { useEffect, useMemo, useState } from 'react';
import { createOrder, fetchCatalog, fetchMeasurementProfiles, saveMeasurementProfile, updateMeasurementProfile } from '../api/client';
import { Ruler, ShieldCheck, ArrowRight, ScanLine } from 'lucide-react';
import MeasurementCapture from '../components/MeasurementCapture';

const FIELDS = {
  womens: {
    upper_body: [['bust', 'Bust'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['half_length', 'Half length']],
    lower_body: [['waist', 'Waist'], ['hip', 'Hip'], ['height', 'Height'], ['inseam', 'Inside leg'], ['outseam', 'Outside leg']],
    full_body: [['bust', 'Bust'], ['waist', 'Waist'], ['hip', 'Hip'], ['shoulder', 'Shoulder'], ['full_length', 'Full length']],
    accessory: [['head', 'Head'], ['neck', 'Neck']], custom: [['height', 'Height'], ['waist', 'Waist']]
  },
  mens: {
    upper_body: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['shirt_length', 'Shirt length']],
    lower_body: [['waist', 'Waist'], ['hip', 'Hip'], ['leg_length', 'Leg length'], ['inseam', 'Inside leg'], ['outseam', 'Outside leg']],
    full_body: [['chest', 'Chest'], ['waist', 'Waist'], ['hip', 'Hip'], ['shoulder', 'Shoulder'], ['full_length', 'Full length']],
    accessory: [['head', 'Head'], ['neck', 'Neck']], custom: [['height', 'Height'], ['waist', 'Waist']]
  },
  custom: { upper_body: [['chest_or_bust', 'Chest / bust'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['length', 'Garment length']], lower_body: [['waist', 'Waist'], ['hip', 'Hip'], ['inseam', 'Inside leg']], full_body: [['chest_or_bust', 'Chest / bust'], ['waist', 'Waist'], ['hip', 'Hip'], ['length', 'Full length']], accessory: [['size', 'Size']], custom: [['height', 'Height'], ['waist', 'Waist']] }
};

export default function BriefPage({ remix, tailor, post, onOrderPlaced }) {
  const [fit, setFit] = useState('custom');
  const [unit, setUnit] = useState('in');
  const [garments, setGarments] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [garmentId, setGarmentId] = useState('');
  const [fabricId, setFabricId] = useState('');
  const [measurements, setMeasurements] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (tailor?.id) fetchCatalog(tailor.id).then((catalog) => { if (active) { const list = catalog.garments || []; const cloths = catalog.fabrics || []; setGarments(list); setFabrics(cloths); const match = list.find((item) => item.name.toLowerCase() === String(remix?.attributes?.garment_type || post?.garment_type || '').toLowerCase()); setGarmentId(match?.id || ''); const clothMatch = cloths.find((item) => item.name.toLowerCase() === String(remix?.attributes?.fabric || '').toLowerCase()); setFabricId(clothMatch?.id || ''); } }).catch((e) => setError(e.message));
    fetchMeasurementProfiles().then((rows) => { if (active) setProfiles(rows); }).catch(() => {});
    return () => { active = false; };
  }, [tailor?.id, post?.garment_type, remix?.attributes?.garment_type, remix?.attributes?.fabric]);

  const garment = garments.find((item) => item.id === garmentId);
  const originalGarment = remix?.attributes?.garment_type || post?.garment_type || 'custom';
  const garmentName = originalGarment.toLowerCase();
  const inferredCategory = /trouser|pant|jean|skirt|short|lower/.test(garmentName) ? 'lower_body' : /dress|gown|jumpsuit|coat|overall|full/.test(garmentName) ? 'full_body' : /shirt|blouse|top|jacket|tie|upper/.test(garmentName) ? 'upper_body' : 'custom';
  const category = garment?.category || inferredCategory;
  const fields = useMemo(() => FIELDS[fit]?.[category] || FIELDS[fit]?.custom, [fit, category]);
  const selectedFabric = fabrics.find((item) => item.id === fabricId);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const finalMeasurements = profileId ? {} : Object.fromEntries(Object.entries(measurements).filter(([, value]) => value !== '' && Number(value) > 0).map(([key, value]) => [key, Number(value)]));
      if (!profileId && Object.keys(finalMeasurements).length === 0) throw new Error('Enter your measurements or choose a saved measurement profile.');
      const chosenGarment = garment?.name || originalGarment;
      const notes = [customerNote.trim(), selectedFabric ? `Fabric preference: ${selectedFabric.name}${selectedFabric.color ? ` (${selectedFabric.color})` : ''}` : ''].filter(Boolean).join('\n');
      const order = await createOrder(remix.id, tailor.id, { ...finalMeasurements, unit, fit_template: fit }, { measurement_profile_id: profileId || undefined, customer_note: notes, garment_type: chosenGarment, phone_number: phone.trim() || undefined, fabric_id: fabricId || undefined });
      onOrderPlaced(order);
    } catch (err) { setError(err.message || 'Could not place the order.'); }
    finally { setBusy(false); }
  };

  const saveCurrent = async () => {
    const values = Object.fromEntries(Object.entries(measurements).filter(([, value]) => value !== '' && Number(value) > 0).map(([key, value]) => [key, Number(value)]));
    if (!Object.keys(values).length) { setError('Add measurements before saving a profile.'); return; }
    try { const payload = { label: profiles.find((item) => item.id === profileId)?.label || `${fit === 'womens' ? 'Women’s' : fit === 'mens' ? 'Men’s' : 'Custom'} ${unit} profile`, fit_template: fit, unit, measurements: values }; const saved = profileId ? await updateMeasurementProfile(profileId, payload) : await saveMeasurementProfile(payload); setProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setProfileId(saved.id); setError('Measurements saved to your profile.'); }
    catch (err) { setError(err.message); }
  };

  if (!remix || !tailor) return <div className="p-8 text-gray-400">Choose a design and tailor first.</div>;
  return <form className="order-brief-page" onSubmit={submit}>
    <header><span className="dori-kicker">Order details</span><h2>Make it yours</h2><p>Choose a shop option and enter measurements for {garment?.name || originalGarment}. You can revise your measurements any time.</p></header>
    {error && <div className="shop-error" role="alert">{error}</div>}
    <div className="order-brief-grid">
      <section className="shop-panel"><h3><Ruler /> Garment and fit</h3>
        <label>Shop garment<select value={garmentId} onChange={(e) => { setGarmentId(e.target.value); setProfileId(''); setMeasurements({}); }}><option value="">Use post garment: {originalGarment}</option>{garments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {garments.length === 0 && <p className="order-hint">This shop hasn’t added garment options yet; using the post’s garment type.</p>}
        {fabrics.length > 0 && <label>Available fabric<select value={fabricId} onChange={(e) => setFabricId(e.target.value)}><option value="">No preference</option>{fabrics.map((item) => <option value={item.id} key={item.id}>{item.name}{item.color ? ` · ${item.color}` : ''}{item.image_url ? ' · sample available' : ''}</option>)}</select></label>}
        {selectedFabric?.image_url && <img className="brief-fabric-preview" src={selectedFabric.image_url} alt={`${selectedFabric.name} fabric sample`} />}
        <div className="shop-form-row"><label>Gender / fit profile<select value={fit} onChange={(e) => { setFit(e.target.value); setProfileId(''); setMeasurements({}); }}><option value="mens">Male</option><option value="womens">Female</option><option value="custom">Custom / other</option></select></label><label>Unit<select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="in">Inches</option><option value="cm">Centimeters</option></select></label></div>
        <label>Saved measurements<select value={profileId} onChange={(e) => { const id = e.target.value; setProfileId(id); const saved = profiles.find((item) => item.id === id); if (saved) { setFit(saved.fit_template); setUnit(saved.unit); setMeasurements(Object.fromEntries(Object.entries(saved.measurements || {}).map(([key, value]) => [key, String(value)]))); } else setMeasurements({}); }}><option value="">Enter measurements now</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <p className="order-hint">{profileId ? 'Prefilled from your saved profile — edit any value below to override it for this order.' : 'Enter your measurements below, or pick a saved profile above to prefill them.'}</p>
        <div className="measurement-fields">{fields.map(([key, label]) => <label key={key}>{label} ({unit})<input type="number" min="1" max="500" step="0.1" value={measurements[key] || ''} onChange={(e) => { setMeasurements((prev) => ({ ...prev, [key]: e.target.value })); if (profileId) setProfileId(''); }} required={!profileId} /></label>)}</div>
        <button type="button" className="measurement-capture-open" onClick={() => setCaptureOpen(true)}><ScanLine size={16} /> Measure with camera or photo</button>
        <button type="button" className="brief-save-measurements" onClick={saveCurrent}>{profileId ? 'Update saved measurements' : 'Save these measurements'}</button>
      </section>
      <section className="shop-panel"><h3><ShieldCheck /> Send request</h3><label>Note for the tailor<textarea maxLength="2000" rows="5" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="Fit preferences, delivery questions, or any detail to discuss…" /></label><label>Phone number (optional)<input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Only shared with this order’s tailor" /></label>
        <div className="order-summary"><div><span>Design</span><strong>{post?.title || 'Remixed design'}</strong></div><div><span>Tailor</span><strong>{tailor.name}</strong></div><div><span>Starting price</span><strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: post?.currency || 'INR' }).format(Number(post?.starting_price_minor ?? ((post?.price_reference || 0) * 100)) / 100)}</strong></div><p>The tailor will confirm the final price with you in order messages before you pay.</p></div>
        <button disabled={busy} className="brief-submit">{busy ? 'Sending request…' : 'Request this garment'} <ArrowRight size={17} /></button>
      </section>
    </div>
    {captureOpen && <MeasurementCapture fields={fields} unit={unit} onClose={() => setCaptureOpen(false)} onApply={(values) => { setMeasurements(values); setProfileId(''); setCaptureOpen(false); }} />}
  </form>;
}
