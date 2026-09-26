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

// ==========================================
// Designer Social Feed, Media & AI Endpoints
// ==========================================

export async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to upload media file');
  }
  return res.json();
}

export async function generateAICaption(mediaIds, tone = 'creative') {
  const res = await fetch(`${API_BASE}/posts/generate-caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_ids: mediaIds, tone })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate AI caption');
  }
  return res.json();
}

export async function createSocialPost(payload, designerHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Designer-Id': designerHeaders.id || 'designer-elena',
    'X-Designer-Name': designerHeaders.name || 'Elena Rostova',
    'X-Designer-Handle': designerHeaders.handle || '@elena_couture'
  };
  const res = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create post');
  }
  return res.json();
}

export async function fetchPaginatedFeed(page = 1, limit = 10, sort = 'newest', designer = null, userId = 'user_demo') {
  let url = `${API_BASE}/posts?page=${page}&limit=${limit}&sort=${sort}`;
  if (designer) url += `&designer=${encodeURIComponent(designer)}`;
  const headers = {};
  if (userId) headers['X-User-Id'] = userId;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch social feed');
  return res.json();
}

export async function likePost(postId, userId = 'user_demo') {
  const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
    method: 'POST',
    headers: { 'X-User-Id': userId }
  });
  if (!res.ok) throw new Error('Failed to like post');
  return res.json();
}

export async function unlikePost(postId, userId = 'user_demo') {
  const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId }
  });
  if (!res.ok) throw new Error('Failed to unlike post');
  return res.json();
}

export async function addPostComment(postId, content, userId = 'user_demo', userName = 'Fashion Lover') {
  const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
      'X-User-Name': userName
    },
    body: JSON.stringify({ content })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to post comment');
  }
  return res.json();
}

export async function fetchPostComments(postId) {
  const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function deletePostComment(commentId, userId = 'user_demo') {
  const res = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId }
  });
  if (!res.ok) throw new Error('Failed to delete comment');
  return res.json();
}

export async function sharePost(postId, userId = 'user_demo') {
  const res = await fetch(`${API_BASE}/posts/${postId}/share`, {
    method: 'POST',
    headers: { 'X-User-Id': userId }
  });
  if (!res.ok) throw new Error('Failed to share post');
  return res.json();
}

export async function deleteSocialPost(postId, designerId = 'designer-elena') {
  const res = await fetch(`${API_BASE}/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'X-Designer-Id': designerId }
  });
  if (!res.ok) throw new Error('Failed to delete post');
  return res.json();
}

// ==========================================
// 3D Virtual Try-On Endpoints
// ==========================================

export async function fetchTryonHealth() {
  const res = await fetch(`${API_BASE}/virtual-tryon/health`);
  if (!res.ok) throw new Error('Failed to fetch 3D try-on health');
  return res.json();
}

export async function generateVirtualTryon(payload) {
  const res = await fetch(`${API_BASE}/virtual-tryon/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to generate 3D virtual try-on');
  }
  return res.json();
}

export async function fetchTryonJob(jobId) {
  const res = await fetch(`${API_BASE}/virtual-tryon/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch 3D job');
  return res.json();
}

export function getGlbModelDownloadUrl(jobId) {
  return `${API_BASE}/virtual-tryon/${jobId}/model`;
}

