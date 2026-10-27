// Phase 20: video pipeline — readiness validation.
//
// Before this phase, video problems surfaced only at
// publish time, per platform, one failure at a time:
// YouTube needs a video, TikTok needs a video, X
// rejects a second video, Pinterest has no video flow
// at all. The pipeline checks the whole post up
// front — at creation and on demand — and reports
// per-platform readiness before anything is scheduled
// or published.
//
// Rules come only from behavior already in this
// codebase (the platform posting paths), never from
// assumed limits:
// - youtube: ready when at least one video URL is
//   attached (the uploader uses the first video URL).
// - tiktok: same — ready when at least one video URL
//   is attached (direct post uses the first video URL).
// - twitter/x: blocked when more than one video is
//   attached (existing rule: one video per post).
// - pinterest: blocked for video (existing rule: the
//   video-pin upload flow is not implemented).
// - every other platform (facebook, instagram,
//   linkedin, reddit, custom_*): 'unchecked' — the
//   pipeline does not claim readiness it has not
//   verified, and does not block on an unverified
//   guess either. A post is ready when nothing is
//   blocked.
//
// What this is NOT: rendering or transcoding. No
// ffmpeg runs here, no video is assembled from a
// script, no duration or size is measured — those
// need a media pipeline that does not exist in this
// codebase yet. The pipeline validates what the
// post carries against what each platform path can
// actually take.
const { isVideoUrl } = require('./xrp');

function videoUrlsOf(mediaUrls) {
  return (Array.isArray(mediaUrls) ? mediaUrls : []).filter(isVideoUrl);
}

function checkPlatform(platform, videos) {
  if (platform === 'youtube') {
    return videos.length > 0
      ? { platform, status: 'ready', reason: null }
      : { platform, status: 'blocked', reason: 'YouTube needs a video — attach a video file URL to the post.' };
  }
  if (platform === 'tiktok') {
    return videos.length > 0
      ? { platform, status: 'ready', reason: null }
      : { platform, status: 'blocked', reason: 'TikTok needs a video — attach a video file URL to the post.' };
  }
  if (platform === 'twitter' || platform === 'x') {
    return videos.length > 1
      ? { platform, status: 'blocked', reason: 'X allows only one video per post.' }
      : { platform, status: 'ready', reason: null };
  }
  if (platform === 'pinterest') {
    return videos.length > 0
      ? { platform, status: 'blocked', reason: 'Pinterest video pins need a video upload flow that is not implemented yet — attach an image instead.' }
      : { platform, status: 'ready', reason: null };
  }
  return { platform, status: 'unchecked', reason: 'Video readiness for this platform has not been verified.' };
}

// platforms: the post's platform list. mediaUrls: the
// post's media list. Returns the videos found, one
// result per platform, and whether anything blocks.
function validateVideoPost({ platforms = [], mediaUrls = [] } = {}) {
  const videos = videoUrlsOf(mediaUrls);
  const results = platforms.map((platform) => checkPlatform(platform, videos));
  return {
    videos,
    results,
    blocked: results.filter((r) => r.status === 'blocked'),
    ready: !results.some((r) => r.status === 'blocked'),
  };
}

module.exports = { videoUrlsOf, checkPlatform, validateVideoPost };
