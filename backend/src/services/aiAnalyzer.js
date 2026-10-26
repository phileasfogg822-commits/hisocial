const axios = require('axios');
const { tokenize } = require('./deduplicationService');

function isActionableOpportunityCandidate(post = {}) {
  const content = String(post.content || '').toLowerCase();
  const url = String(post.url || '').toLowerCase();
  const author = String(post.author || '').toLowerCase();

  const blockedPhrases = [
    'linkedin : s’identifier ou s’inscrire',
    "linkedin : s'identifier ou s'inscrire",
    'linkedin learning | connexion',
    'linkedin learning | login',
    'linkedin | linkedin',
    'sign in',
    's’identifier',
    "s'identifier",
    'connexion',
    'login',
  ];

  if (blockedPhrases.some((phrase) => content.includes(phrase) || author.includes(phrase))) {
    return false;
  }

  const blockedUrlParts = [
    '/login',
    '/checkpoint',
    '/authwall',
    '/learning/',
    '/company/linkedin',
    '/jobs/',
  ];

  if (blockedUrlParts.some((part) => url.includes(part))) {
    return false;
  }

  if (content.length < 80) return false;
  return true;
}

function containsHiringIntent(text = '') {
  const lowered = String(text).toLowerCase();
  const signals = [
    'hiring',
    'looking for',
    'need a',
    'need an',
    'freelancer',
    'contract role',
    'job opening',
    'apply now',
    'remote role',
    'designer needed',
    'developer needed'
  ];
  return signals.some((signal) => lowered.includes(signal));
}

function scoreOpportunity({ post, job }) {
  if (!isActionableOpportunityCandidate(post)) {
    return {
      score: 0,
      keywordHits: [],
      hasHiringIntent: false,
    };
  }

  const content = String(post.content || '');
  const tokens = tokenize(content);
  const keywordHits = (job.keywords || []).filter((keyword) =>
    content.toLowerCase().includes(String(keyword).toLowerCase())
  );

  let score = 0;
  score += Math.min(keywordHits.length * 20, 50);
  if (containsHiringIntent(content)) score += 25;

  const createdAt = post.scannedAt ? new Date(post.scannedAt) : new Date();
  const hoursOld = Math.max((Date.now() - createdAt.getTime()) / 36e5, 0);
  const recencyBonus = Math.max(20 - Math.floor(hoursOld), 0);
  score += recencyBonus;

  if (tokens.length > 40) score += 10;
  if ((job.includeWords || []).some((w) => content.toLowerCase().includes(String(w).toLowerCase()))) score += 10;
  if ((job.excludeWords || []).some((w) => content.toLowerCase().includes(String(w).toLowerCase()))) score -= 30;

  return {
    score: Math.max(0, Math.min(score, 100)),
    keywordHits,
    hasHiringIntent: containsHiringIntent(content),
  };
}

function getPreferredProvider() {
  if (process.env.BIGMODEL_API_KEY && !process.env.BIGMODEL_API_KEY.startsWith('your_')) return 'bigmodel';
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_')) return 'openai';
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) return 'gemini';
  return 'heuristic';
}

async function generateWithProvider({ provider, systemPrompt, userPrompt }) {
  if (provider === 'bigmodel') {
    const resp = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BIGMODEL_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  if (provider === 'openai') {
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 700,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
      }
    );
    return resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  return '';
}

function parseResponseBlocks(text = '') {
  const section = (name) => {
    const regex = new RegExp(`${name}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z ]+\\s*:|$)`, 'i');
    return (text.match(regex)?.[1] || '').trim();
  };

  return {
    comment: section('COMMENT') || 'Great opportunity — I can help deliver this quickly with a clear process and reliable communication.',
    dm: section('DM') || 'Hi! I saw your post and I can help with this role. Happy to share relevant work and jump on a quick call.',
    proposal: section('PROPOSAL') || 'I can take this project from discovery to delivery with weekly check-ins, clear milestones, and measurable outcomes.'
  };
}

async function generateResponses({ post, userContext = '', tone = 'professional' }) {
  const provider = getPreferredProvider();
  const systemPrompt = 'You are a freelancer applying for jobs professionally. Return concise, human-sounding outreach drafts.';
  const userPrompt = `Create three outputs for this hiring post.\nTone: ${tone}\nUser context: ${userContext || 'General digital services freelancer'}\n\nPost:\n${post.content}\n\nOutput format exactly:\nCOMMENT: ...\nDM: ...\nPROPOSAL: ...`;

  if (provider === 'heuristic') {
    return parseResponseBlocks('');
  }

  try {
    const text = await generateWithProvider({ provider, systemPrompt, userPrompt });
    return parseResponseBlocks(text);
  } catch {
    return parseResponseBlocks('');
  }
}

module.exports = {
  scoreOpportunity,
  isActionableOpportunityCandidate,
  generateResponses,
};
