import React, { useEffect, useState } from 'react';
import { Plus, Scissors, SwatchBook, ImagePlus } from 'lucide-react';
import { fetchMyCatalog, saveFabric, saveGarmentType, updateFabric, updateGarmentType, uploadImage } from '../api/client';

export default function ShopPage() {
  const [garments, setGarments] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [garment, setGarment] = useState({ name: '', category: 'upper_body', description: '' });
  const [fabric, setFabric] = useState({ name: '', composition: '', color: '', price_delta_minor: 0, currency: 'INR', image_url: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchMyCatalog().then((catalog) => { setGarments(catalog.garments || []); setFabrics(catalog.fabrics || []); }).catch((e) => setError(e.message)); }, []);

  const onFabricPhoto = async (file) => {
    if (!file) return;
    setBusy(true); setError('');
    try { const imageUrl = await uploadImage(file, 'fabrics'); setFabric((old) => ({ ...old, image_url: imageUrl })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const addGarment = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const saved = garment.id ? await updateGarmentType(garment.id, garment) : await saveGarmentType(garment); setGarments((items) => garment.id ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved]); setGarment({ name: '', category: 'upper_body', description: '' }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const addFabric = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const payload = { ...fabric, price_delta_minor: Math.round(Number(fabric.price_delta_minor || 0) * 100) }; const saved = fabric.id ? await updateFabric(fabric.id, payload) : await saveFabric(payload); setFabrics((items) => fabric.id ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved]); setFabric({ name: '', composition: '', color: '', price_delta_minor: 0, currency: 'INR', image_url: '' }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <div className="shop-page">
    <div className="shop-intro"><span className="dori-kicker">Your professional shop</span><h2>Manage what customers can choose.</h2><p>Add garment types and fabric options. Fabric photos and any added price appear in the customer’s Remix order flow.</p></div>
    {error && <div className="shop-error" role="alert">{error}</div>}
    <div className="shop-columns">
      <section className="shop-panel"><h3><Scissors /> Garment types</h3><form onSubmit={addGarment}>
        <label>Garment name<input required maxLength="80" value={garment.name} onChange={(e) => setGarment({ ...garment, name: e.target.value })} placeholder="e.g. Relaxed linen shirt" /></label>
        <label>Category<select value={garment.category} onChange={(e) => setGarment({ ...garment, category: e.target.value })}><option value="upper_body">Upper body</option><option value="lower_body">Lower body</option><option value="full_body">Full body</option><option value="accessory">Accessory</option><option value="custom">Custom</option></select></label>
        <label>Details<textarea maxLength="500" value={garment.description} onChange={(e) => setGarment({ ...garment, description: e.target.value })} placeholder="Fit, tailoring notes, available sizes…" /></label>
        <button disabled={busy}><Plus size={16} /> {garment.id ? 'Save garment' : 'Add garment'}</button>{garment.id && <button type="button" className="shop-cancel-edit" onClick={() => setGarment({ name: '', category: 'upper_body', description: '' })}>Cancel edit</button>}
      </form><ul className="shop-list">{garments.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.category.replace('_', ' ')}</span><button type="button" onClick={() => setGarment({ id: item.id, name: item.name, category: item.category, description: item.description || '', active: item.active })}>Edit</button></li>)}</ul></section>
      <section className="shop-panel"><h3><SwatchBook /> Fabrics & materials</h3><form onSubmit={addFabric}>
        <label>Fabric name<input required maxLength="100" value={fabric.name} onChange={(e) => setFabric({ ...fabric, name: e.target.value })} placeholder="e.g. Chanderi silk" /></label>
        <div className="shop-form-row"><label>Composition<input value={fabric.composition} onChange={(e) => setFabric({ ...fabric, composition: e.target.value })} placeholder="Silk blend" /></label><label>Color<input value={fabric.color} onChange={(e) => setFabric({ ...fabric, color: e.target.value })} placeholder="Midnight blue" /></label></div>
        <label>Extra cost (₹)<input type="number" min="0" step="0.01" value={fabric.price_delta_minor} onChange={(e) => setFabric({ ...fabric, price_delta_minor: e.target.value })} /></label>
        <label className="shop-photo">{fabric.image_url ? <img src={fabric.image_url} alt="Fabric sample preview" /> : <ImagePlus />}<span>{fabric.image_url ? 'Fabric sample uploaded' : 'Upload fabric sample photo'}</span><input type="file" accept="image/*" onChange={(e) => onFabricPhoto(e.target.files?.[0])} /></label>
        <button disabled={busy}><Plus size={16} /> {fabric.id ? 'Save fabric' : 'Add fabric'}</button>{fabric.id && <button type="button" className="shop-cancel-edit" onClick={() => setFabric({ name: '', composition: '', color: '', price_delta_minor: 0, currency: 'INR', image_url: '' })}>Cancel edit</button>}
      </form><ul className="shop-list">{fabrics.map((item) => <li key={item.id}>{item.image_url && <img src={item.image_url} alt="" />}<strong>{item.name}</strong><span>{item.color} · {item.composition}</span><b>{item.currency} {(item.price_delta_minor / 100).toFixed(2)} extra</b><button type="button" onClick={() => setFabric({ id: item.id, name: item.name, composition: item.composition || '', color: item.color || '', price_delta_minor: item.price_delta_minor / 100, currency: item.currency || 'INR', image_url: item.image_url || '', description: item.description || '', available_quantity: item.available_quantity, active: item.active })}>Edit</button></li>)}</ul></section>
    </div>
  </div>;
}
