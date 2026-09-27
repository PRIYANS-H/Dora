// TEMPORARY visual-QA harness — delete before shipping. Fakes a signed-in
// session locally; public reads go to the real local backend without auth.
const params = new URLSearchParams(window.location.search);
const pro = params.get('pro') === '1';
const step = params.get('step');
if (step) window.history.replaceState(null, '', `/app/${step}${window.location.search}`);
// click=<selector> (repeatable) clicks elements in order once the page settles.
params.getAll('click').forEach((selector, index) => {
  window.setTimeout(() => {
    const [css, nth] = selector.split('@');
    const matches = document.querySelectorAll(css);
    const target = matches[Number(nth) || 0];
    if (target) { target.scrollIntoView({ block: 'center' }); target.click(); }
  }, Number(params.get('wait') || 2500) + index * 1400);
});
const me = {
  id: 'me-profile', username: 'aria', full_name: 'Aria Mehta', email: 'aria@example.test',
  bio: 'Wearing slow fashion, one remix at a time.', avatar_url: '', is_professional: pro,
  followers_count: 1284, following_count: 312,
};
localStorage.setItem('custom_token', 'preview-harness');
localStorage.setItem('custom_user', JSON.stringify({ id: 'me-user', email: me.email }));
localStorage.setItem('dori_profile', JSON.stringify(me));

const realFetch = window.fetch.bind(window);
const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

let postsCache = null;
async function posts() {
  if (!postsCache) postsCache = await realFetch('/api/posts').then((r) => r.json()).catch(() => []);
  return postsCache;
}

async function orders() {
  const list = await posts();
  const pick = (i) => list[i % Math.max(1, list.length)] || {};
  const make = (id, i, status, tailorName, quotes = []) => ({
    id, status, created_at: minutesAgo(60 * 24 * (i + 1)), updated_at: minutesAgo(30 * (i + 1)), currency: 'INR',
    customer_profile_id: me.id, customer_name: me.full_name, measurements: { chest: 38, waist: 32, shoulder: 17.5, sleeve: 24, unit: 'in', fit_template: 'mens' },
    post: { id: pick(i).id, title: pick(i).title, image_url: pick(i).image_url, currency: 'INR', starting_price_minor: 450000 },
    remix: { id: `rx-${id}`, remixed_image_url: pick(i).image_url, attributes: pick(i).base_attributes || {} },
    tailor: { id: `t-${id}`, name: tailorName, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', profile_id: 'tailor-profile' },
    spec_snapshot: { garment_type: pick(i).garment_type || 'Jacket', fabric: { name: 'Chanderi silk', color: 'Sapphire', composition: 'Silk-cotton' } },
    quotes, quoted_total_minor: quotes[0]?.amount_minor,
  });
  return [
    make('ord-7f21c9a0', 6, 'negotiating', 'Master Mateo Rossi', [{ id: 'q1', status: 'proposed', amount_minor: 1250000, currency: 'INR', message: 'Includes hand-finished mandarin collar and lining.', created_at: minutesAgo(40), revision: 1 }]),
    make('ord-19be44d2', 9, 'stitching', 'Ananya Sharma Couture Studio', [{ id: 'q2', status: 'accepted', amount_minor: 890000, currency: 'INR', message: 'Final price after fabric swap.', created_at: minutesAgo(3000), revision: 2 }]),
    make('ord-c03a8b17', 2, 'placed', 'Kenji Watanabe Atelier'),
  ];
}

const messages = [
  { id: 'm1', sender_profile_id: 'tailor-profile', body: 'I approve your order request. Let’s confirm the final details and price here.', created_at: minutesAgo(60 * 26), profiles: { full_name: 'Master Mateo Rossi' } },
  { id: 'm2', sender_profile_id: me.id, body: 'Amazing! Could the collar be a touch softer than the original?', created_at: minutesAgo(60 * 25.5), profiles: { full_name: me.full_name } },
  { id: 'm3', sender_profile_id: 'tailor-profile', body: 'Yes — I’ll interface it lightly so it keeps shape without feeling stiff.', created_at: minutesAgo(62), profiles: { full_name: 'Master Mateo Rossi' } },
  { id: 'm4', sender_profile_id: 'tailor-profile', body: 'Sent you a price proposal just now.', created_at: minutesAgo(41), profiles: { full_name: 'Master Mateo Rossi' } },
  { id: 'm5', sender_profile_id: me.id, body: 'Looks good, reviewing it now 🙌', created_at: minutesAgo(5), profiles: { full_name: me.full_name } },
];

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
  const path = url.pathname.replace(/^\/api/, '');
  const method = (init.method || 'GET').toUpperCase();

  if (path === '/profiles/me') return json(me);
  if (path === '/notifications') return json([
    { id: 'n1', kind: 'order_quote', title: 'New price proposal', body: 'Master Mateo Rossi proposed ₹12,500 for your Mandarin Trench remix.', href: '/app/messages', created_at: minutesAgo(40) },
    { id: 'n2', kind: 'order_message', title: 'New message', body: 'Yes — I’ll interface it lightly so it keeps shape.', href: '/app/messages', created_at: minutesAgo(62) },
    { id: 'n3', kind: 'order_status', title: 'Order update', body: 'Your order is now stitching.', href: '/app/orders', created_at: minutesAgo(60 * 20), read_at: minutesAgo(60) },
    { id: 'n4', kind: 'order_approved', title: 'Tailor approved your request', body: 'Continue the discussion in Messages.', href: '/app/messages', created_at: minutesAgo(60 * 26), read_at: minutesAgo(60) },
  ]);
  if (/^\/notifications\/.+\/read$/.test(path)) return json({ ok: true });
  if (path === '/orders') return json(await orders());
  if (/^\/orders\/[^/]+$/.test(path)) return json((await orders()).find((o) => path.endsWith(o.id)) || (await orders())[0]);
  if (/^\/orders\/[^/]+\/messages$/.test(path)) {
    if (method === 'POST') { const body = JSON.parse(init.body).body; return json({ id: `m${Date.now()}`, sender_profile_id: me.id, body, created_at: new Date().toISOString(), profiles: { full_name: me.full_name } }, 201); }
    return json(path.includes('ord-7f21c9a0') ? messages : messages.slice(0, 2));
  }
  if (/^\/orders\/[^/]+\/receipt$/.test(path)) return json({ price_reference: 12500, tailor_amount: 8750, designer_amount: 1875, platform_amount: 1875 });
  if (/^\/posts\/[^/]+\/engagement$/.test(path)) return json({ liked: false, like_count: 248, comment_count: 2 });
  if (/^\/posts\/[^/]+\/comments$/.test(path)) {
    if (method === 'POST') return json({ id: `c${Date.now()}`, body: JSON.parse(init.body).body, created_at: new Date().toISOString() }, 201);
    return json([
      { id: 'c1', body: 'The drape on this is unreal. Would love it in emerald.', created_at: minutesAgo(180), profiles: { full_name: 'Kabir Sethi' } },
      { id: 'c2', body: 'Remixed it with a V-neck — tailor quoted in a day!', created_at: minutesAgo(35), profiles: { full_name: 'Meera Iyer' } },
    ]);
  }
  if (/^\/posts\/[^/]+\/like$/.test(path)) { await new Promise((r) => setTimeout(r, 700)); return json({ liked: method === 'PUT', like_count: method === 'PUT' ? 249 : 248 }); }
  if (/^\/profiles\/[^/]+\/follow$/.test(path)) { if (method === 'GET') return json({ following: false }); await new Promise((r) => setTimeout(r, 500)); return json({ following: method === 'PUT' }); }
  if (path === '/measurements') return json([]);
  if (path === '/remix' && method === 'POST') {
    const body = JSON.parse(init.body); const post = (await posts()).find((p) => p.id === body.post_id);
    await new Promise((r) => setTimeout(r, 1800));
    return json({ id: 'remix-preview', post_id: body.post_id, attributes: body.attributes, remixed_image_url: post?.image_url });
  }
  if (path === '/catalog/me') return json({ garments: [], fabrics: [] });
  if (path.startsWith('/settings/')) return json({});

  // Public reads go to the real backend, without the fake token.
  if (method === 'GET' || path === '/tailors/match') {
    const headers = new Headers(init.headers || {});
    headers.delete('Authorization');
    return realFetch(`/api${path}${url.search}`, { ...init, headers });
  }
  return json({ ok: true });
};
