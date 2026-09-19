const API_BASE = '/api';

export async function fetchPosts() {
  const res = await fetch(`${API_BASE}/posts`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export async function fetchPostById(id) {
  const res = await fetch(`${API_BASE}/posts/${id}`);
  if (!res.ok) throw new Error('Failed to fetch post');
  return res.json();
}

export async function createRemix(postId, attributes) {
  const res = await fetch(`${API_BASE}/remix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId, attributes })
  });
  if (!res.ok) throw new Error('Failed to generate remix');
  return res.json();
}

export async function matchTailors(attributes, lat = 37.7749, lng = -122.4194) {
  const res = await fetch(`${API_BASE}/tailors/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attributes, lat, lng })
  });
  if (!res.ok) throw new Error('Failed to match tailors');
  return res.json();
}

export async function createOrder(remixId, tailorId, measurements) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      remix_id: remixId,
      tailor_id: tailorId,
      measurements
    })
  });
  if (!res.ok) throw new Error('Failed to create order');
  return res.json();
}

export async function fetchOrders() {
  const res = await fetch(`${API_BASE}/orders`);
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

export async function fetchOrderById(id) {
  const res = await fetch(`${API_BASE}/orders/${id}`);
  if (!res.ok) throw new Error('Failed to fetch order');
  return res.json();
}

export async function updateOrderStatus(id, status) {
  const res = await fetch(`${API_BASE}/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function fetchOrderReceipt(id) {
  const res = await fetch(`${API_BASE}/orders/${id}/receipt`);
  if (!res.ok) throw new Error('Failed to fetch receipt');
  return res.json();
}
