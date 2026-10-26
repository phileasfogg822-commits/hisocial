const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    {
      id: 'facebook',
      name: 'Facebook',
      color: '#1877F2',
      icon: 'facebook',
      configured: isConfigured('facebook'),
      charLimit: 63206,
      supportsImages: true,
      supportsVideo: true
    },
    {
      id: 'instagram',
      name: 'Instagram',
      color: '#E4405F',
      icon: 'instagram',
      configured: isConfigured('instagram'),
      charLimit: 2200,
      supportsImages: true,
      requiresMedia: true,
      supportsVideo: true
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      color: '#0A66C2',
      icon: 'linkedin',
      configured: isConfigured('linkedin'),
      charLimit: 3000,
      supportsImages: true,
      supportsVideo: true
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      color: '#000000',
      icon: 'twitter',
      configured: isConfigured('twitter'),
      charLimit: 280,
      supportsImages: true,
      supportsVideo: true
    },
    {
      id: 'reddit',
      name: 'Reddit',
      color: '#FF4500',
      icon: 'reddit',
      configured: isConfigured('reddit'),
      charLimit: 40000,
      supportsImages: true,
      supportsVideo: false
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      color: '#E60023',
      icon: 'pinterest',
      configured: isConfigured('pinterest'),
      charLimit: 500,
      supportsImages: true,
      supportsVideo: false
    }
  ]);
});

function isConfigured(platform) {
  const keys = {
    facebook: process.env.FACEBOOK_APP_ID,
    instagram: process.env.INSTAGRAM_APP_ID,
    linkedin: process.env.LINKEDIN_CLIENT_ID,
    twitter: process.env.TWITTER_API_KEY,
    reddit: process.env.REDDIT_CLIENT_ID,
    pinterest: process.env.PINTEREST_APP_ID
  };
  const val = keys[platform];
  return !!(val && !val.startsWith('your_'));
}

module.exports = router;
