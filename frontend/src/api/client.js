const API_BASE = '/api';

// ── Global in-flight request tracker ──────────────────────────────────────
// Powers the top progress bar / transaction spinners without threading
// loading state through every page. Silent (background) requests can opt out.
let activeRequests = 0;
const activityListeners = new Set();

function notifyActivity() {
  activityListeners.forEach((listener) => listener(activeRequests));
}

export function subscribeActivity(listener) {
  activityListeners.add(listener);
  listener(activeRequests);
  return () => activityListeners.delete(listener);
}

export async function apiFetch(path, options = {}) {
  const { silent, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('custom_token') : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!silent) { activeRequests += 1; notifyActivity(); }
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
    }
    if (response.status === 204) return null;
    return response.json();
  } finally {
    if (!silent) { activeRequests -= 1; notifyActivity(); }
  }
}

export const fetchPosts = () => apiFetch('/posts');
export const createPost = (post) => apiFetch('/posts', { method: 'POST', body: JSON.stringify(post) });
export const generateCaption = (payload) => apiFetch('/posts/generate-caption', { method: 'POST', body: JSON.stringify(payload) });
export const fetchPostById = (id) => apiFetch(`/posts/${encodeURIComponent(id)}`);
export const createRemix = (postId, attributes, options = {}) => apiFetch('/remix', { method: 'POST', body: JSON.stringify({ post_id: postId, attributes, ...options }) });
export const matchTailors = (attributes, lat = 37.7749, lng = -122.4194) => apiFetch('/tailors/match', { method: 'POST', body: JSON.stringify({ attributes, lat, lng }) });
export const fetchTailors = () => apiFetch('/tailors');
export const sendCollabInvite = (tailorId, postId, attributes) => apiFetch(`/tailors/${encodeURIComponent(tailorId)}/collab-invite`, { method: 'POST', body: JSON.stringify({ post_id: postId, attributes }) });
export const createOrder = (remixId, tailorId, measurements, details = {}) => apiFetch('/orders', { method: 'POST', body: JSON.stringify({ remix_id: remixId, tailor_id: tailorId, measurements, ...details }) });
export const fetchOrders = (role = 'all', opts = {}) => apiFetch(`/orders?role=${encodeURIComponent(role)}`, { silent: opts.silent });
export const fetchOrderById = (id) => apiFetch(`/orders/${encodeURIComponent(id)}`);
export const updateOrderStatus = (id, status) => apiFetch(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const fetchOrderReceipt = (id) => apiFetch(`/orders/${encodeURIComponent(id)}/receipt`);

export const fetchProfiles = (query = '') => apiFetch(`/profiles${query ? `?q=${encodeURIComponent(query)}` : ''}`);
export const fetchProfile = (username) => apiFetch(`/profiles/${encodeURIComponent(username)}`);
export const fetchMyProfile = () => apiFetch('/profiles/me');
export const createMyProfile = (profile) => apiFetch('/profiles/me', { method: 'POST', body: JSON.stringify(profile) });
export const updateMyProfile = (profile) => apiFetch('/profiles/me', { method: 'PATCH', body: JSON.stringify(profile) });
export const checkUsername = (username) => apiFetch(`/profiles/username-available?username=${encodeURIComponent(username)}`);
export const followProfile = (username) => apiFetch(`/profiles/${encodeURIComponent(username)}/follow`, { method: 'PUT', silent: true });
export const unfollowProfile = (username) => apiFetch(`/profiles/${encodeURIComponent(username)}/follow`, { method: 'DELETE', silent: true });
export const getFollowState = (username) => apiFetch(`/profiles/${encodeURIComponent(username)}/follow`, { silent: true });

export const fetchCatalog = (tailorId) => apiFetch(`/tailors/${encodeURIComponent(tailorId)}/catalog`);
export const fetchMyCatalog = () => apiFetch('/catalog/me');
export const saveGarmentType = (data) => apiFetch('/catalog/garments', { method: 'POST', body: JSON.stringify(data) });
export const updateGarmentType = (id, data) => apiFetch(`/catalog/garments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const saveFabric = (data) => apiFetch('/catalog/fabrics', { method: 'POST', body: JSON.stringify(data) });
export const updateFabric = (id, data) => apiFetch(`/catalog/fabrics/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const assignPostFabric = (postId, fabricId) => apiFetch(`/posts/${encodeURIComponent(postId)}/fabrics`, { method: 'PUT', body: JSON.stringify({ fabric_id: fabricId }) });

export async function uploadImage(file, asset = 'posts') {
  const signature = await apiFetch(`/media/signature?asset=${encodeURIComponent(asset)}`);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.api_key);
  form.append('timestamp', signature.timestamp);
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`, { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Image upload failed.');
  return result.secure_url;
}

export const fetchEngagement = (postId) => apiFetch(`/posts/${encodeURIComponent(postId)}/engagement`, { silent: true });
export const likePost = (postId) => apiFetch(`/posts/${encodeURIComponent(postId)}/like`, { method: 'PUT', silent: true });
export const unlikePost = (postId) => apiFetch(`/posts/${encodeURIComponent(postId)}/like`, { method: 'DELETE', silent: true });
export const fetchComments = (postId) => apiFetch(`/posts/${encodeURIComponent(postId)}/comments`, { silent: true });
export const addComment = (postId, body, parentId = null) => apiFetch(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body, parent_id: parentId }), silent: true });

export const fetchMeasurementProfiles = () => apiFetch('/measurements');
export const saveMeasurementProfile = (data) => apiFetch('/measurements', { method: 'POST', body: JSON.stringify(data) });
export const updateMeasurementProfile = (id, data) => apiFetch(`/measurements/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteMeasurementProfile = (id) => apiFetch(`/measurements/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const fetchOrderMessages = (orderId, opts = {}) => apiFetch(`/orders/${encodeURIComponent(orderId)}/messages`, { silent: opts.silent });
export const sendOrderMessage = (orderId, body) => apiFetch(`/orders/${encodeURIComponent(orderId)}/messages`, { method: 'POST', body: JSON.stringify({ body }), silent: true });
export const sendOrderQuote = (orderId, quote) => apiFetch(`/orders/${encodeURIComponent(orderId)}/quotes`, { method: 'POST', body: JSON.stringify(quote) });
export const approveOrderRequest = (orderId) => apiFetch(`/orders/${encodeURIComponent(orderId)}/approve`, { method: 'POST' });
export const acceptOrderQuote = (orderId, quoteId) => apiFetch(`/orders/${encodeURIComponent(orderId)}/quotes/${encodeURIComponent(quoteId)}/accept`, { method: 'POST' });
export const createCheckout = (orderId) => apiFetch(`/orders/${encodeURIComponent(orderId)}/checkout`, { method: 'POST' });
export const verifyRazorpayPayment = (orderId, payload) => apiFetch(`/orders/${encodeURIComponent(orderId)}/payments/verify`, { method: 'POST', body: JSON.stringify(payload) });
export const fetchRazorpaySettings = () => apiFetch('/settings/razorpay');
export const saveRazorpaySettings = (settings) => apiFetch('/settings/razorpay', { method: 'PUT', body: JSON.stringify(settings) });
export const disableRazorpaySettings = () => apiFetch('/settings/razorpay', { method: 'DELETE' });
export const fetchNotifications = (opts = {}) => apiFetch('/notifications', { silent: opts.silent });
export const markNotificationRead = (id) => apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });

// Virtual try-on (IDM-VTON) and photo-to-3D (Tripo) run as backend jobs; poll until done.
export const startTryOn = (payload) => apiFetch('/tryon', { method: 'POST', body: JSON.stringify(payload) });
export const fetchTryOn = (jobId) => apiFetch(`/tryon/${encodeURIComponent(jobId)}`, { silent: true });
export const fetchModelStatus = () => apiFetch('/models3d/status', { silent: true });
export const startModel3D = (imageUrl) => apiFetch('/models3d', { method: 'POST', body: JSON.stringify({ image_url: imageUrl }) });
export const fetchModel3D = (taskId) => apiFetch(`/models3d/${encodeURIComponent(taskId)}`, { silent: true });
