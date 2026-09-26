import { fetchPosts } from '../api/client';

let cached = null;
let fetchedAt = 0;

// Shared, short-lived copy of the feed for pickers and reference photos.
export function getPosts(maxAgeMs = 60000) {
  if (!cached || Date.now() - fetchedAt > maxAgeMs) {
    fetchedAt = Date.now();
    cached = fetchPosts().catch((error) => { cached = null; throw error; });
  }
  return cached;
}
