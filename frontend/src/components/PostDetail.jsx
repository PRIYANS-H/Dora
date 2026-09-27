import React, { useEffect, useRef, useState } from 'react';
import { Heart, Link2, Mail, MessageCircle, Send, Share2, Sparkles } from 'lucide-react';
import { addComment, fetchComments, fetchEngagement, likePost, unlikePost } from '../api/client';
import { swatchFor, fabricTexture } from '../utils/attributes';
import { postPrice, timeAgo, compactNumber } from '../utils/time';
import { toast } from '../utils/toast';
import Avatar from './Avatar';
import Modal from './Modal';

const SPEC_KEYS = ['neckline', 'sleeves', 'fabric', 'color', 'fit'];

function ShareMenu({ post, onClose }) {
  const url = `${window.location.origin}/app/?post=${encodeURIComponent(post.id)}`;
  const text = `${post.title} on DORI`;
  const menuRef = useRef(null);

  useEffect(() => {
    const onDown = (event) => { if (!menuRef.current?.contains(event.target)) onClose(); };
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener('pointerdown', onDown); };
  }, [onClose]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { toast('Couldn’t copy — long-press the address bar instead', 'bad'); }
    onClose();
  };
  const external = (href) => { window.open(href, '_blank', 'noopener,noreferrer'); onClose(); };
  const native = async () => {
    onClose();
    try { await navigator.share({ title: post.title, text, url }); }
    catch (error) { if (error.name !== 'AbortError') toast('Sharing isn’t available here', 'bad'); }
  };

  return (
    <div ref={menuRef} className="share-menu glass" role="menu">
      <button type="button" role="menuitem" onClick={copy}><span><Link2 /></span>Copy link</button>
      <button type="button" role="menuitem" onClick={() => external(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`)}><span className="is-wa">W</span>WhatsApp</button>
      <button type="button" role="menuitem" onClick={() => external(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)}><span className="is-x">𝕏</span>Post on X</button>
      <button type="button" role="menuitem" onClick={() => external(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`)}><span><Mail /></span>Email</button>
      {typeof navigator.share === 'function' && <button type="button" role="menuitem" onClick={native}><span><Share2 /></span>More options…</button>}
    </div>
  );
}

export default function PostDetail({ post, viewer, onClose, onRemix }) {
  const [engagement, setEngagement] = useState(null);
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const likeSeq = useRef(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchEngagement(post.id).then((stats) => { if (active) setEngagement(stats); }).catch(() => { if (active) setEngagement({}); });
    fetchComments(post.id).then((rows) => { if (active) setComments(rows); }).catch(() => { if (active) setComments([]); });
    return () => { active = false; };
  }, [post.id]);

  const liked = Boolean(engagement?.liked);
  const likeCount = engagement?.like_count ?? 0;
  const commentCount = engagement?.comment_count ?? comments?.length ?? 0;

  // Optimistic: the heart flips instantly; the server call settles in the background.
  const toggleLike = async () => {
    const wasLiked = liked;
    const seq = ++likeSeq.current;
    setEngagement((current) => ({ ...current, liked: !wasLiked, like_count: Math.max(0, (current?.like_count || 0) + (wasLiked ? -1 : 1)) }));
    if (!wasLiked) setBurst((value) => value + 1);
    try {
      const next = wasLiked ? await unlikePost(post.id) : await likePost(post.id);
      if (seq === likeSeq.current && next) setEngagement((current) => ({ ...current, ...next }));
    } catch (error) {
      if (seq !== likeSeq.current) return;
      setEngagement((current) => ({ ...current, liked: wasLiked, like_count: Math.max(0, (current?.like_count || 0) + (wasLiked ? 1 : -1)) }));
      toast(error.message || 'Couldn’t update your like', 'bad');
    }
  };

  const likeFromImage = () => { if (!liked) toggleLike(); else setBurst((value) => value + 1); };

  const submitComment = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const temp = { id: `tmp-${Date.now()}`, body, created_at: new Date().toISOString(), pending: true, profiles: { full_name: viewer?.full_name, username: viewer?.username, avatar_url: viewer?.avatar_url } };
    setDraft('');
    setComments((current) => [...(current || []), temp]);
    setEngagement((current) => ({ ...current, comment_count: (current?.comment_count || 0) + 1 }));
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
    try {
      const created = await addComment(post.id, body);
      setComments((current) => current.map((row) => (row.id === temp.id ? { ...temp, ...created, pending: false, profiles: created?.profiles || temp.profiles } : row)));
    } catch (error) {
      setComments((current) => current.filter((row) => row.id !== temp.id));
      setEngagement((current) => ({ ...current, comment_count: Math.max(0, (current?.comment_count || 1) - 1) }));
      setDraft(body);
      toast(error.message || 'Comment not posted', 'bad');
    }
  };

  const spec = SPEC_KEYS.filter((key) => post.base_attributes?.[key]);
  const caption = post.caption || post.base_attributes?.description;

  return (
    <Modal onClose={onClose} size="xl" labelledBy="post-detail-title" className="post-modal">
      <div className="post-modal-grid">
        <div className="post-modal-media" onDoubleClick={likeFromImage}>
          <img src={post.image_url} alt={post.title} />
          {burst > 0 && <Heart key={burst} className="post-modal-burst" fill="currentColor" aria-hidden="true" />}
        </div>

        <div className="post-modal-side">
          <header className="post-modal-head">
            <Avatar name={post.designer_name} size={40} />
            <div>
              <strong>{post.designer_name || 'DORI designer'}</strong>
              <span>{[post.designer_handle, post.garment_type].filter(Boolean).join(' · ')}</span>
            </div>
          </header>

          <div className="post-modal-scroll" ref={listRef}>
            <h2 id="post-detail-title" className="display title-md">{post.title}</h2>
            {caption && <p className="post-modal-caption">{caption}</p>}
            {spec.length > 0 && (
              <div className="post-modal-spec">
                {spec.map((key) => {
                  const value = post.base_attributes[key];
                  const dot = key === 'color' ? swatchFor(value) : key === 'fabric' ? fabricTexture(value) : null;
                  return <span className="chip" key={key}>{dot && <i className="chip-dot" style={{ background: dot }} />}<em>{key}</em> {value}</span>;
                })}
              </div>
            )}

            <div className="post-modal-comments">
              {comments === null && Array.from({ length: 3 }, (_, index) => <div key={index} className="comment-row is-skeleton"><span className="dori-skeleton" /><div><i className="dori-skeleton" /><i className="dori-skeleton" /></div></div>)}
              {comments?.length === 0 && <p className="post-modal-empty">No comments yet — start the conversation.</p>}
              {comments?.map((comment) => (
                <article key={comment.id} className={`comment-row ${comment.pending ? 'is-pending' : ''}`}>
                  <Avatar src={comment.profiles?.avatar_url} name={comment.profiles?.full_name} size={32} />
                  <div>
                    <p><strong>{comment.profiles?.full_name || comment.profiles?.username || 'DORI member'}</strong> {comment.body}</p>
                    <time dateTime={comment.created_at}>{comment.pending ? 'Posting…' : timeAgo(comment.created_at)}</time>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="post-modal-actions">
            <div className="post-modal-icons">
              <button type="button" className={`icon-action ${liked ? 'is-liked' : ''}`} onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'}>
                <Heart fill={liked ? 'currentColor' : 'none'} key={liked ? 'on' : 'off'} />
              </button>
              <button type="button" className="icon-action" onClick={() => inputRef.current?.focus()} aria-label="Comment"><MessageCircle /></button>
              <div className="share-anchor">
                <button type="button" className={`icon-action ${shareOpen ? 'is-open' : ''}`} onClick={() => setShareOpen((open) => !open)} aria-haspopup="menu" aria-expanded={shareOpen} aria-label="Share"><Send /></button>
                {shareOpen && <ShareMenu post={post} onClose={() => setShareOpen(false)} />}
              </div>
              <span className="post-modal-price">From {postPrice(post)}</span>
            </div>
            <p className="post-modal-counts">
              <strong>{engagement ? compactNumber(likeCount) : '—'}</strong> {likeCount === 1 ? 'like' : 'likes'}
              <span>·</span>
              <strong>{compactNumber(commentCount)}</strong> {commentCount === 1 ? 'comment' : 'comments'}
            </p>
            <button type="button" className="btn btn-solid btn-block" onClick={() => onRemix(post)}><Sparkles /> Remix this design</button>
          </div>

          <form className="post-modal-composer" onSubmit={submitComment}>
            <Avatar src={viewer?.avatar_url} name={viewer?.full_name} size={32} />
            <input ref={inputRef} value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Add a comment…" aria-label="Add a comment" />
            <button type="submit" disabled={!draft.trim()}>Post</button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
