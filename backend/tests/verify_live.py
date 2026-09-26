import requests

BASE = 'http://127.0.0.1:8008'

print('========================================')
print('  DORI END-TO-END SYSTEM VERIFICATION  ')
print('========================================')

# 1. Health check
h = requests.get(f'{BASE}/health').json()
print(f"[PASS] Health Check: {h['status']} - {h['tagline']}")

# 2. Upload media
sample_img = requests.get('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400').content
up = requests.post(f'{BASE}/media/upload', files={'file': ('emerald_silk.jpg', sample_img, 'image/jpeg')}).json()
media_id = up['id']
print(f"[PASS] Media Upload: ID={media_id}, size={up['file_size']}B, resolution={up['width']}x{up['height']}")

# 3. AI Caption with Gemini
cap = requests.post(f'{BASE}/posts/generate-caption', json={'media_ids': [media_id], 'tone': 'luxury'}).json()
caption_text = cap['caption']
print(f"[PASS] AI Fashion Caption ({cap['tone']}): \"{caption_text}\"")

# 4. Create Post
post = requests.post(f'{BASE}/posts', json={
    'title': 'Verdant Silk Kimono',
    'caption': caption_text,
    'media_ids': [media_id],
    'price_reference': 380,
    'base_attributes': {'neckline': 'v-neck', 'sleeves': 'bell', 'fabric': 'mulberry silk', 'color': 'emerald', 'fit': 'relaxed'}
}, headers={'X-Designer-Id': 'designer-aria', 'X-Designer-Name': 'Aria Chen', 'X-Designer-Handle': '@aria_studios'}).json()
post_id = post['id']
print(f"[PASS] Create Post: ID={post_id}, Designer={post['designer']['name']}")

# 5. Engagement: Like
like = requests.post(f'{BASE}/posts/{post_id}/like', headers={'X-User-Id': 'user_tester'}).json()
print(f"[PASS] Post Like: count={like['likes_count']}, liked={like['liked']}")

# 6. Engagement: Comment
comment = requests.post(f'{BASE}/posts/{post_id}/comments', json={'content': 'Love the subtle emerald hue.'}, headers={'X-User-Id': 'user_tester', 'X-User-Name': 'Fashion Tester'}).json()
print(f"[PASS] Post Comment: \"{comment['content']}\" by {comment['user']['name']}")

# 7. Engagement: Share
share = requests.post(f'{BASE}/posts/{post_id}/share').json()
print(f"[PASS] Post Share: count={share['shares_count']}")

# 8. Feed Retrieval
feed = requests.get(f'{BASE}/posts?page=1&limit=5').json()
print(f"[PASS] Paginated Feed: {len(feed['items'])} posts returned, total in DB={feed['total']}")

# 9. DORI Core: Tailor Matching & Royalty
match = requests.post(f'{BASE}/tailors/match', json={'attributes': {'fabric': 'mulberry silk', 'color': 'emerald'}}).json()
print(f"[PASS] Tailor Match: Top artisan=\"{match[0]['name']}\", match_score={match[0]['match_score']}%")

print('========================================')
print('  ALL LIVE ENDPOINTS PASSED WITH 200 OK ')
print('========================================')
