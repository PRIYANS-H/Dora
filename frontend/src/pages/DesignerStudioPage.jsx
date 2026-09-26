import React, { useState, useEffect } from 'react';
import {
  uploadMedia,
  generateAICaption,
  createSocialPost,
  fetchPaginatedFeed,
  likePost,
  unlikePost,
  addPostComment,
  fetchPostComments,
  deletePostComment,
  sharePost,
  deleteSocialPost
} from '../api/client';
import {
  Sparkles,
  Upload,
  Crop,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
  Film,
  CheckCircle2,
  RefreshCw,
  Send,
  User,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ImageCropperModal from '../components/ImageCropperModal';

const TONES = [
  { id: 'creative', label: 'Creative', desc: 'Evocative & artistic' },
  { id: 'luxury', label: 'Luxury', desc: 'Atelier couture elegance' },
  { id: 'streetwear', label: 'Streetwear', desc: 'Edgy & urban' },
  { id: 'minimal', label: 'Minimal', desc: 'Understated & crisp' },
  { id: 'professional', label: 'Editorial', desc: 'Structured & refined' },
  { id: 'casual', label: 'Casual', desc: 'Effortless everyday' }
];

// Carousel Media Component for Multi-image Feed Posts
function PostCardMedia({ post }) {
  const mediaList = post.media && post.media.length > 0 ? post.media : [{ url: post.image_url, media_type: 'image' }];
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentMedia = mediaList[currentIndex] || mediaList[0];
  const hasMultiple = mediaList.length > 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? mediaList.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === mediaList.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative aspect-[4/3] bg-gray-950 overflow-hidden group select-none">
      {currentMedia.media_type === 'video' ? (
        <video src={currentMedia.url} controls className="w-full h-full object-cover" />
      ) : (
        <img
          src={currentMedia.url || 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800'}
          alt={post.title}
          className="w-full h-full object-cover"
        />
      )}

      {/* Multiple images indicator & navigation */}
      {hasMultiple && (
        <>
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm text-[10px] font-mono text-white/90 z-10 border border-white/10">
            {currentIndex + 1} / {mediaList.length}
          </div>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 border border-white/15"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 border border-white/15"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {/* Pagination dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
            {mediaList.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'bg-amber-400 w-3' : 'bg-white/40 w-1.5'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DesignerStudioPage() {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'create'
  
  // Create Post State
  const [uploadedMediaList, setUploadedMediaList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTone, setSelectedTone] = useState('creative');
  const [caption, setCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [title, setTitle] = useState('');
  const [priceRef, setPriceRef] = useState(350);
  const designerHandle = '@elena_couture';
  const designerName = 'Elena Rostova';
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null); // { current, total, fileName }
  
  // Image Crop State
  const [cropModalData, setCropModalData] = useState(null); // { imageSrc, fileName, replaceIndex?: number }

  // Feed State
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedTotal, setFeedTotal] = useState(0);
  const [feedPage, setFeedPage] = useState(1);
  const [feedSort, setFeedSort] = useState('newest');
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // Expanded comments by post ID
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  // Current demo user ID
  const currentUserId = 'user_demo';

  // Load Feed
  const loadFeed = async (page = 1, sort = feedSort) => {
    setIsLoadingFeed(true);
    try {
      const data = await fetchPaginatedFeed(page, 6, sort, null, currentUserId);
      setFeedPosts(data.items || []);
      setFeedTotal(data.total || 0);
      setFeedPage(data.page || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    loadFeed(1, feedSort);
  }, [feedSort]);

  // Handle Multi-Image and Media File Selection
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Reset input value so same files can be re-selected if desired
    e.target.value = '';

    setIsUploading(true);
    setErrorMsg('');

    try {
      const newItems = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
        const media = await uploadMedia(file);
        newItems.push(media);
      }
      setUploadedMediaList((prev) => [...prev, ...newItems]);
    } catch (err) {
      setErrorMsg(err.message || 'Error uploading selected media files.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Callback when Crop is applied
  const handleCropComplete = async (blob, croppedFile) => {
    setIsUploading(true);
    const replaceIdx = cropModalData?.replaceIndex;
    setCropModalData(null);
    setErrorMsg('');
    try {
      const media = await uploadMedia(croppedFile);
      if (replaceIdx !== null && replaceIdx !== undefined) {
        setUploadedMediaList((prev) => {
          const updated = [...prev];
          updated[replaceIdx] = media;
          return updated;
        });
      } else {
        setUploadedMediaList((prev) => [...prev, media]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error uploading cropped image.');
    } finally {
      setIsUploading(false);
    }
  };

  // Open cropper to adjust ratio and frame of any attached image by clicking on it
  const handleRecrop = (media, index) => {
    if (media.media_type === 'video') return;
    setCropModalData({
      imageSrc: media.url,
      fileName: media.file_name || `garment_${index + 1}.jpg`,
      replaceIndex: index
    });
  };

  // Handle AI Caption Generation
  const handleGenerateCaption = async () => {
    if (!uploadedMediaList.length) {
      setErrorMsg('Please upload at least one image or video first.');
      return;
    }

    setIsGeneratingCaption(true);
    setErrorMsg('');
    try {
      const mediaIds = uploadedMediaList.map((m) => m.id);
      const res = await generateAICaption(mediaIds, selectedTone);
      setCaption(res.caption);
    } catch (err) {
      setErrorMsg(err.message || 'AI Caption generation failed. Check GEMINI_API_KEY.');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  // Handle Publish Post
  const handlePublishPost = async () => {
    if (!uploadedMediaList.length) {
      setErrorMsg('Please upload at least one media item before publishing.');
      return;
    }

    setIsPublishing(true);
    setErrorMsg('');
    try {
      const payload = {
        title: title || 'Couture Design',
        caption: caption.trim() || undefined,
        media_ids: uploadedMediaList.map((m) => m.id),
        price_reference: Number(priceRef) || 250,
        base_attributes: {
          neckline: 'mandarin',
          sleeves: 'full',
          fabric: 'heavy cotton twill',
          color: 'onyx',
          fit: 'regular'
        }
      };

      const designerHeaders = {
        id: designerHandle.replace('@', 'designer-'),
        name: designerName,
        handle: designerHandle
      };

      await createSocialPost(payload, designerHeaders);
      setPublishSuccess('Design post published successfully to the social feed!');
      // Reset form
      setUploadedMediaList([]);
      setCaption('');
      setTitle('');
      // Reload feed & switch tab
      setTimeout(() => {
        setPublishSuccess(null);
        setActiveTab('feed');
        loadFeed(1, 'newest');
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to publish post.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Like / Unlike Handler
  const handleToggleLike = async (post) => {
    try {
      if (post.liked_by_current_user) {
        const res = await unlikePost(post.id, currentUserId);
        setFeedPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, liked_by_current_user: false, likes_count: res.likes_count }
              : p
          )
        );
      } else {
        const res = await likePost(post.id, currentUserId);
        setFeedPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, liked_by_current_user: true, likes_count: res.likes_count }
              : p
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Share Handler
  const handleShare = async (postId) => {
    try {
      const res = await sharePost(postId, currentUserId);
      setFeedPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, shares_count: res.shares_count } : p))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Post Handler
  const handleDeletePost = async (postId, designerId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteSocialPost(postId, designerId);
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
      setFeedTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      alert(err.message || 'Failed to delete post.');
    }
  };

  // Toggle & Load Comments
  const handleToggleComments = async (postId) => {
    const isExpanded = !expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: isExpanded }));

    if (isExpanded && !commentsMap[postId]) {
      try {
        const list = await fetchPostComments(postId);
        setCommentsMap((prev) => ({ ...prev, [postId]: list }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Add Comment Handler
  const handleAddComment = async (postId) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    try {
      const newComment = await addPostComment(postId, text, currentUserId, 'Demo User');
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [newComment, ...(prev[postId] || [])]
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
        )
      );
    } catch (err) {
      alert(err.message || 'Failed to submit comment.');
    }
  };

  // Delete Comment Handler
  const handleDeleteComment = async (postId, commentId) => {
    try {
      await deletePostComment(commentId, currentUserId);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId)
      }));
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p
        )
      );
    } catch (err) {
      alert(err.message || 'Failed to delete comment.');
    }
  };

  return (
    <div className="space-y-6 pb-16 text-left max-w-5xl mx-auto">
      {/* Studio Header Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-purple-950/60 via-gray-900 to-amber-950/40 border border-purple-800/40 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-400/10 border border-purple-400/30 text-purple-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Feature Sandbox: Designer Social Feed & Media Hub</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight m-0">
              Designer Social Feed & AI Studio
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
              Upload design media, generate fashion captions with Gemini AI, publish to the couture feed, and test engagement (likes, comments, shares).
            </p>
          </div>

          {/* Navigation Pill Switches */}
          <div className="flex items-center gap-2 bg-gray-950/80 p-1.5 rounded-2xl border border-gray-800">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              Live Feed ({feedTotal})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-amber-400 text-gray-950 shadow-lg shadow-amber-400/30 font-extrabold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              + Upload & Publish
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Notice */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white font-mono text-xs">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: CREATE & UPLOAD POST */}
      {/* ========================================================= */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Media Upload & Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2 m-0">
                <Upload className="w-4 h-4 text-amber-400" />
                1. Upload Images or Videos
              </h3>

              {/* Upload Dropzone */}
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-gray-700 hover:border-amber-400/60 rounded-2xl cursor-pointer bg-gray-950/60 transition-all group">
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
                    <Upload className="w-6 h-6 text-amber-400" />
                  </div>
                  <p className="text-xs font-semibold text-gray-200">
                    Click to browse or drop multiple fashion assets
                  </p>
                  <p className="text-[11px] text-gray-500 font-mono mt-1">
                    Select multiple images at once • JPG, PNG, WEBP, MP4
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>

              {isUploading && (
                <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl flex items-center gap-2 text-xs text-amber-300 font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>
                    {uploadProgress
                      ? `Uploading asset ${uploadProgress.current} of ${uploadProgress.total}: ${uploadProgress.fileName}...`
                      : 'Storing media assets...'}
                  </span>
                </div>
              )}

              {/* Uploaded Media Thumbnails */}
              {uploadedMediaList.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-400">
                      Attached Media ({uploadedMediaList.length}) • <span className="text-amber-400 font-semibold">Click any image to adjust ratio</span>
                    </span>
                    <button
                      onClick={() => setUploadedMediaList([])}
                      className="text-[11px] text-gray-500 hover:text-red-400 font-mono transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {uploadedMediaList.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        onClick={() => handleRecrop(m, idx)}
                        className={`relative rounded-xl overflow-hidden border border-gray-800 aspect-square bg-gray-950 group transition-all ${
                          m.media_type === 'image'
                            ? 'cursor-pointer hover:border-amber-400 hover:shadow-lg hover:shadow-amber-400/15'
                            : 'cursor-default'
                        }`}
                        title={m.media_type === 'image' ? 'Click to adjust ratio & crop' : 'Video asset'}
                      >
                        {m.media_type === 'video' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-purple-300">
                            <Film className="w-6 h-6 mb-1" />
                            <span className="text-[9px] font-mono">VIDEO</span>
                          </div>
                        ) : (
                          <img
                            src={m.url}
                            alt={`Garment ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        )}

                        {/* Top Bar: Sequence Tag & Remove Button */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-10">
                          <span className="bg-black/75 backdrop-blur-sm text-gray-300 text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10">
                            #{idx + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedMediaList((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1 rounded-full bg-red-600/90 hover:bg-red-500 text-white cursor-pointer shadow-md pointer-events-auto transition-transform hover:scale-110"
                            title="Remove asset"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Bottom Bar: Quick Adjust Ratio Button & Dimensions */}
                        {m.media_type === 'image' && (
                          <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between pointer-events-none z-10">
                            <div className="bg-black/80 backdrop-blur-sm text-amber-300 group-hover:bg-amber-400 group-hover:text-gray-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all border border-amber-400/40 group-hover:border-transparent">
                              <Crop className="w-2.5 h-2.5 stroke-[2.5]" />
                              <span>Adjust Ratio</span>
                            </div>
                            {m.width && m.height && (
                              <span className="bg-black/80 backdrop-blur-sm text-[9px] font-mono text-gray-300 px-1 py-0.5 rounded">
                                {m.width}×{m.height}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Subtle Hover Glow Layer */}
                        {m.media_type === 'image' && (
                          <div className="absolute inset-0 bg-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                            <span className="bg-gray-950/90 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-400/40 shadow-xl flex items-center gap-1 scale-90 group-hover:scale-100 transition-transform">
                              <Crop className="w-3 h-3 stroke-[2.5]" />
                              Adjust Ratio
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Caption Generator & Post Publishing */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2 m-0">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  2. AI Fashion Caption
                </h3>
                <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800 font-mono">
                  Gemini Vision
                </span>
              </div>

              {/* Tone Selection Pills */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-mono">Select Aesthetic Tone:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTone(t.id)}
                      className={`p-2 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                        selectedTone === t.id
                          ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/20'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <div>{t.label}</div>
                      <div className="text-[9px] text-gray-400 font-normal opacity-75">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Trigger Button */}
              <button
                onClick={handleGenerateCaption}
                disabled={isGeneratingCaption || !uploadedMediaList.length}
                className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingCaption ? 'animate-spin' : ''}`} />
                {isGeneratingCaption ? 'Analyzing Garment Visuals...' : 'Generate AI Caption ✨'}
              </button>

              {/* Caption Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-mono flex items-center justify-between">
                  <span>Post Caption (Review or write manually):</span>
                  <span className="text-[10px] text-gray-500">{caption.length} / 2200</span>
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe your silhouette, tailoring notes, or generate with AI above..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-400 resize-none font-sans"
                />
              </div>

              {/* Metadata Fields */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-gray-400 font-mono block mb-1">Design Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Noir Asymmetric Trench"
                    className="w-full p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-mono block mb-1">Price Reference ($)</label>
                  <input
                    type="number"
                    value={priceRef}
                    onChange={(e) => setPriceRef(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* Designer Identity */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-400">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Posting as:</span>
                <span className="text-gray-200 font-bold">{designerName}</span>
                <span className="text-gray-500 font-mono text-[11px]">({designerHandle})</span>
              </div>

              {/* Publish CTA */}
              <button
                onClick={handlePublishPost}
                disabled={isPublishing || !uploadedMediaList.length}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition-all disabled:opacity-40 cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publishing Design...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Publish Design to Feed</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {publishSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs text-center font-semibold">
                  {publishSuccess}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SOCIAL HOME FEED */}
      {/* ========================================================= */}
      {activeTab === 'feed' && (
        <div className="space-y-6">
          {/* Feed Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/50 p-3 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFeedSort('newest')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  feedSort === 'newest'
                    ? 'bg-amber-400 text-gray-950 font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Newest Posts
              </button>
              <button
                onClick={() => setFeedSort('popular')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  feedSort === 'popular'
                    ? 'bg-amber-400 text-gray-950 font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Popular
              </button>
            </div>

            <div className="text-xs text-gray-500 font-mono">
              Total Feed Items: <span className="text-amber-400 font-bold">{feedTotal}</span>
            </div>
          </div>

          {/* Feed Loading Spinner */}
          {isLoadingFeed && (
            <div className="p-12 text-center text-gray-400 font-mono text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              <span>Loading social feed...</span>
            </div>
          )}

          {/* Posts Grid */}
          {!isLoadingFeed && feedPosts.length === 0 && (
            <div className="p-12 text-center text-gray-500 font-mono text-xs bg-gray-900/30 rounded-2xl border border-gray-800">
              No designer posts published yet. Click "+ Upload & Publish" above to create your first design post!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {feedPosts.map((post) => {
              const comments = commentsMap[post.id] || [];
              const isCommentOpen = !!expandedComments[post.id];

              return (
                <div
                  key={post.id}
                  className="bg-gray-900/40 rounded-2xl border border-gray-800/80 overflow-hidden shadow-xl flex flex-col justify-between"
                >
                  {/* Post Header: Designer Profile */}
                  <div className="p-4 flex items-center justify-between border-b border-gray-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-purple-600 flex items-center justify-center text-xs font-bold text-gray-950 overflow-hidden">
                        {post.designer?.profile_image ? (
                          <img
                            src={post.designer.profile_image}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{(post.designer?.name || 'D')[0]}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-200 m-0">
                          {post.designer?.name || post.designer_name}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {post.designer?.handle || post.designer_handle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        ${post.price_reference || 250}
                      </span>
                      {/* Owner Delete Option */}
                      <button
                        onClick={() => handleDeletePost(post.id, post.designer?.id || 'designer-elena')}
                        className="text-gray-600 hover:text-red-400 p-1 transition-colors cursor-pointer"
                        title="Delete Post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Media Content with Multi-Image Carousel Support */}
                  <PostCardMedia post={post} />

                  {/* Post Body: Title & Caption */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 m-0">{post.title}</h3>
                      {post.caption && (
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed line-clamp-3">
                          {post.caption}
                        </p>
                      )}
                    </div>

                    {/* Action Bar: Like, Comment, Share */}
                    <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-xs text-gray-400 font-mono">
                      <div className="flex items-center gap-4">
                        {/* Like Button */}
                        <button
                          onClick={() => handleToggleLike(post)}
                          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                            post.liked_by_current_user ? 'text-rose-500 font-bold' : 'hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              post.liked_by_current_user ? 'fill-rose-500 stroke-none' : ''
                            }`}
                          />
                          <span>{post.likes_count || 0}</span>
                        </button>

                        {/* Comment Button */}
                        <button
                          onClick={() => handleToggleComments(post.id)}
                          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments_count || 0}</span>
                        </button>

                        {/* Share Button */}
                        <button
                          onClick={() => handleShare(post.id)}
                          className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>{post.shares_count || 0}</span>
                        </button>
                      </div>

                      <span className="text-[10px] text-gray-500">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Comments Drawer */}
                  {isCommentOpen && (
                    <div className="p-4 bg-gray-950/80 border-t border-gray-800 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          placeholder="Write a comment..."
                          className="flex-1 p-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Comments List */}
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                          <p className="text-[11px] text-gray-500 font-mono">No comments yet.</p>
                        ) : (
                          comments.map((c) => (
                            <div
                              key={c.id}
                              className="text-xs p-2 rounded-lg bg-gray-900/60 border border-gray-800/60 flex items-start justify-between gap-2"
                            >
                              <div>
                                <span className="font-bold text-gray-300 mr-2 text-[11px]">
                                  {c.user?.name || 'User'}:
                                </span>
                                <span className="text-gray-300">{c.content}</span>
                              </div>
                              {c.user?.id === currentUserId && (
                                <button
                                  onClick={() => handleDeleteComment(post.id, c.id)}
                                  className="text-gray-600 hover:text-red-400 p-0.5 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {feedTotal > 6 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => loadFeed(Math.max(1, feedPage - 1))}
                disabled={feedPage <= 1}
                className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:border-gray-600 disabled:opacity-30 cursor-pointer"
              >
                Previous Page
              </button>
              <span className="text-xs font-mono text-gray-400">
                Page {feedPage} of {Math.ceil(feedTotal / 6)}
              </span>
              <button
                onClick={() => loadFeed(feedPage + 1)}
                disabled={feedPage * 6 >= feedTotal}
                className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:border-gray-600 disabled:opacity-30 cursor-pointer"
              >
                Next Page
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interactive Image Cropper Modal */}
      {cropModalData && (
        <ImageCropperModal
          imageSrc={cropModalData.imageSrc}
          fileName={cropModalData.fileName}
          onCropComplete={handleCropComplete}
          onClose={() => setCropModalData(null)}
        />
      )}
    </div>
  );
}
