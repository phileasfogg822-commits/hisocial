import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { buildStyledImagePrompt } from './utils/ImagePromptStyleGuide';
import { generateMultipleTopics } from './utils/TopicEngine';
import ComposeAI from './components/ComposeAI';

const resolveApiBase = () => {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();

  if (typeof window === 'undefined') {
    return configured || 'http://localhost:4000';
  }

  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  const hostBased = `${protocol}//${hostname}:4000`;

  if (!configured) return hostBased;

  try {
    const configuredUrl = new URL(configured);
    const isLocalBrowser = ['localhost', '127.0.0.1'].includes(hostname);
    const isRemoteConfigured = !['localhost', '127.0.0.1'].includes(configuredUrl.hostname);

    // If the UI is being opened locally but the env points to a remote VPS IP,
    // prefer the local backend automatically to avoid login timeouts during local testing.
    if (isLocalBrowser && isRemoteConfigured) {
      return hostBased;
    }
  } catch {
    return configured;
  }

  return configured;
};

const API = resolveApiBase();
const UI_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const HEADING_FONT_STACK = UI_FONT_STACK;
axios.defaults.withCredentials = true;

// ─── Theme Definitions (early — used by IIFE below) ───────────────────────────
const THEMES = {
  dark: {
    '--bg-deep':        '#0a0a12',
    '--bg-card':        '#0f0f1e',
    '--bg-card-alt':    '#0d0d1e',
    '--bg-elevated':    '#141427',
    '--border':         '#1a1a2e',
    '--border-soft':    '#2a2a3e',
    '--text-primary':   '#ffffff',
    '--text-secondary': '#dddddd',
    '--text-muted':     '#8888aa',
    '--text-faint':     '#555577',
    '--nav-active':     '#1a1a2e',
    '--input-bg':       '#0a0a12',
  },
  dim: {
    '--bg-deep':        '#111827',
    '--bg-card':        '#1a2236',
    '--bg-card-alt':    '#1e2841',
    '--bg-elevated':    '#243047',
    '--border':         '#2d3a50',
    '--border-soft':    '#3a4b60',
    '--text-primary':   '#f0f4ff',
    '--text-secondary': '#c8d5e8',
    '--text-muted':     '#8898aa',
    '--text-faint':     '#6b7a8d',
    '--nav-active':     '#1e3a5f',
    '--input-bg':       '#111827',
  },
  light: {
    '--bg-deep':        '#f0f4f8',
    '--bg-card':        '#ffffff',
    '--bg-card-alt':    '#f7f9fc',
    '--bg-elevated':    '#eef1f6',
    '--border':         '#dde3ec',
    '--border-soft':    '#c9d1dc',
    '--text-primary':   '#0f172a',
    '--text-secondary': '#334155',
    '--text-muted':     '#64748b',
    '--text-faint':     '#94a3b8',
    '--nav-active':     '#e0e7ff',
    '--input-bg':       '#f8fafc',
  },
};

// Apply saved theme CSS variables immediately (before first render, no flash)
(function applyInitialTheme() {
  const saved = localStorage.getItem('sh_theme') || 'dark';
  const vars = THEMES[saved] || THEMES.dark;
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
})();

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
const svgIcon = (paths) => ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    {paths}
  </svg>
);

const FacebookIcon = svgIcon(<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />);
const InstagramIcon = svgIcon(<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />);
const LinkedInIcon = svgIcon(<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />);
const TwitterIcon = svgIcon(<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />);
const RedditIcon = svgIcon(<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />);
const PinterestIcon = svgIcon(<path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />);

const PLATFORM_META = {
  facebook:      { name: 'Facebook',         color: '#1877F2', bg: '#1877F215', icon: FacebookIcon  },
  instagram:     { name: 'Instagram',        color: '#E4405F', bg: '#E4405F15', icon: InstagramIcon },
  linkedin:      { name: 'LinkedIn',         color: '#0A66C2', bg: '#0A66C215', icon: LinkedInIcon  },
  linkedin_page: { name: 'LinkedIn Pages',   color: '#0A66C2', bg: '#0A66C215', icon: LinkedInIcon  },
  twitter:       { name: 'X (Twitter)',      color: '#ffffff', bg: '#ffffff10', icon: TwitterIcon   },
  reddit:        { name: 'Reddit',           color: '#FF4500', bg: '#FF450015', icon: RedditIcon    },
  pinterest:     { name: 'Pinterest',        color: '#E60023', bg: '#E6002315', icon: PinterestIcon },
};

const generationSourceLabel = (source) => {
  const value = String(source || '').toLowerCase();
  if (value === 'workflow') return 'Workflow';
  if (value === 'compose') return 'Compose';
  if (value === 'calendar') return 'Calendar';
  if (value === 'autopilot') return 'Auto Pilot';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
};

const getGenerationMeta = (item) => {
  const source = generationSourceLabel(item?.generation_source);
  const index = Number(item?.generation_index || 0);
  const total = Number(item?.generation_total || 0);

  return {
    source,
    batch: index > 0 && total > 0 ? `${index}/${total}` : '',
  };
};

const renderGenerationBadges = (item) => {
  const meta = getGenerationMeta(item);
  if (!meta.source && !meta.batch) return null;

  return (
    <>
      {meta.source ? (
        <span style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid #334155', color: '#cbd5e1', fontSize: 11, fontWeight: 600 }}>
          {meta.source}
        </span>
      ) : null}
      {meta.batch ? (
        <span style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid #1d4ed8', color: '#93c5fd', fontSize: 11, fontWeight: 700 }}>
          {meta.batch}
        </span>
      ) : null}
    </>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookPagesLoading, setFacebookPagesLoading] = useState(false);
  const [linkedInTargets, setLinkedInTargets] = useState([]);
  const [linkedInTargetsLoading, setLinkedInTargetsLoading] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('compose'); // compose | history | settings
  const [theme, setTheme] = useState(() => localStorage.getItem('sh_theme') || 'dark');
  useEffect(() => {
    const vars = THEMES[theme] || THEMES.dark;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    localStorage.setItem('sh_theme', theme);
  }, [theme]);
  const [postHistory, setPostHistory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [connectedAccountDetails, setConnectedAccountDetails] = useState({});
  const [instagramSelectModal, setInstagramSelectModal] = useState(null);
  const [instagramSelectLoading, setInstagramSelectLoading] = useState(false);
  const [instagramPendingToken, setInstagramPendingToken] = useState(null);
  const [aiProviders, setAiProviders] = useState([]);
  const [calendarPosts, setCalendarPosts] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [appAuthenticated, setAppAuthenticated] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/user/me`);
      setUser(res.data.user);
      setConnectedPlatforms(res.data.connectedPlatforms.map(p => p.platform));
      // Store full account details for displaying username, avatar, etc.
      const accountMap = {};
      res.data.connectedPlatforms.forEach(p => {
        accountMap[p.platform] = p;
      });
      setConnectedAccountDetails(accountMap);
    } catch {
      setUser(null);
      setConnectedPlatforms([]);
      setConnectedAccountDetails({});
    }
  }, []);

  const loadAppSession = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/user/session`);
      const authenticated = Boolean(res.data?.authenticated);
      setAppAuthenticated(authenticated);
      return authenticated;
    } catch {
      setAppAuthenticated(false);
      return false;
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/accounts`);
      setAccounts(res.data || []);
    } catch {
      setAccounts([]);
    }
  }, []);

  const loadFacebookPages = useCallback(async () => {
    setFacebookPagesLoading(true);
    try {
      const res = await axios.get(`${API}/api/posts/facebook/pages`);
      setFacebookPages(res.data || []);
    } catch {
      setFacebookPages([]);
    } finally {
      setFacebookPagesLoading(false);
    }
  }, []);

  const loadAiProviders = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ai/providers`);
      setAiProviders(res.data || []);
    } catch {
      setAiProviders([]);
    }
  }, []);

  const loadCalendarPosts = useCallback(async (year, month) => {
    const y = year || new Date().getFullYear();
    const m = month || (new Date().getMonth() + 1);
    try {
      const res = await axios.get(`${API}/api/posts/calendar`, { params: { year: y, month: m } });
      setCalendarPosts(res.data || []);
    } catch {
      setCalendarPosts([]);
    }
  }, []);

  const loadAnalytics = useCallback(async (days = 7) => {
    try {
      const res = await axios.get(`${API}/api/analytics/engagement`, { params: { days } });
      setAnalyticsData(res.data || null);
    } catch {
      setAnalyticsData(null);
    }
  }, []);

  const loadLinkedInTargets = useCallback(async () => {
    setLinkedInTargetsLoading(true);
    try {
      const res = await axios.get(`${API}/api/posts/linkedin/targets`);
      setLinkedInTargets(res.data || []);
    } catch {
      setLinkedInTargets([]);
    } finally {
      setLinkedInTargetsLoading(false);
    }
  }, []);

  const switchAccount = async (accountId) => {
    try {
      const res = await axios.post(`${API}/api/accounts/switch`, { accountId });
      setUser(res.data.user);
      setConnectedPlatforms((res.data.connectedPlatforms || []).map(p => p.platform));
      // Store full account details
      const accountMap = {};
      (res.data.connectedPlatforms || []).forEach(p => {
        accountMap[p.platform] = p;
      });
      setConnectedAccountDetails(accountMap);
      setView('compose');
      notify(`Switched to ${res.data.user.name}`);
      await loadHistory();
      await loadAccounts();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to switch account', 'error');
    }
  };

  const createAccount = async ({ name, email, avatarUrl }) => {
    try {
      await axios.post(`${API}/api/accounts`, { name, email, avatarUrl });
      notify('Account created');
      await loadAccounts();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to create account', 'error');
    }
  };

  const updateProfile = async ({ name, avatar_url }) => {
    try {
      const res = await axios.put(`${API}/api/user/me`, { name, avatar_url });
      setUser(res.data.user);
      notify('Profile updated');
      await loadAccounts();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to update profile', 'error');
    }
  };

  useEffect(() => {
    const init = async () => {
      const authenticated = await loadAppSession();
      if (!authenticated) {
        setUser(null);
        setAccounts([]);
        setLoading(false);
        return;
      }

      const [, platRes, accountsRes] = await Promise.allSettled([
        loadUser(),
        axios.get(`${API}/api/platforms`),
        axios.get(`${API}/api/accounts`)
      ]);
      if (platRes.status === 'fulfilled') setPlatforms(platRes.value.data);
      if (accountsRes.status === 'fulfilled') setAccounts(accountsRes.value.data);
      setLoading(false);
    };
    init();

    // Handle OAuth callback params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    const instagramSelect = params.get('instagram_select'); // legacy
    const instagramToken = params.get('instagram_token');   // new token-based

    if (instagramToken || instagramSelect === 'true') {
      // Fetch available Instagram accounts for selection
      const url = instagramToken
        ? `${API}/auth/instagram/accounts?token=${instagramToken}`
        : `${API}/auth/instagram/accounts`;
      axios.get(url)
        .then(res => {
          setInstagramPendingToken(instagramToken || null);
          setInstagramSelectModal(res.data.accounts);
          window.history.replaceState({}, '', '/');
        })
        .catch(err => {
          notify(err.response?.data?.error || 'Failed to load Instagram accounts', 'error');
          window.history.replaceState({}, '', '/');
        });
    }

    if (connected) {
      notify(`${PLATFORM_META[connected]?.name || connected} connected successfully!`);
      window.history.replaceState({}, '', '/');
      loadUser();
    }
    if (error) {
      notify(error.replace(/_/g, ' '), 'error');
      window.history.replaceState({}, '', '/');
    }
  }, [loadAppSession, loadUser]);

  useEffect(() => {
    if (user && connectedPlatforms.includes('facebook')) {
      loadFacebookPages();
      return;
    }

    setFacebookPages([]);
    setFacebookPagesLoading(false);
  }, [connectedPlatforms, loadFacebookPages, user]);

  useEffect(() => {
    if (user) loadAiProviders();
  }, [user, loadAiProviders]);

  useEffect(() => {
    if (user && (connectedPlatforms.includes('linkedin') || connectedPlatforms.includes('linkedin_page'))) {
      loadLinkedInTargets();
      return;
    }

    setLinkedInTargets([]);
    setLinkedInTargetsLoading(false);
  }, [connectedPlatforms, loadLinkedInTargets, user]);

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API}/api/user/posts`);
      setPostHistory(res.data);
    } catch {}
  };

  const connectPlatform = (platformId) => {
    if (platformId === 'linkedin_page') {
      window.location.href = `${API}/auth/linkedin-org`;
    } else {
      window.location.href = `${API}/auth/${platformId}`;
    }
  };

  const disconnectPlatform = async (platformId) => {
    try {
      await axios.delete(`${API}/auth/disconnect/${platformId}`);
      setConnectedPlatforms(prev => prev.filter(p => p !== platformId));
      if (platformId === 'facebook') {
        setFacebookPages([]);
      }
      if (platformId === 'linkedin' || platformId === 'linkedin_page') {
        setLinkedInTargets([]);
      }
      notify(`${PLATFORM_META[platformId]?.name} disconnected`);
    } catch {
      notify('Failed to disconnect', 'error');
    }
  };

  const confirmInstagramAccount = async (accountId) => {
    setInstagramSelectLoading(true);
    try {
      const payload = { accountId };
      if (instagramPendingToken) payload.token = instagramPendingToken;
      const res = await axios.post(`${API}/auth/instagram/confirm`, payload);
      setInstagramSelectModal(null);
      setInstagramPendingToken(null);
      setUser(res.data.user);
      notify(`Instagram connected successfully!`);
      await loadUser();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to connect Instagram account', 'error');
    } finally {
      setInstagramSelectLoading(false);
    }
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`);
    setUser(null);
    setConnectedPlatforms([]);
    setFacebookPages([]);
    setLinkedInTargets([]);
    setCalendarPosts([]);
    setView('compose');
    loadAccounts();
  };

  const loginToApp = async ({ username, password }) => {
    setLoggingIn(true);
    try {
      await axios.post(`${API}/api/user/login`, { username, password });
      setAppAuthenticated(true);

      const [platRes, accountsRes] = await Promise.allSettled([
        axios.get(`${API}/api/platforms`),
        axios.get(`${API}/api/accounts`),
      ]);

      if (platRes.status === 'fulfilled') setPlatforms(platRes.value.data || []);
      if (accountsRes.status === 'fulfilled') setAccounts(accountsRes.value.data || []);
      notify('Logged in successfully');
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to log in', 'error');
    }
    setLoggingIn(false);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div style={styles.app}>
      <style>{globalCSS}</style>
      {notification && <Notification {...notification} />}
      {instagramSelectModal && <InstagramSelectModal accounts={instagramSelectModal} onSelect={confirmInstagramAccount} loading={instagramSelectLoading} />}
      
      <Sidebar
        user={user}
        accounts={accounts}
        view={view}
        setView={(v) => {
          setView(v);
          if (v === 'history' || v === 'library') loadHistory();
          if (v === 'calendar') { const n = new Date(); loadCalendarPosts(n.getFullYear(), n.getMonth() + 1); }
          if (v === 'analytics') loadAnalytics(7);
        }}
        onSwitchAccount={switchAccount}
        onLogout={logout}
        connectedCount={connectedPlatforms.length}
      />

      <main style={styles.main}>
        {!appAuthenticated ? (
          <LoginGate onLogin={loginToApp} loading={loggingIn} />
        ) : !user ? (
          <AccountPicker
            accounts={accounts}
            onSelect={switchAccount}
            onRefresh={loadAccounts}
            onCreate={createAccount}
          />
        ) : view === 'compose' ? (
          <ComposeView
            platforms={platforms}
            connectedPlatforms={connectedPlatforms}
            connectedAccountDetails={connectedAccountDetails}
            facebookPages={facebookPages}
            facebookPagesLoading={facebookPagesLoading}
            onLoadFacebookPages={loadFacebookPages}
            linkedInTargets={linkedInTargets}
            linkedInTargetsLoading={linkedInTargetsLoading}
            onLoadLinkedInTargets={loadLinkedInTargets}
            aiProviders={aiProviders}
            onConnect={connectPlatform}
            onNotify={(msg) => notify(msg)}
            onPost={(result) => {
              if (result.scheduled) {
                notify('Post scheduled! 📅 It will be published automatically.');
                loadHistory();
                return;
              }
              const successCount = result.results.filter(r => r.status === 'success').length;
              const failed = result.results.filter(r => r.status !== 'success');
              if (successCount === 0) {
                notify(failed[0]?.error_message || 'Posting failed', 'error');
              } else if (failed.length > 0) {
                notify(`Posted to ${successCount} platform(s). ${failed.length} failed.`);
              } else {
                notify(`Posted to ${successCount} platform(s)!`);
              }
              loadHistory();
            }}
            onError={(msg) => notify(msg, 'error')}
          />
        ) : view === 'schedule' ? (
          <ScheduleView
            platforms={platforms}
            connectedPlatforms={connectedPlatforms}
            connectedAccountDetails={connectedAccountDetails}
            facebookPages={facebookPages}
            facebookPagesLoading={facebookPagesLoading}
            onLoadFacebookPages={loadFacebookPages}
            linkedInTargets={linkedInTargets}
            linkedInTargetsLoading={linkedInTargetsLoading}
            onLoadLinkedInTargets={loadLinkedInTargets}
            aiProviders={aiProviders}
            onConnect={connectPlatform}
            onNotify={(msg) => notify(msg)}
            onError={(msg) => notify(msg, 'error')}
            onScheduled={() => {
              notify('Posts scheduled! 📅');
              loadHistory();
            }}
          />
        ) : view === 'library' ? (
          <LibraryView
            posts={postHistory}
            onRefresh={loadHistory}
            platforms={platforms}
            connectedPlatforms={connectedPlatforms}
            facebookPages={facebookPages}
            facebookPagesLoading={facebookPagesLoading}
            onLoadFacebookPages={loadFacebookPages}
            linkedInTargets={linkedInTargets}
            linkedInTargetsLoading={linkedInTargetsLoading}
            onLoadLinkedInTargets={loadLinkedInTargets}
            onError={(msg) => notify(msg, 'error')}
            onNotify={(msg) => notify(msg)}
          />
        ) : view === 'calendar' ? (
          <CalendarView
            posts={calendarPosts}
            onLoadMonth={loadCalendarPosts}
            platforms={platforms}
            connectedPlatforms={connectedPlatforms}
            facebookPages={facebookPages}
            facebookPagesLoading={facebookPagesLoading}
            onLoadFacebookPages={loadFacebookPages}
            linkedInTargets={linkedInTargets}
            linkedInTargetsLoading={linkedInTargetsLoading}
            onLoadLinkedInTargets={loadLinkedInTargets}
            onError={(msg) => notify(msg, 'error')}
            onNotify={(msg) => notify(msg)}
            onScheduled={() => {
              notify('Post scheduled from calendar! 📅');
              loadHistory();
            }}
          />
        ) : view === 'autopilot' ? (
          <AutoPilotView
            aiProviders={aiProviders}
            connectedPlatforms={connectedPlatforms}
            facebookPages={facebookPages}
            facebookPagesLoading={facebookPagesLoading}
            onLoadFacebookPages={loadFacebookPages}
            linkedInTargets={linkedInTargets}
            linkedInTargetsLoading={linkedInTargetsLoading}
            onLoadLinkedInTargets={loadLinkedInTargets}
            onNotify={(msg) => notify(msg)}
            onError={(msg) => notify(msg, 'error')}
          />
        ) : view === 'overlay' ? (
          <PPLEView
            connectedPlatforms={connectedPlatforms}
            facebookPages={facebookPages}
            linkedInTargets={linkedInTargets}
            onNotify={(msg) => notify(msg)}
            onError={(msg) => notify(msg, 'error')}
          />
        ) : view === 'analytics' ? (
          <AnalyticsView data={analyticsData} onRefresh={() => loadAnalytics(7)} onError={(msg) => notify(msg, 'error')} />
        ) : view === 'groups' ? (
          <GroupsView onNotify={(msg) => notify(msg)} onError={(msg) => notify(msg, 'error')} />
        ) : view === 'onboarding' ? (
          <OnboardingWizard onConnect={connectPlatform} onError={(msg) => notify(msg, 'error')} />
        ) : (
          <SettingsView
            platforms={platforms}
            connectedPlatforms={connectedPlatforms}
            connectedAccountDetails={connectedAccountDetails}
            onConnect={connectPlatform}
            onDisconnect={disconnectPlatform}
            user={user}
            onProfileSave={updateProfile}
            aiProviders={aiProviders}
            onRefreshAiProviders={loadAiProviders}
            theme={theme}
            onThemeChange={setTheme}
          />
        )}
      </main>
    </div>
  );
}

// ─── Topic Suggestion Panel ───────────────────────────────────────────────────
// Shared widget used in Compose, Workflow, AutoPilot, and Calendar
function TopicSuggestionPanel({ niche: propNiche = '', category: propCategory = '', tone: propTone = 'professional', onSelect }) {
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  // Local editable context — pre-filled from parent form, but user can tweak inline
  const [localNiche, setLocalNiche] = useState(propNiche);
  const [localCategory, setLocalCategory] = useState(propCategory);
  const [localTone, setLocalTone] = useState(propTone || 'professional');

  // Keep in sync when the parent form fields change
  useEffect(() => { setLocalNiche(propNiche); }, [propNiche]);
  useEffect(() => { setLocalCategory(propCategory); }, [propCategory]);
  useEffect(() => { setLocalTone(propTone || 'professional'); }, [propTone]);

  const fetchTopics = async (n, c, t) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/api/ai/topics`, { niche: n, category: c, tone: t, count: 5 });
      setTopics(res.data?.topics || []);
    } catch {
      const local = generateMultipleTopics(5, { niche: n, category: c, tone: t });
      setTopics(local);
      if (local.length === 0) setError('Could not generate topics. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const generate = () => {
    setOpen(true);
    fetchTopics(localNiche, localCategory, localTone);
  };

  const refresh = () => fetchTopics(localNiche, localCategory, localTone);

  const TONE_OPTIONS = [
    'professional', 'casual', 'educational', 'motivational', 'inspirational',
    'storytelling', 'funny', 'serious', 'sarcastic',
  ];

  const contextLabel = [localNiche, localCategory].filter(Boolean).join(' · ') || 'No context set';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={generate}
        disabled={loading}
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '⚡ Thinking…' : '🧠 Auto-Generate Topics'}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          zIndex: 999,
          background: 'var(--bg-card, #0f0f1e)',
          border: '1px solid #6366f1',
          borderRadius: 12,
          padding: 14,
          minWidth: 340,
          maxWidth: 500,
          boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Topic Generator
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={refresh}
                disabled={loading}
                style={{ background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}
              >
                {loading ? '…' : '↻ New batch'}
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Editable context — stays in sync with parent fields; user can also edit here */}
          <div style={{ background: 'var(--bg-elevated, #141427)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              Context (edit to refine topics)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
              <input
                value={localNiche}
                onChange={(e) => setLocalNiche(e.target.value)}
                placeholder="Niche (e.g. online selling)"
                style={{
                  background: 'var(--bg-card, #0f0f1e)', border: '1px solid var(--border, #1a1a2e)',
                  borderRadius: 6, color: 'var(--text-primary, #fff)', fontSize: 11, padding: '5px 8px',
                }}
              />
              <input
                value={localCategory}
                onChange={(e) => setLocalCategory(e.target.value)}
                placeholder="Category (e.g. ecommerce)"
                style={{
                  background: 'var(--bg-card, #0f0f1e)', border: '1px solid var(--border, #1a1a2e)',
                  borderRadius: 6, color: 'var(--text-primary, #fff)', fontSize: 11, padding: '5px 8px',
                }}
              />
            </div>
            <select
              value={localTone}
              onChange={(e) => setLocalTone(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-card, #0f0f1e)', border: '1px solid var(--border, #1a1a2e)',
                borderRadius: 6, color: 'var(--text-primary, #fff)', fontSize: 11, padding: '5px 8px',
              }}
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <button
              onClick={refresh}
              disabled={loading}
              style={{
                marginTop: 6, width: '100%', background: '#6366f1', border: 'none',
                borderRadius: 6, color: '#fff', cursor: loading ? 'wait' : 'pointer',
                fontSize: 11, fontWeight: 600, padding: '5px 0',
              }}
            >
              {loading ? 'Generating…' : `Generate for "${localNiche || localCategory || 'any niche'}"`}
            </button>
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          {loading ? (
            <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              Generating Gemini topics for <strong style={{ color: '#a5b4fc' }}>{contextLabel}</strong>…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topics.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(t); setOpen(false); }}
                  style={{
                    background: 'var(--bg-elevated, #141427)',
                    border: '1px solid var(--border, #1a1a2e)',
                    borderRadius: 8,
                    color: 'var(--text-primary, #fff)',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: '8px 10px',
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border, #1a1a2e)')}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Compose View ─────────────────────────────────────────────────────────────
function ComposeView({
  platforms,
  connectedPlatforms,
  connectedAccountDetails,
  facebookPages,
  facebookPagesLoading,
  onLoadFacebookPages,
  linkedInTargets,
  linkedInTargetsLoading,
  onLoadLinkedInTargets,
  aiProviders,
  onConnect,
  onNotify,
  onPost,
  onError
}) {
  const [studioTab, setStudioTab] = useState('compose');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedFacebookPages, setSelectedFacebookPages] = useState([]);
  const [selectedLinkedInTargets, setSelectedLinkedInTargets] = useState([]);
  const [aiProvider, setAiProvider] = useState('');
  const [composeImageProvider, setComposeImageProvider] = useState('');

  const [tone, setTone] = useState('professional');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState('');
  const [topic, setTopic] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [composeHeading, setComposeHeading] = useState('');
  const [composeCaptionHashtags, setComposeCaptionHashtags] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [composeGenerating, setComposeGenerating] = useState(false);
  const [composeState, setComposeState] = useState('draft');

  const composeFileInputRef = useRef(null);
  const workflowFileInputRef = useRef(null);
  const [workflowUploadItemId, setWorkflowUploadItemId] = useState('');
  const [composeImagePrompt, setComposeImagePrompt] = useState('');
  const [composeImageUrl, setComposeImageUrl] = useState('');
  const [composeImageLinksInput, setComposeImageLinksInput] = useState('');
  const [composeMediaUrls, setComposeMediaUrls] = useState([]);
  const [composeMediaItems, setComposeMediaItems] = useState([]);
  const [composeImageState, setComposeImageState] = useState('draft');
  const [composeImageGenerating, setComposeImageGenerating] = useState(false);
  const [composeUploading, setComposeUploading] = useState(false);

  const [workflowDays, setWorkflowDays] = useState('7');
  const [workflowTheme, setWorkflowTheme] = useState('');
  const [workflowTone, setWorkflowTone] = useState('professional');
  const [workflowNiche, setWorkflowNiche] = useState('');
  const [workflowCategory, setWorkflowCategory] = useState('');
  const [workflowTopic, setWorkflowTopic] = useState('');
  const [workflowAiProvider, setWorkflowAiProvider] = useState('');
  const [workflowImageProvider, setWorkflowImageProvider] = useState('');
  const [workflowAspect, setWorkflowAspect] = useState('1:1');
  const [workflowStyle, setWorkflowStyle] = useState('minimal');
  const [workflowColorTheme, setWorkflowColorTheme] = useState('blue and white');
  const [workflowConsistency, setWorkflowConsistency] = useState('consistent lighting, centered composition');
  const [workflowGenerating, setWorkflowGenerating] = useState(false);
  const [workflowItems, setWorkflowItems] = useState([]);
  const [activeWorkflowItemId, setActiveWorkflowItemId] = useState('');
  const [schedulingId, setSchedulingId] = useState('');
  const [publishingCompose, setPublishingCompose] = useState(false);
  
  // Template selector for posts
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState('');
  const [templateSelectorAction, setTemplateSelectorAction] = useState(null); // 'publish' or 'schedule'
  const [renderingTemplateForPost, setRenderingTemplateForPost] = useState(false);

  const parseMediaUrlLines = (value) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  const normalizeMediaUrl = useCallback((rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:image/')) return raw;

    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.pathname.startsWith('/uploads/')) {
        return `${API}${parsed.pathname}`;
      }
      return parsed.href;
    } catch {
      if (raw.startsWith('/uploads/')) return `${API}${raw}`;
      return raw;
    }
  }, []);
  
  // Load saved PPLE templates for the selector
  const loadSavedTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/pple/templates`);
      setSavedTemplates(res.data?.templates || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, []);

  useEffect(() => {
    loadSavedTemplates();
  }, [loadSavedTemplates]);

  const renderTemplateWithBase = useCallback(async ({ templateId, baseImageSource, nameSuffix = 'rendered_template' }) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) throw new Error('Selected template not found');
    const normalizedBase = normalizeMediaUrl(baseImageSource || '');
    if (!normalizedBase) throw new Error('Base image is required to apply template');

    const normalizedLayers = (template.layers || []).map((layer) => {
      if (layer.type === 'image' && layer.src) {
        return { ...layer, src: normalizeMediaUrl(layer.src) };
      }
      return layer;
    });

    const res = await axios.post(`${API}/api/pple/render`, {
      baseImageUrl: normalizedBase,
      layers: normalizedLayers,
      outputWidth: template.canvas_width || 1080,
      outputHeight: template.canvas_height || 1080,
      name: `${template.name || 'template'}_${nameSuffix}`,
    });

    const renderedUrl = normalizeMediaUrl(res.data?.image?.preview_url || res.data?.image?.local_url || res.data?.image?.url || '');
    if (!renderedUrl) throw new Error('No image URL in render response');
    return renderedUrl;
  }, [savedTemplates, normalizeMediaUrl]);

  const textProviders = aiProviders.filter((provider) => provider.hasText !== false);
  const imageProviders = aiProviders.filter((provider) => provider.hasImage);

  const buildMediaItemsFromUrls = (urls) => Array.from(new Set((urls || []).map((url) => String(url || '').trim()).filter(Boolean))).map((url) => ({
    id: url,
    url,
    thumbnail_url: url,
    name: url.split('/').pop() || 'image',
  }));

  const syncComposeMediaUrls = (nextUrls) => {
    const normalized = Array.from(new Set((nextUrls || []).map((url) => String(url || '').trim()).filter(Boolean)));
    setComposeMediaUrls(normalized);
    setComposeMediaItems(buildMediaItemsFromUrls(normalized));
    setComposeImageLinksInput(normalized.join('\n'));
  };

  const togglePlatform = (id) => {
    if (!connectedPlatforms.includes(id)) return;
    setSelectedPlatforms((prev) => (
      prev.includes(id)
        ? prev.filter((platformId) => platformId !== id)
        : [...prev, id]
    ));
  };

  const buildImagePrompt = (text, heading, hashtags, settings = {}) => {
    // Use provided heading and hashtags for image prompt with layout zones
    // Build base visual description (the main body text)
    const base = String(text || '')
      .replace(/^\s*(HEADING|CONTENT|PICKUP_LINE|CTA|CLOSING|CAPTION|HASHTAGS)\s*:\s*/gim, '')
      .replace(/#[a-zA-Z0-9_]+/g, ' ') // Remove hashtags
      .replace(/\b(click|read more|follow us|comment below|learn more|dm us|share this)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200); // Leave room for heading
    
    // Combine heading and base text for image prompt, then add hashtags as keywords
    const promptWithHeading = [heading, base, hashtags].filter(Boolean).join(' ').slice(0, 280);
    
    // Use styled prompt system with detected template and pass heading + hashtags for layout
    const category = settings.category || workflowCategory || '';
    return buildStyledImagePrompt(promptWithHeading, {
      template: detectTemplateFromCategory(category),
      contentType: 'social_media',
      aspectRatio: settings.aspect || workflowAspect || '1:1',
      additionalElements: category ? [category] : [],
      heading: String(heading || '').slice(0, 100), // Pass heading for zone 2 placement
      hashtags: String(hashtags || '').slice(0, 150), // Pass hashtags for zone 3 icons
    });
  };

  const detectTemplateFromCategory = (categoryText) => {
    const normalized = String(categoryText || '').toLowerCase();
    const templateMapping = {
      'tech': 'tech',
      'technology': 'tech',
      'business': 'business',
      'finance': 'business',
      'analytics': 'growth',
      'growth': 'growth',
      'data': 'growth',
      'product': 'products',
      'ecommerce': 'products',
      'education': 'educational',
      'learning': 'educational',
      'lifestyle': 'lifestyle'
    };

    for (const [key, template] of Object.entries(templateMapping)) {
      if (normalized.includes(key)) return template;
    }
    return 'growth';
  };

  const stripTextInstructionsFromImagePrompt = (prompt) => {
    return String(prompt || '')
      .replace(/\b(with|add|include|show|display)\s+(text|heading|headline|subheading|title|caption|body text|footer|letters|words?)\b/gi, '')
      .replace(/\b(text|heading|headline|subheading|title|caption|body text|footer|letters|words?)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  useEffect(() => {
    if (!generatedText.trim()) return;
    setComposeImagePrompt(buildImagePrompt(generatedText, composeHeading, composeCaptionHashtags, {
      style: workflowStyle,
      aspect: workflowAspect,
      colorTheme: workflowColorTheme,
      consistency: workflowConsistency,
    }));
  }, [generatedText, composeHeading, composeCaptionHashtags, workflowAspect, workflowColorTheme, workflowConsistency, workflowStyle]);

  useEffect(() => {
    if (composeImageUrl) {
      syncComposeMediaUrls([...composeMediaUrls, composeImageUrl]);
    }
  }, [composeImageUrl]);

  useEffect(() => {
    if (!selectedPlatforms.includes('facebook')) {
      setSelectedFacebookPages([]);
      return;
    }

    if (!facebookPagesLoading && facebookPages.length === 0) {
      onLoadFacebookPages();
    }

    if (facebookPages.length === 1) {
      setSelectedFacebookPages([facebookPages[0].id]);
      return;
    }

    setSelectedFacebookPages((prev) => prev.filter((pageId) => facebookPages.some((page) => page.id === pageId)));
  }, [facebookPages, facebookPagesLoading, onLoadFacebookPages, selectedPlatforms]);

  useEffect(() => {
    if (!selectedPlatforms.includes('linkedin')) {
      setSelectedLinkedInTargets([]);
      return;
    }

    if (!linkedInTargetsLoading && linkedInTargets.length === 0) {
      onLoadLinkedInTargets();
    }

    if (linkedInTargets.length === 1) {
      setSelectedLinkedInTargets([linkedInTargets[0].id]);
      return;
    }

    setSelectedLinkedInTargets((prev) => prev.filter((targetId) => linkedInTargets.some((target) => target.id === targetId)));
  }, [linkedInTargets, linkedInTargetsLoading, onLoadLinkedInTargets, selectedPlatforms]);

  const generateSinglePost = async () => {
    const seed = topic || workflowTheme || niche || 'social media thought leadership';
    setComposeGenerating(true);
    try {
      const res = await axios.post(`${API}/api/ai/generate`, {
        topic: seed,
        niche: niche || undefined,
        tone,
        count: 1,
        max_length: 600,
        provider: aiProvider || undefined,
        platforms: selectedPlatforms,
      });
      const post = res.data?.posts?.[0] || {};
      // Handle both old (string) and new (object) formats for backward compatibility
      const isStructuredPost = typeof post === 'object' && !Array.isArray(post);
      
      if (isStructuredPost) {
        // New structured format
        setGeneratedText(post.body || '');
        setComposeHeading(post.heading || '');
        setComposeCaptionHashtags(post.hashtags || '');
      } else {
        // Fallback for old string format
        const postText = String(post || '').trim();
        setGeneratedText(postText);
        setComposeHeading('');
        setComposeCaptionHashtags('');
      }
      setComposeState('draft');
      setComposeImageState('draft');
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to generate post text');
    }
    setComposeGenerating(false);
  };

  const generateComposeImage = async () => {
    if (!composeImagePrompt.trim()) return onError('Image prompt is required');
    setComposeImageGenerating(true);
    try {
      const res = await axios.post(`${API}/api/ai/image`, {
        prompt: composeImagePrompt,
        style: workflowStyle,
        aspect_ratio: workflowAspect,
        provider: composeImageProvider || undefined,
      });
      setComposeImageUrl(res.data?.url || '');
      setComposeImageState('draft');
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to generate image');
    }
    setComposeImageGenerating(false);
  };

  const daysCount = Math.min(Math.max(parseInt(workflowDays, 10) || 7, 1), 30);
  const timelineDates = Array.from({ length: daysCount }).map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });

  const generateWorkflow = async () => {
    const seed = workflowTopic || workflowTheme || workflowNiche || workflowCategory || 'content campaign';
    setWorkflowGenerating(true);
    try {
      const res = await axios.post(`${API}/api/ai/generate`, {
        topic: seed,
        niche: workflowNiche || undefined,
        tone: workflowTone,
        count: daysCount,
        max_length: 700,
        provider: workflowAiProvider || aiProvider || undefined,
        platforms: selectedPlatforms,
      });

      const posts = Array.isArray(res.data?.posts) ? res.data.posts : [];
      const batchId = `workflow-${Date.now()}`;
      const nextItems = posts.map((post, index) => {
        const fallbackDate = timelineDates[index] || timelineDates[timelineDates.length - 1] || new Date();
        
        // Handle both structured and string formats
        const isStructured = typeof post === 'object' && !Array.isArray(post);
        const heading = isStructured ? (post.heading || '') : '';
        const body = isStructured ? (post.body || '') : String(post || '').trim();
        const hashtags = isStructured ? (post.hashtags || '') : '';
        const fullText = isStructured ? (post.full_text || [heading, body, hashtags].filter(Boolean).join('\n\n')) : String(post || '').trim();
        
        return {
          id: `wf-${Date.now()}-${index}`,
          day: index + 1,
          text: fullText,
          heading: heading,
          hashtags: hashtags,
          imagePrompt: buildImagePrompt(body, heading, hashtags, {
            style: workflowStyle,
            aspect: workflowAspect,
            colorTheme: workflowColorTheme,
            consistency: workflowConsistency,
          }),
          imageUrl: '',
          state: 'draft',
          scheduledDate: fallbackDate.toISOString().slice(0, 10),
          scheduledTime: '10:00',
          scheduledPostId: null,
          generation_source: 'workflow',
          generation_batch_id: batchId,
          generation_index: index + 1,
          generation_total: posts.length,
        };
      });

      setWorkflowItems(nextItems);
      setActiveWorkflowItemId(nextItems[0]?.id || '');
      setStudioTab('workflow');
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to generate workflow posts');
    }
    setWorkflowGenerating(false);
  };

  const updateWorkflowItem = (itemId, patch) => {
    setWorkflowItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const regenerateWorkflowImagePrompt = (itemId) => {
    const target = workflowItems.find((item) => item.id === itemId);
    if (!target) return;
    updateWorkflowItem(itemId, {
      imagePrompt: buildImagePrompt(target.text, target.heading || '', target.hashtags || '', {
        style: workflowStyle,
        aspect: workflowAspect,
        colorTheme: workflowColorTheme,
        consistency: workflowConsistency,
      }),
    });
  };

  const cleanupWorkflowImagePrompt = (itemId) => {
    const target = workflowItems.find((item) => item.id === itemId);
    if (!target) return;
    updateWorkflowItem(itemId, {
      imagePrompt: target.imagePrompt,
    });
  };

  const generateWorkflowImage = async (itemId) => {
    const target = workflowItems.find((item) => item.id === itemId);
    if (!target || !target.imagePrompt.trim()) return onError('Image prompt is required');
    updateWorkflowItem(itemId, { imageGenerating: true });
    try {
      const res = await axios.post(`${API}/api/ai/image`, {
        prompt: target.imagePrompt,
        style: workflowStyle,
        aspect_ratio: workflowAspect,
        provider: workflowImageProvider || composeImageProvider || undefined,
      });
      updateWorkflowItem(itemId, { imageGenerating: false, imageUrl: res.data?.url || '' });
    } catch (e) {
      updateWorkflowItem(itemId, { imageGenerating: false });
      onError(e.response?.data?.error || 'Failed to generate workflow image');
    }
  };

  const handleComposeImageLinksChange = (value) => {
    setComposeImageLinksInput(value);
    const nextUrls = parseMediaUrlLines(value);
    setComposeMediaUrls(nextUrls);
    setComposeMediaItems(buildMediaItemsFromUrls(nextUrls));
  };

  const removeComposeMediaUrl = (urlToRemove) => {
    syncComposeMediaUrls(composeMediaUrls.filter((url) => url !== urlToRemove));
  };

  const uploadWorkflowItemFiles = async (files) => {
    const itemId = workflowUploadItemId;
    if (!itemId) return;
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const formData = new FormData();
    list.forEach((file) => formData.append('files', file));
    updateWorkflowItem(itemId, { imageUploading: true });
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      if (uploadedUrls[0]) {
        updateWorkflowItem(itemId, { imageUrl: normalizeMediaUrl(uploadedUrls[0]), imageUploading: false });
      } else {
        updateWorkflowItem(itemId, { imageUploading: false });
      }
    } catch (e) {
      updateWorkflowItem(itemId, { imageUploading: false });
      onError(e.response?.data?.error || 'Failed to upload image');
    }
    setWorkflowUploadItemId('');
  };

  const uploadComposeFiles = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    const formData = new FormData();
    list.forEach((file) => formData.append('files', file));

    setComposeUploading(true);
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      const uploadedFiles = Array.isArray(res.data?.files) ? res.data.files : [];
      syncComposeMediaUrls([...composeMediaUrls, ...uploadedUrls]);
      if (uploadedFiles.length > 0) {
        setComposeMediaItems((prev) => {
          const merged = [...prev.filter((item) => !uploadedUrls.includes(item.url)), ...uploadedFiles.map((file) => ({
            id: file.id || file.url,
            url: file.url,
            thumbnail_url: file.thumbnail_url || file.url,
            name: file.name || (file.url || '').split('/').pop() || 'image',
          }))];
          return merged;
        });
      }
      if (uploadedUrls[0]) setComposeImageUrl(uploadedUrls[0]);
      setComposeImageState('selected');
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to upload images');
    }
    setComposeUploading(false);
  };

  const assignToDate = (itemId, dateValue) => {
    updateWorkflowItem(itemId, { state: 'selected', scheduledDate: dateValue });
  };

  const scheduleWorkflowItem = async (item) => {
    if (selectedPlatforms.length === 0) return onError('Select at least one platform for scheduling');
    if (!item.text.trim()) return onError('Item text is empty');
    if (!item.scheduledDate || !item.scheduledTime) return onError('Date and time are required');
    if (selectedPlatforms.includes('facebook') && selectedFacebookPages.length === 0) return onError('Select at least one Facebook Page');
    if (selectedPlatforms.includes('linkedin') && selectedLinkedInTargets.length === 0) return onError('Select at least one LinkedIn target');

    const scheduledAt = `${item.scheduledDate}T${item.scheduledTime}:00`;
    setSchedulingId(item.id);
    try {
      let mediaUrls = item.imageUrl ? [normalizeMediaUrl(item.imageUrl)] : [];
      if (defaultTemplateId) {
        const baseImageSource = normalizeMediaUrl(item.imageUrl || mediaUrls[0] || '');
        if (!baseImageSource) {
          onError('Generate workflow image first before applying the selected template.');
          setSchedulingId('');
          return;
        }
        const renderedUrl = await renderTemplateWithBase({
          templateId: defaultTemplateId,
          baseImageSource,
          nameSuffix: `workflow_day_${item.day}`,
        });
        mediaUrls = [renderedUrl];
        updateWorkflowItem(item.id, { imageUrl: renderedUrl });
      }

      // Check if we should use AI Creative Engine based on available parameters in the item
      const shouldUseAIEngine = (item.niche || item.category || item.topic) && !item.text; // Use AI if we have AI parameters but no text content

      let res;
      if (shouldUseAIEngine) {
        // Use AI Creative Engine to generate and schedule
        res = await axios.post(`${API}/api/posts`, {
          tone: item.tone || 'professional',
          niche: item.niche,
          category: item.category,
          topic: item.topic,
          platforms: selectedPlatforms,
          scheduled_at: scheduledAt,
          media_urls: mediaUrls,
          facebook_page_ids: selectedPlatforms.includes('facebook') ? selectedFacebookPages : [],
          linkedin_target_ids: selectedPlatforms.includes('linkedin') ? selectedLinkedInTargets : [],
          provider: item.aiProvider || 'gemini',
          generation_source: 'ai_creative_engine_workflow',
          generation_batch_id: item.generation_batch_id || `ai_workflow-${new Date(item.scheduledDate || Date.now()).getTime()}`,
          generation_index: item.generation_index || item.day || 1,
          generation_total: item.generation_total || workflowItems.length || 1,
        });
      } else {
        // Use traditional scheduling method
        res = await axios.post(`${API}/api/posts`, {
          content: item.text,
          platforms: selectedPlatforms,
          media_urls: mediaUrls,
          scheduled_at: scheduledAt,
          facebook_page_ids: selectedPlatforms.includes('facebook') ? selectedFacebookPages : [],
          linkedin_target_ids: selectedPlatforms.includes('linkedin') ? selectedLinkedInTargets : [],
          generation_source: item.generation_source || 'workflow',
          generation_batch_id: item.generation_batch_id || `workflow-${new Date(item.scheduledDate || Date.now()).getTime()}`,
          generation_index: item.generation_index || item.day || 1,
          generation_total: item.generation_total || workflowItems.length || 1,
        });
      }
      
      if (res.data?.scheduled) {
        updateWorkflowItem(item.id, { state: 'scheduled', scheduledPostId: res.data?.post?.id || null });
        onPost({ scheduled: true, results: [] });
      }
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to schedule workflow item');
    }
    setSchedulingId('');
  };

  // Template selection handlers
  const handleTemplateSelected = async (templateId) => {
    const template = savedTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setRenderingTemplateForPost(true);
    try {
      const baseImageSource = normalizeMediaUrl(composeImageUrl || composeMediaUrls[0] || '');
      if (!baseImageSource) {
        onError('Generate or upload an image first, then apply a template on top of it.');
        setShowTemplateSelector(false);
        setTemplateSelectorAction(null);
        return;
      }

      const renderedUrl = await renderTemplateWithBase({
        templateId,
        baseImageSource,
        nameSuffix: 'compose',
      });
      
      // Replace the compose media with the final composite image.
      setComposeImageUrl(renderedUrl);
      setComposeImageState('selected');
      syncComposeMediaUrls([renderedUrl]);
      
      onNotify(`Template "${template.name}" applied on top of your base image and added to compose! 🎨`);
      setShowTemplateSelector(false);
      
      // Now proceed with the pending action
      if (templateSelectorAction === 'schedule') {
        setTimeout(() => actuallyScheduleSingleCompose(), 300);
      } else if (templateSelectorAction === 'publish') {
        setTimeout(() => actuallyPublishSingleCompose(), 300);
      }
      setTemplateSelectorAction(null);
    } catch (e) {
      console.error('Template render error:', e);
      const errorMsg = e.response?.data?.error || e.message || 'Failed to render template';
      onError(errorMsg);
      setShowTemplateSelector(false);
      setTemplateSelectorAction(null);
    } finally {
      setRenderingTemplateForPost(false);
    }
  };

  const showTemplateSelector_Schedule = () => {
    setTemplateSelectorAction('schedule');
    setShowTemplateSelector(true);
  };

  const showTemplateSelector_Publish = () => {
    setTemplateSelectorAction('publish');
    setShowTemplateSelector(true);
  };

  const cancelTemplateSelector = () => {
    setShowTemplateSelector(false);
    setTemplateSelectorAction(null);
  };

  // Actual scheduling and publishing without template check
  const actuallyScheduleSingleCompose = async () => {
    const firstDate = timelineDates[0] || new Date();
    const scheduledAt = `${firstDate.toISOString().slice(0, 10)}T10:00:00`;
    setSchedulingId('compose');
    try {
      let mediaUrls = [...composeMediaUrls];
      if (defaultTemplateId) {
        const baseImageSource = normalizeMediaUrl(composeImageUrl || mediaUrls[0] || '');
        if (!baseImageSource) {
          onError('Generate or upload an image first before scheduling with template overlay.');
          setSchedulingId('');
          return;
        }
        const renderedUrl = await renderTemplateWithBase({
          templateId: defaultTemplateId,
          baseImageSource,
          nameSuffix: 'compose_schedule',
        });
        mediaUrls = [renderedUrl];
        setComposeImageUrl(renderedUrl);
        setComposeImageState('selected');
        syncComposeMediaUrls([renderedUrl]);
      }

      // Check if we should use AI Creative Engine based on available parameters
      const shouldUseAIEngine = (niche || category || topic) && !selectedText; // Use AI if we have AI parameters but no selected text

      let res;
      if (shouldUseAIEngine) {
        // Use AI Creative Engine to generate and schedule
        res = await axios.post(`${API}/api/posts`, {
          tone: tone,
          niche: niche,
          category: category,
          topic: topic,
          platforms: selectedPlatforms,
          scheduled_at: scheduledAt,
          media_urls: mediaUrls,
          facebook_page_ids: selectedPlatforms.includes('facebook') ? selectedFacebookPages : [],
          linkedin_target_ids: selectedPlatforms.includes('linkedin') ? selectedLinkedInTargets : [],
          provider: aiProvider || 'gemini',
          generation_source: 'ai_creative_engine_compose',
          generation_batch_id: `ai_compose-${Date.now()}`,
          generation_index: 1,
          generation_total: 1,
        });
      } else {
        // Use traditional scheduling method
        res = await axios.post(`${API}/api/posts`, {
          content: selectedText,
          platforms: selectedPlatforms,
          media_urls: mediaUrls,
          scheduled_at: scheduledAt,
          facebook_page_ids: selectedPlatforms.includes('facebook') ? selectedFacebookPages : [],
          linkedin_target_ids: selectedPlatforms.includes('linkedin') ? selectedLinkedInTargets : [],
          generation_source: 'compose',
          generation_batch_id: `compose-${Date.now()}`,
          generation_index: 1,
          generation_total: 1,
        });
      }
      
      if (res.data?.scheduled) {
        setComposeState('scheduled');
        onPost({ scheduled: true, results: [] });
      }
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to schedule compose post');
    }
    setSchedulingId('');
  };

  const actuallyPublishSingleCompose = async () => {
    setPublishingCompose(true);
    try {
      // Check if we should use AI Creative Engine based on available parameters
      const shouldUseAIEngine = (niche || category || topic) && !selectedText; // Use AI if we have AI parameters but no selected text
      
      let mediaUrls = [...composeMediaUrls];
      if (defaultTemplateId) {
        const baseImageSource = normalizeMediaUrl(composeImageUrl || mediaUrls[0] || '');
        if (!baseImageSource) {
          onError('Generate or upload an image first before publishing with template overlay.');
          setPublishingCompose(false);
          return;
        }
        const renderedUrl = await renderTemplateWithBase({
          templateId: defaultTemplateId,
          baseImageSource,
          nameSuffix: 'compose_publish',
        });
        mediaUrls = [renderedUrl];
        setComposeImageUrl(renderedUrl);
        setComposeImageState('selected');
        syncComposeMediaUrls([renderedUrl]);
      }

      let res;
      if (shouldUseAIEngine) {
        // Use AI Creative Engine to generate and post
        res = await axios.post(`${API}/api/posts`, {
          tone: tone,
          niche: niche,
          category: category,
          topic: topic,
          platforms: selectedPlatforms,
          media_urls: mediaUrls,
          facebook_page_ids: selectedPlatforms.includes('facebook') ? selectedFacebookPages : [],
          linkedin_target_ids: selectedPlatforms.includes('linkedin') ? selectedLinkedInTargets : [],
          provider: aiProvider || 'gemini',
          generation_source: 'ai_creative_engine_compose',
          generation_batch_id: `ai_compose-${Date.now()}`,
          generation_index: 1,
          generation_total: 1,
        });
      } else {
        // Use traditional posting method
        res = await axios.post(`${API}/api/posts`, {
          content: selectedText,
          platforms: selectedPlatforms,
          media_urls: mediaUrls,
          facebook_page_ids: selectedPlatforms.includes('facebook') ? selectedFacebookPages : [],
          linkedin_target_ids: selectedPlatforms.includes('linkedin') ? selectedLinkedInTargets : [],
          generation_source: 'compose',
          generation_batch_id: `compose-${Date.now()}`,
          generation_index: 1,
          generation_total: 1,
        });
      }
      
      onPost(res.data);
    } catch (e) {
      onError(e.response?.data?.error || 'Failed to publish compose post');
    }
    setPublishingCompose(false);
  };

  const scheduleSingleCompose = async () => {
    if (!selectedText.trim()) return onError('Use generated text first');
    if (selectedPlatforms.length === 0) return onError('Select at least one platform');
    if (selectedPlatforms.includes('facebook') && selectedFacebookPages.length === 0) return onError('Select at least one Facebook Page');
    if (selectedPlatforms.includes('linkedin') && selectedLinkedInTargets.length === 0) return onError('Select at least one LinkedIn target');

    // Show template selector only when no default template is chosen.
    if (!defaultTemplateId && savedTemplates.length > 0) {
      showTemplateSelector_Schedule();
      return;
    }

    await actuallyScheduleSingleCompose();
  };

  const publishSingleCompose = async () => {
    if (!selectedText.trim()) return onError('Use generated text first');
    if (selectedPlatforms.length === 0) return onError('Select at least one platform');
    if (selectedPlatforms.includes('facebook') && selectedFacebookPages.length === 0) return onError('Select at least one Facebook Page');
    if (selectedPlatforms.includes('linkedin') && selectedLinkedInTargets.length === 0) return onError('Select at least one LinkedIn target');

    // Show template selector only when no default template is chosen.
    if (!defaultTemplateId && savedTemplates.length > 0) {
      showTemplateSelector_Publish();
      return;
    }

    await actuallyPublishSingleCompose();
  };

  const selectedForPreview = workflowItems.find((item) => item.id === activeWorkflowItemId) || null;
  const scheduledItems = workflowItems.filter((item) => item.state === 'selected' || item.state === 'scheduled');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={styles.platformRow}>
        {platforms.map((platform) => {
          const meta = PLATFORM_META[platform.id];
          const connected = connectedPlatforms.includes(platform.id);
          const selected = selectedPlatforms.includes(platform.id);
          return (
            <button
              key={platform.id}
              style={{
                ...styles.platformChip,
                borderColor: selected ? meta.color : '#2a2a3e',
                background: selected ? meta.bg : '#1a1a2e',
                opacity: connected ? 1 : 0.4,
                cursor: connected ? 'pointer' : 'not-allowed',
              }}
              onClick={() => connected ? togglePlatform(platform.id) : onConnect(platform.id)}
            >
              <meta.icon size={16} color={meta.color} />
              <span style={{ color: selected ? meta.color : '#888', fontSize: 13, fontWeight: 600 }}>{meta.name}</span>
            </button>
          );
        })}
      </div>

      {selectedPlatforms.includes('facebook') && (
        <div style={styles.targetCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={styles.targetLabel}>Facebook Pages</span>
            <button style={styles.secondaryBtn} onClick={onLoadFacebookPages}>Refresh</button>
          </div>
          {facebookPagesLoading ? <span style={styles.targetHint}>Loading...</span> : (
            <div style={styles.pageList}>
              {facebookPages.map((page) => (
                <label key={page.id} style={styles.pageOption}>
                  <input type="checkbox" checked={selectedFacebookPages.includes(page.id)} onChange={() => setSelectedFacebookPages((prev) => prev.includes(page.id) ? prev.filter((id) => id !== page.id) : [...prev, page.id])} />
                  <span style={{ color: '#ddd', fontSize: 12 }}>{page.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPlatforms.includes('linkedin') && (
        <div style={styles.targetCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={styles.targetLabel}>LinkedIn Targets</span>
            <button style={styles.secondaryBtn} onClick={onLoadLinkedInTargets}>Refresh</button>
          </div>
          {linkedInTargetsLoading ? <span style={styles.targetHint}>Loading...</span> : (
            <div style={styles.pageList}>
              {linkedInTargets.map((target) => (
                <label key={target.id} style={styles.pageOption}>
                  <input type="checkbox" checked={selectedLinkedInTargets.includes(target.id)} onChange={() => setSelectedLinkedInTargets((prev) => prev.includes(target.id) ? prev.filter((id) => id !== target.id) : [...prev, target.id])} />
                  <span style={{ color: '#ddd', fontSize: 12 }}>{target.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div style={{ ...styles.composeCard, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...styles.secondaryBtn, borderColor: studioTab === 'compose' ? '#6366f1' : '#2a2a3e' }} onClick={() => setStudioTab('compose')}>Compose</button>
            <button style={{ ...styles.secondaryBtn, borderColor: studioTab === 'workflow' ? '#6366f1' : '#2a2a3e' }} onClick={() => setStudioTab('workflow')}>AI Workflow</button>
            <button style={{ ...styles.secondaryBtn, borderColor: studioTab === 'ai' ? '#6366f1' : '#2a2a3e' }} onClick={() => setStudioTab('ai')}>✨ AI Engine</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <label style={styles.aiLabel}>Default template for new posts (Compose + Workflow)</label>
            <select style={styles.aiSelect} value={defaultTemplateId} onChange={(e) => setDefaultTemplateId(e.target.value)}>
              <option value="">No template overlay</option>
              {savedTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <div style={{ color: '#64748b', fontSize: 11 }}>
              When selected, this template is auto-applied to base images during schedule/publish. No per-post template prompt.
            </div>
          </div>

          {studioTab === 'ai' ? (
            <ComposeAI API={API} />
          ) : studioTab === 'compose' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select style={styles.aiSelect} value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="professional">Professional Tone</option>
                  <option value="casual">Casual Tone</option>
                  <option value="educational">Educational Tone</option>
                  <option value="inspirational">Inspirational Tone</option>
                </select>
                <input style={styles.aiInput} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche" />
                <input style={styles.aiInput} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
                <input style={styles.aiInput} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <TopicSuggestionPanel niche={niche} category={category} tone={tone} onSelect={(t) => setTopic(t)} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={styles.primaryBtn} onClick={generateSinglePost} disabled={composeGenerating}>{composeGenerating ? 'Generating...' : 'Generate / Regenerate Post'}</button>
                <select style={styles.aiSelect} value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
                  <option value="">AI Provider: Auto</option>
                  {textProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </select>
              </div>

              <textarea
                style={{ ...styles.textarea, minHeight: 120 }}
                value={generatedText}
                onChange={(e) => {
                  const value = e.target.value;
                  setGeneratedText(value);
                  // Text fields are now for display only; final post uses generatedText as-is
                }}
                placeholder="Generated text appears here..."
              />
              <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700, marginTop: 12 }}>Image Prompt Components</div>
              <input
                style={{ ...styles.input, marginTop: 8 }}
                value={composeHeading}
                onChange={(e) => setComposeHeading(e.target.value.split(/\s+/).slice(0, 7).join(' '))}
                placeholder="Catchy heading (max 7 words, from AI generation)"
                maxLength={50}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Word count: {composeHeading.split(/\s+/).filter(Boolean).length} / 7</div>
              <textarea
                style={{ ...styles.textarea, minHeight: 40, marginTop: 8 }}
                value={composeCaptionHashtags}
                onChange={(e) => {
                  // Only allow hashtags (lines starting with #)
                  const lines = e.target.value.split('\n');
                  const hashtagOnly = lines.filter(line => line.trim().startsWith('#') || line.trim() === '').join('\n');
                  setComposeCaptionHashtags(hashtagOnly);
                }}
                placeholder="Only hashtags here (e.g., #marketing #content #growth)"
              />
              <button
                style={styles.secondaryBtn}
                onClick={() => {
                  // Construct final post from heading + body + hashtags
                  const finalPost = [composeHeading, generatedText, composeCaptionHashtags]
                    .filter(Boolean)
                    .join('\n\n')
                    .trim();
                  setSelectedText(finalPost);
                  setComposeState('selected');
                }}
              >
                Use This Text
              </button>

              <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700 }}>Image Generation</div>
              <textarea style={{ ...styles.textarea, minHeight: 80 }} value={composeImagePrompt} onChange={(e) => setComposeImagePrompt(e.target.value)} placeholder="Auto-generated image prompt suggestion (editable)" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => setComposeImagePrompt(buildImagePrompt(selectedText || generatedText, composeHeading, composeCaptionHashtags, {
                    style: workflowStyle,
                    aspect: workflowAspect,
                    colorTheme: workflowColorTheme,
                    consistency: workflowConsistency,
                  }))
                }
              >
                Regenerate Image Prompt
              </button>
              <button
                  style={styles.secondaryBtn}
                  onClick={() => {}}
                >
                  Text Rendering Enabled
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select style={styles.aiSelect} value={workflowStyle} onChange={(e) => setWorkflowStyle(e.target.value)}>
                  <option value="minimal">minimal</option>
                  <option value="realistic">realistic</option>
                  <option value="3d">3D</option>
                  <option value="cinematic">cinematic</option>
                </select>
                <select style={styles.aiSelect} value={workflowAspect} onChange={(e) => setWorkflowAspect(e.target.value)}>
                  <option value="1:1">1:1</option>
                  <option value="4:5">4:5</option>
                  <option value="16:9">16:9</option>
                </select>
              </div>
              <select style={styles.aiSelect} value={composeImageProvider} onChange={(e) => setComposeImageProvider(e.target.value)}>
                <option value="">Image Provider: Auto</option>
                {imageProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <button style={styles.primaryBtn} onClick={generateComposeImage} disabled={composeImageGenerating}>{composeImageGenerating ? 'Generating image...' : 'Generate Image'}</button>

              {composeImageUrl && (
                <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 8, background: '#0b1220' }}>
                  <img src={composeImageUrl} alt="Generated" style={{ width: '100%', borderRadius: 8 }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button style={styles.secondaryBtn} onClick={() => setComposeImageState('selected')}>Use Image</button>
                    <button style={styles.secondaryBtn} onClick={() => syncComposeMediaUrls([...composeMediaUrls, composeImageUrl])}>Add to Media List</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <input style={styles.aiInput} value={workflowDays} onChange={(e) => setWorkflowDays(e.target.value)} placeholder="Days (7/14/30)" />
                <input style={styles.aiInput} value={workflowTheme} onChange={(e) => setWorkflowTheme(e.target.value)} placeholder="Content theme" />
                <select style={styles.aiSelect} value={workflowTone} onChange={(e) => setWorkflowTone(e.target.value)}>
                  <option value="professional">professional</option>
                  <option value="casual">casual</option>
                  <option value="educational">educational</option>
                  <option value="inspirational">inspirational</option>
                </select>
                <input style={styles.aiInput} value={workflowNiche} onChange={(e) => setWorkflowNiche(e.target.value)} placeholder="Niche" />
                <input style={styles.aiInput} value={workflowCategory} onChange={(e) => setWorkflowCategory(e.target.value)} placeholder="Category" />
                <input style={styles.aiInput} value={workflowTopic} onChange={(e) => setWorkflowTopic(e.target.value)} placeholder="Topic" />
              </div>
              <TopicSuggestionPanel niche={workflowNiche} category={workflowCategory} tone={workflowTone} onSelect={(t) => setWorkflowTopic(t)} />
              <select style={styles.aiSelect} value={workflowAiProvider} onChange={(e) => setWorkflowAiProvider(e.target.value)}>
                <option value="">AI Provider: Auto</option>
                {textProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <button style={styles.primaryBtn} onClick={generateWorkflow} disabled={workflowGenerating}>{workflowGenerating ? 'Generating workflow...' : 'Generate Workflow'}</button>

              {workflowItems.length > 0 && (
                <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                  <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Workflow Image Settings</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    <input style={styles.aiInput} value={workflowColorTheme} onChange={(e) => setWorkflowColorTheme(e.target.value)} placeholder="Color theme" />
                    <select style={styles.aiSelect} value={workflowAspect} onChange={(e) => setWorkflowAspect(e.target.value)}>
                      <option value="1:1">1:1</option>
                      <option value="4:5">4:5</option>
                      <option value="16:9">16:9</option>
                    </select>
                    <select style={styles.aiSelect} value={workflowStyle} onChange={(e) => setWorkflowStyle(e.target.value)}>
                      <option value="minimal">minimal</option>
                      <option value="realistic">realistic</option>
                      <option value="3d">3D</option>
                      <option value="cinematic">cinematic</option>
                    </select>
                    <select style={styles.aiSelect} value={workflowImageProvider} onChange={(e) => setWorkflowImageProvider(e.target.value)}>
                      <option value="">Image Provider: Auto</option>
                      {imageProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                    </select>
                    <input style={styles.aiInput} value={workflowConsistency} onChange={(e) => setWorkflowConsistency(e.target.value)} placeholder="Visual consistency rules" />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto' }}>
                {workflowItems.map((item) => (
                  <div key={item.id} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: activeWorkflowItemId === item.id ? '#111827' : '#0b1220' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontWeight: 700 }}>Day {item.day}</span>
                      <span style={{ color: item.state === 'scheduled' ? '#4ade80' : item.state === 'selected' ? '#60a5fa' : '#9ca3af', fontSize: 11 }}>{item.state}</span>
                    </div>
                    <textarea style={{ ...styles.textarea, minHeight: 82, fontSize: 12 }} value={item.text} onChange={(e) => updateWorkflowItem(item.id, { text: e.target.value })} />
                    <textarea style={{ ...styles.textarea, minHeight: 72, fontSize: 12, marginTop: 6 }} value={item.imagePrompt} onChange={(e) => updateWorkflowItem(item.id, { imagePrompt: e.target.value })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <button style={styles.secondaryBtn} onClick={() => regenerateWorkflowImagePrompt(item.id)}>Regenerate Image Prompt</button>
                      <button style={styles.secondaryBtn} onClick={() => cleanupWorkflowImagePrompt(item.id)}>Remove Text Instructions</button>
                    </div>
                    {item.imageUrl && <img src={item.imageUrl} alt="Workflow generated" style={{ width: '100%', borderRadius: 8, marginTop: 6 }} />}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button style={styles.secondaryBtn} onClick={() => generateWorkflowImage(item.id)}>{item.imageGenerating ? 'Generating...' : 'Generate Image'}</button>
                      <button style={styles.secondaryBtn} onClick={() => { setWorkflowUploadItemId(item.id); setTimeout(() => workflowFileInputRef.current?.click(), 0); }} disabled={item.imageUploading}>{item.imageUploading ? 'Uploading...' : 'Upload Image'}</button>
                      <button style={styles.secondaryBtn} onClick={() => { setActiveWorkflowItemId(item.id); updateWorkflowItem(item.id, { state: 'selected' }); }}>Use This Text</button>
                      <button style={styles.secondaryBtn} onClick={() => { updateWorkflowItem(item.id, { state: 'selected' }); setActiveWorkflowItemId(item.id); }}>Add to Schedule</button>
                      <button style={styles.secondaryBtn} onClick={() => setActiveWorkflowItemId(item.id)}>Preview</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...styles.settingsCard, margin: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Preview</div>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>
              Compose state: {composeState} • Image state: {composeImageState}
            </div>
            <textarea style={{ ...styles.textarea, minHeight: 120, fontSize: 12 }} value={selectedText} onChange={(e) => setSelectedText(e.target.value)} placeholder="Selected text preview" />
            <textarea
              style={{ ...styles.textarea, minHeight: 90, fontSize: 12, marginTop: 8 }}
              value={composeImageLinksInput}
              onChange={(e) => handleComposeImageLinksChange(e.target.value)}
              placeholder="Image links (one per line)"
            />
            <input
              ref={composeFileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => uploadComposeFiles(e.target.files)}
            />
            <input
              ref={workflowFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { uploadWorkflowItemFiles(e.target.files); e.target.value = ''; }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button style={styles.secondaryBtn} onClick={() => composeFileInputRef.current?.click()} disabled={composeUploading}>
                {composeUploading ? 'Uploading images...' : 'Add / Upload Images'}
              </button>
            </div>
            {composeMediaItems.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 8 }}>
                {composeMediaItems.map((item) => (
                  <div key={item.id || item.url} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 6, background: '#0b1220' }}>
                    <img
                      src={item.thumbnail_url || item.url}
                      alt={item.name || 'Compose media'}
                      style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, background: '#111827' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name || item.url}
                    </div>
                    <button style={{ ...styles.secondaryBtn, marginTop: 6, width: '100%' }} onClick={() => removeComposeMediaUrl(item.url)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button style={styles.primaryBtn} onClick={publishSingleCompose} disabled={publishingCompose}>
                {publishingCompose ? 'Publishing...' : 'Post / Publish Now'}
              </button>
              <button style={styles.primaryBtn} onClick={scheduleSingleCompose} disabled={schedulingId === 'compose'}>
                {schedulingId === 'compose' ? 'Scheduling...' : 'Schedule Selected Compose Post'}
              </button>
            </div>
          </div>

          <div style={{ ...styles.settingsCard, margin: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Calendar / Timeline ({daysCount} days)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {timelineDates.map((date) => {
                const dateKey = date.toISOString().slice(0, 10);
                const assigned = workflowItems.filter((item) => item.scheduledDate === dateKey && (item.state === 'selected' || item.state === 'scheduled'));
                return (
                  <div key={dateKey} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 8, background: '#0b1220' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: '#ddd', fontSize: 12, fontWeight: 700 }}>{date.toLocaleDateString()}</span>
                      {activeWorkflowItemId && (
                        <button style={styles.secondaryBtn} onClick={() => assignToDate(activeWorkflowItemId, dateKey)}>Assign Selected</button>
                      )}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{assigned.length} item(s)</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...styles.settingsCard, margin: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Scheduling Controls</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {scheduledItems.length === 0 && <span style={{ color: '#64748b', fontSize: 12 }}>No assigned posts yet.</span>}
              {scheduledItems.map((item) => (
                <div key={item.id} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 8 }}>
                  <div style={{ color: '#d1d5db', fontSize: 12, marginBottom: 6 }}>Day {item.day} • {item.state}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <input type="date" style={styles.datetimeInput} value={item.scheduledDate} onChange={(e) => updateWorkflowItem(item.id, { scheduledDate: e.target.value })} />
                    <input type="time" style={styles.datetimeInput} value={item.scheduledTime} onChange={(e) => updateWorkflowItem(item.id, { scheduledTime: e.target.value })} step="60" />
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>{String(item.text || '').slice(0, 140)}</div>
                  {item.imageUrl && <img src={item.imageUrl} alt="Scheduled visual" style={{ width: '100%', borderRadius: 8, marginBottom: 6 }} />}
                  <button style={styles.primaryBtn} onClick={() => scheduleWorkflowItem(item)} disabled={schedulingId === item.id || item.state === 'scheduled'}>
                    {item.state === 'scheduled' ? 'Scheduled' : schedulingId === item.id ? 'Scheduling...' : 'Add to Schedule'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {selectedForPreview && (
            <div style={{ ...styles.settingsCard, margin: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>Selected Workflow Preview</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Day {selectedForPreview.day}</div>
              <div style={{ color: '#d1d5db', fontSize: 12 }}>{selectedForPreview.text}</div>
            </div>
          )}
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: '#0f1419',
            border: '1px solid #1f2937',
            borderRadius: 12,
            padding: 24,
            maxWidth: 600,
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Select a Template to Use 🎨</div>
              <button
                onClick={cancelTemplateSelector}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
              Choose a template and it will be rendered and added to your post. Templates render on a clean canvas and include all your designs, text, and shapes.
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                💡 Tip: For best results, you can upload a base image in the PPLE editor panel first, then render your template with it!
              </div>
            </div>

            {savedTemplates.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p>No templates created yet.</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>Go to the PPLE editor to create templates!</p>
                <button
                  style={{ ...styles.secondaryBtn, marginTop: 12 }}
                  onClick={cancelTemplateSelector}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {savedTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelected(template.id)}
                      disabled={renderingTemplateForPost}
                      style={{
                        border: '2px solid #1f2937',
                        borderRadius: 8,
                        padding: 12,
                        background: '#0b1220',
                        cursor: renderingTemplateForPost ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: renderingTemplateForPost ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!renderingTemplateForPost) {
                          e.currentTarget.style.borderColor = '#6366f1';
                          e.currentTarget.style.background = '#111827';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#1f2937';
                        e.currentTarget.style.background = '#0b1220';
                      }}
                    >
                      <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {template.name}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}>
                        {template.layers?.length || 0} layers
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button
                    style={{ ...styles.secondaryBtn }}
                    onClick={cancelTemplateSelector}
                    disabled={renderingTemplateForPost}
                  >
                    Cancel
                  </button>
                  <div style={{ color: '#64748b', fontSize: 12, alignSelf: 'center' }}>
                    {renderingTemplateForPost ? 'Rendering template...' : ''}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History View ──────────────────────────────────────────────────────────────
function HistoryView({ posts }) {
  if (posts.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={{ fontSize: 48 }}>📭</div>
        <p style={{ color: '#555', marginTop: 12 }}>No posts yet. Start composing!</p>
      </div>
    );
  }
  return (
    <div style={styles.historyWrap}>
      <h2 style={styles.sectionTitle}>Post History</h2>
      {posts.map(post => (
        <div key={post.id} style={styles.historyCard}>
          <p style={{ color: '#ddd', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
            {post.content}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {(post.platform_results || []).filter(Boolean).map((r, i) => {
              if (!r.platform) return null;
              const meta = PLATFORM_META[r.platform];
              return (
                <span key={i} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: r.status === 'success' ? '#4ade8020' : '#f8717120',
                  color: r.status === 'success' ? '#4ade80' : '#f87171',
                  border: `1px solid ${r.status === 'success' ? '#4ade8040' : '#f8717140'}`
                }}>
                  {meta?.name || r.platform} {r.status === 'success' ? '✓' : '✗'}
                </span>
              );
            })}
          </div>
          <span style={{ color: '#444', fontSize: 11 }}>
            {new Date(post.created_at).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function PlatformPicker({ platformIds = [], selectedPlatforms = [], onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {platformIds.map((platformId) => {
        const meta = PLATFORM_META[platformId];
        if (!meta) return null;
        const checked = selectedPlatforms.includes(platformId);
        return (
          <button
            key={platformId}
            type="button"
            onClick={() => onToggle(platformId)}
            style={{
              ...styles.secondaryBtn,
              borderColor: checked ? meta.color : '#2a2a3e',
              color: checked ? meta.color : '#b1b1c8'
            }}
          >
            {meta.name}
          </button>
        );
      })}
    </div>
  );
}

function FacebookPagesPicker({ visible, pages = [], selectedPageIds = [], loading, onRefresh, onToggle }) {
  if (!visible) return null;

  return (
    <div style={styles.targetCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={styles.targetLabel}>Facebook Pages</span>
        <button style={styles.secondaryBtn} type="button" onClick={onRefresh}>Refresh</button>
      </div>
      {loading ? <span style={styles.targetHint}>Loading...</span> : (
        <div style={styles.pageList}>
          {pages.map((page) => (
            <label key={page.id} style={styles.pageOption}>
              <input type="checkbox" checked={selectedPageIds.includes(page.id)} onChange={() => onToggle(page.id)} />
              <span style={{ color: '#ddd', fontSize: 12 }}>{page.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedInTargetsPicker({ visible, targets = [], selectedTargetIds = [], loading, onRefresh, onToggle }) {
  if (!visible) return null;

  return (
    <div style={styles.targetCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={styles.targetLabel}>LinkedIn Targets</span>
        <button style={styles.secondaryBtn} type="button" onClick={onRefresh}>Refresh</button>
      </div>
      {loading ? <span style={styles.targetHint}>Loading...</span> : (
        <div style={styles.pageList}>
          {targets.map((target) => (
            <label key={target.id} style={styles.pageOption}>
              <input type="checkbox" checked={selectedTargetIds.includes(target.id)} onChange={() => onToggle(target.id)} />
              <span style={{ color: '#ddd', fontSize: 12 }}>{target.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformReport({ post }) {
  const rows = (post.platform_results || []).filter(Boolean);
  if (rows.length === 0) {
    return <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>No platform report is available for this post yet.</div>;
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row, index) => {
        const meta = PLATFORM_META[row.platform] || {};
        const isSuccess = row.status === 'success';
        return (
          <div key={`${row.platform || 'platform'}-${index}`} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 10, background: '#0b1220' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: meta.color || '#ddd', fontSize: 12, fontWeight: 700 }}>{meta.name || row.platform}</span>
              <span style={{ color: isSuccess ? '#4ade80' : '#f87171', fontSize: 11 }}>{row.status}</span>
              {row.posted_at && <span style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(row.posted_at).toLocaleString()}</span>}
            </div>
            {row.error_message && <div style={{ color: '#fecaca', fontSize: 12, marginTop: 6 }}>{row.error_message}</div>}
            {row.platform_post_url && (
              <a href={row.platform_post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: 12, marginTop: 6, display: 'inline-block' }}>
                Open published post
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({ posts, onLoadMonth, platforms = [], connectedPlatforms = [], facebookPages = [], facebookPagesLoading = false, onLoadFacebookPages, linkedInTargets = [], linkedInTargetsLoading = false, onLoadLinkedInTargets, onError, onScheduled, onNotify }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftMediaUrls, setDraftMediaUrls] = useState('');
  const [draftTime, setDraftTime] = useState('10:00');
  const [draftTemplateId, setDraftTemplateId] = useState('');
  const [draftPlatforms, setDraftPlatforms] = useState([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingPostId, setEditingPostId] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMediaUrls, setEditMediaUrls] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('10:00');
  const [draftFacebookPages, setDraftFacebookPages] = useState([]);
  const [draftLinkedInTargets, setDraftLinkedInTargets] = useState([]);
  const [editPlatforms, setEditPlatforms] = useState([]);
  const [editFacebookPages, setEditFacebookPages] = useState([]);
  const [editLinkedInTargets, setEditLinkedInTargets] = useState([]);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [expandedReportPostId, setExpandedReportPostId] = useState('');
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [draftUploading, setDraftUploading] = useState(false);
  const editFileInputRef = useRef(null);
  const draftFileInputRef = useRef(null);

  const normalizeMediaUrl = useCallback((rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:image/')) return raw;
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.pathname.startsWith('/uploads/')) return `${API}${parsed.pathname}`;
      return parsed.href;
    } catch {
      if (raw.startsWith('/uploads/')) return `${API}${raw}`;
      return raw;
    }
  }, []);

  const renderTemplateWithBase = useCallback(async ({ templateId, baseImageSource, nameSuffix = 'calendar' }) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) throw new Error('Selected template not found');

    const normalizedLayers = (template.layers || []).map((layer) => {
      if (layer.type === 'image' && layer.src) {
        return { ...layer, src: normalizeMediaUrl(layer.src) };
      }
      return layer;
    });

    const res = await axios.post(`${API}/api/pple/render`, {
      baseImageUrl: normalizeMediaUrl(baseImageSource || ''),
      layers: normalizedLayers,
      outputWidth: template.canvas_width || 1080,
      outputHeight: template.canvas_height || 1080,
      name: `${template.name || 'template'}_${nameSuffix}`,
    });

    const renderedUrl = normalizeMediaUrl(res.data?.image?.preview_url || res.data?.image?.local_url || res.data?.image?.url || '');
    if (!renderedUrl) throw new Error('No image URL in render response');
    return renderedUrl;
  }, [savedTemplates, normalizeMediaUrl]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  useEffect(() => { onLoadMonth(year, month); }, [year, month, onLoadMonth]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await axios.get(`${API}/api/pple/templates`);
        setSavedTemplates(res.data?.templates || []);
      } catch {
        setSavedTemplates([]);
      }
    };
    loadTemplates();
  }, []);

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const postsByDay = {};
  posts.forEach(post => {
    const d = new Date(post.scheduled_at || post.created_at);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === d;
  };

  const selectedDayPosts = selectedDay ? (postsByDay[selectedDay] || []) : [];

  const schedulablePlatforms = platforms
    .filter((platform) => connectedPlatforms.includes(platform.id))
    .map((platform) => platform.id);

  useEffect(() => {
    if (schedulablePlatforms.length > 0 && draftPlatforms.length === 0) {
      setDraftPlatforms([schedulablePlatforms[0]]);
    }
  }, [draftPlatforms.length, schedulablePlatforms]);

  useEffect(() => {
    if (draftPlatforms.includes('facebook') && !facebookPagesLoading && facebookPages.length === 0) {
      onLoadFacebookPages?.();
    }
    if (!draftPlatforms.includes('facebook')) {
      setDraftFacebookPages([]);
    }
  }, [draftPlatforms, facebookPages.length, facebookPagesLoading, onLoadFacebookPages]);

  useEffect(() => {
    if (draftPlatforms.includes('linkedin') && !linkedInTargetsLoading && linkedInTargets.length === 0) {
      onLoadLinkedInTargets?.();
    }
    if (!draftPlatforms.includes('linkedin')) {
      setDraftLinkedInTargets([]);
    }
  }, [draftPlatforms, linkedInTargets.length, linkedInTargetsLoading, onLoadLinkedInTargets]);

  useEffect(() => {
    if (editPlatforms.includes('facebook') && !facebookPagesLoading && facebookPages.length === 0) {
      onLoadFacebookPages?.();
    }
    if (!editPlatforms.includes('facebook')) {
      setEditFacebookPages([]);
    }
  }, [editPlatforms, facebookPages.length, facebookPagesLoading, onLoadFacebookPages]);

  useEffect(() => {
    if (editPlatforms.includes('linkedin') && !linkedInTargetsLoading && linkedInTargets.length === 0) {
      onLoadLinkedInTargets?.();
    }
    if (!editPlatforms.includes('linkedin')) {
      setEditLinkedInTargets([]);
    }
  }, [editPlatforms, linkedInTargets.length, linkedInTargetsLoading, onLoadLinkedInTargets]);

  const statusColor = (status) =>
    status === 'published' || status === 'partial' ? '#4ade80'
    : status === 'scheduled' ? '#6366f1'
    : status === 'failed' ? '#f87171'
    : '#888';

  const toggleDraftPlatform = (platformId) => {
    setDraftPlatforms((prev) => (
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    ));
  };

  const toggleEditPlatform = (platformId) => {
    setEditPlatforms((prev) => (
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    ));
  };

  const appendEditMediaUrls = (urls) => {
    const incoming = (urls || []).map((value) => String(value || '').trim()).filter(Boolean);
    if (incoming.length === 0) return;
    setEditMediaUrls((prev) => {
      const current = String(prev || '').split('\n').map((value) => value.trim()).filter(Boolean);
      return Array.from(new Set([...current, ...incoming])).join('\n');
    });
  };

  const uploadDraftFiles = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const formData = new FormData();
    list.forEach((file) => formData.append('files', file));
    setDraftUploading(true);
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      setDraftMediaUrls((prev) => {
        const current = String(prev || '').split('\n').map((v) => v.trim()).filter(Boolean);
        return Array.from(new Set([...current, ...uploadedUrls])).join('\n');
      });
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to upload images');
    }
    setDraftUploading(false);
  };

  const uploadEditFiles = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    const formData = new FormData();
    list.forEach((file) => formData.append('files', file));

    setEditUploading(true);
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      appendEditMediaUrls(uploadedUrls);
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to upload images for scheduled post');
    }
    setEditUploading(false);
  };

  const handleQuickSchedule = async () => {
    if (!selectedDay) return;
    if (!draftContent.trim()) {
      onError?.('Please add content before scheduling');
      return;
    }
    if (draftPlatforms.length === 0) {
      onError?.('Select at least one schedulable platform');
      return;
    }
    if (draftPlatforms.includes('facebook') && draftFacebookPages.length === 0) {
      onError?.('Select at least one Facebook Page');
      return;
    }
    if (draftPlatforms.includes('linkedin') && draftLinkedInTargets.length === 0) {
      onError?.('Select at least one LinkedIn target');
      return;
    }

    const date = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const scheduledAt = `${date}T${draftTime}:00`;
    if (new Date(scheduledAt) <= new Date()) {
      onError?.('Please choose a future date/time for scheduling');
      return;
    }

    setSavingDraft(true);
    try {
      let mediaUrls = draftMediaUrls.split('\n').map((value) => value.trim()).filter(Boolean);
      if (draftTemplateId) {
        const baseImageSource = normalizeMediaUrl(mediaUrls[0] || '');
        if (!baseImageSource) {
          onError?.('Provide at least one base image URL to apply the selected template.');
          setSavingDraft(false);
          return;
        }
        const renderedUrl = await renderTemplateWithBase({
          templateId: draftTemplateId,
          baseImageSource,
          nameSuffix: `calendar_${date}`,
        });
        mediaUrls = [renderedUrl];
        setDraftMediaUrls(renderedUrl);
      }

      const response = await axios.post(`${API}/api/posts`, {
        content: draftContent,
        platforms: draftPlatforms,
        media_urls: mediaUrls,
        scheduled_at: scheduledAt,
        facebook_page_ids: draftPlatforms.includes('facebook') ? draftFacebookPages : [],
        linkedin_target_ids: draftPlatforms.includes('linkedin') ? draftLinkedInTargets : [],
        generation_source: 'calendar',
        generation_batch_id: `calendar-${Date.now()}`,
        generation_index: 1,
        generation_total: 1,
      });

      if (response.data?.scheduled) {
        onScheduled?.();
        await onLoadMonth(year, month);
        setDraftContent('');
        setDraftMediaUrls('');
      } else {
        onError?.('Post was created but not scheduled. Please retry.');
      }
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to schedule post from calendar');
    }
    setSavingDraft(false);
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content || '');
    setEditMediaUrls((post.media_urls || []).join('\n'));
    const date = new Date(post.scheduled_at || post.created_at);
    setEditDate(date.toISOString().slice(0, 10));
    setEditTime(date.toTimeString().slice(0, 5));
    setEditPlatforms(post.platforms || []);
    setEditFacebookPages(post.facebook_page_ids || []);
    setEditLinkedInTargets(post.linkedin_target_ids || []);
  };

  const cancelEditPost = () => {
    setEditingPostId('');
    setEditContent('');
    setEditMediaUrls('');
    setEditDate('');
    setEditTime('10:00');
    setEditPlatforms([]);
    setEditFacebookPages([]);
    setEditLinkedInTargets([]);
  };

  const saveEditedPost = async (post) => {
    if (!editContent.trim()) return onError?.('Content is required');
    if (!editDate || !editTime) return onError?.('Date and time are required');
    if (editPlatforms.length === 0) return onError?.('Select at least one platform');
    if (editPlatforms.includes('facebook') && editFacebookPages.length === 0) return onError?.('Select at least one Facebook Page');
    if (editPlatforms.includes('linkedin') && editLinkedInTargets.length === 0) return onError?.('Select at least one LinkedIn target');

    const scheduledAt = `${editDate}T${editTime}:00`;
    if (new Date(scheduledAt) <= new Date()) {
      return onError?.('Please select a future time for rescheduling');
    }

    setEditingSaving(true);
    try {
      await axios.put(`${API}/api/posts/${post.id}`, {
        content: editContent,
        media_urls: editMediaUrls.split('\n').map((v) => v.trim()).filter(Boolean),
        platforms: editPlatforms,
        scheduled_at: scheduledAt,
        facebook_page_ids: editPlatforms.includes('facebook') ? editFacebookPages : [],
        linkedin_target_ids: editPlatforms.includes('linkedin') ? editLinkedInTargets : [],
      });
      await onLoadMonth(year, month);
      onNotify?.('Scheduled post updated');
      cancelEditPost();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to update scheduled post');
    }
    setEditingSaving(false);
  };

  const deleteScheduledPost = async (postId) => {
    if (!window.confirm('Delete this scheduled post?')) return;

    try {
      await axios.delete(`${API}/api/posts/${postId}`);
      await onLoadMonth(year, month);
      onNotify?.('Scheduled post deleted');
      if (editingPostId === postId) cancelEditPost();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to delete scheduled post');
    }
  };

  const postNowScheduled = async (postId) => {
    try {
      await axios.post(`${API}/api/posts/${postId}/post-now`);
      await onLoadMonth(year, month);
      onScheduled?.();
      onNotify?.('Scheduled post published now');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to publish post now');
    }
  };

  const hasReport = (post) => (post.platform_results || []).filter(Boolean).length > 0;
  const hasMedia = (post) => Array.isArray(post.media_urls) && post.media_urls.length > 0;
  const getDayContentSummary = (dayPosts) => ({
    imageCount: dayPosts.filter(hasMedia).length,
    textCount: dayPosts.filter((post) => !hasMedia(post)).length,
  });

  return (
    <div style={styles.calendarWrap}>
      <div style={styles.calendarHeaderRow}>
        <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Content Calendar</h2>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <button style={styles.calNavBtn} onClick={prevMonth}>‹</button>
          <span style={{ color: '#fff', fontWeight: 700, minWidth: 140, textAlign: 'center' }}>{monthName} {year}</span>
          <button style={styles.calNavBtn} onClick={nextMonth}>›</button>
        </div>
      </div>

      <div style={styles.settingsCard}>
        <div style={styles.calGrid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={styles.calDayHeader}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const dayPosts = postsByDay[day] || [];
            const { imageCount, textCount } = getDayContentSummary(dayPosts);

            return (
              <div
                key={i}
                style={{
                  ...styles.calDay,
                  background: day === selectedDay ? '#1a1a3e' : isToday(day) ? '#12122a' : 'transparent',
                  border: isToday(day) ? '1px solid #6366f1' : '1px solid #1a1a2e',
                  cursor: day ? 'pointer' : 'default',
                  opacity: day ? 1 : 0,
                }}
                onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
              >
                {day && (
                  <>
                    <div style={styles.calDayTopRow}>
                      <span style={{ color: isToday(day) ? '#a78bfa' : '#888', fontSize: 13, fontWeight: 700 }}>{day}</span>
                      {dayPosts.length > 0 && (
                        <span style={styles.calDayCount}>{dayPosts.length} post{dayPosts.length === 1 ? '' : 's'}</span>
                      )}
                    </div>
                    <div style={styles.calTypeRow}>
                      {imageCount > 0 && <span style={{ ...styles.calTypeBadge, ...styles.calTypeImage }}>Image {imageCount}</span>}
                      {textCount > 0 && <span style={{ ...styles.calTypeBadge, ...styles.calTypeText }}>Text {textCount}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
                      {dayPosts.slice(0, 6).map((p, j) => (
                        <span key={j} style={{ ...styles.calDot, background: statusColor(p.status) }} />
                      ))}
                      {dayPosts.length > 6 && (
                        <span style={{ color: '#6b7280', fontSize: 10, fontWeight: 700 }}>+{dayPosts.length - 6}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div style={styles.settingsCard}>
          <h3 style={{ ...styles.settingsSubtitle, marginBottom: 12 }}>
            {monthName} {selectedDay} — {selectedDayPosts.length} post(s)
          </h3>

          <div style={styles.calEditorCard}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Quick Schedule on {monthName} {selectedDay}</div>
            <div style={{ marginBottom: 8 }}>
              <TopicSuggestionPanel
                niche=""
                category=""
                tone="professional"
                onSelect={(t) => setDraftContent((prev) => prev ? prev + '\n\n' + t : t)}
              />
            </div>
            <textarea
              style={{ ...styles.textarea, minHeight: 100, fontSize: 13 }}
              placeholder="Write content for this date..."
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
            />
            <textarea
              style={{ ...styles.textarea, minHeight: 70, fontSize: 12, marginTop: 8 }}
              placeholder="Image URLs (optional, one per line)"
              value={draftMediaUrls}
              onChange={(e) => setDraftMediaUrls(e.target.value)}
            />
            <input
              ref={draftFileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { uploadDraftFiles(e.target.files); e.target.value = ''; }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => draftFileInputRef.current?.click()}
                disabled={draftUploading}
              >
                {draftUploading ? 'Uploading...' : '⬆ Upload Image'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, marginTop: 8 }}>
              <label style={styles.aiLabel}>Template overlay (optional)</label>
              <select style={styles.aiSelect} value={draftTemplateId} onChange={(e) => setDraftTemplateId(e.target.value)}>
                <option value="">No template overlay</option>
                {savedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
                <label style={styles.aiLabel}>Time</label>
                <input
                  type="time"
                  style={styles.datetimeInput}
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                  step="60"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
                <label style={styles.aiLabel}>Platforms</label>
                <PlatformPicker platformIds={schedulablePlatforms} selectedPlatforms={draftPlatforms} onToggle={toggleDraftPlatform} />
              </div>
              <FacebookPagesPicker
                visible={draftPlatforms.includes('facebook')}
                pages={facebookPages}
                selectedPageIds={draftFacebookPages}
                loading={facebookPagesLoading}
                onRefresh={onLoadFacebookPages}
                onToggle={(pageId) => setDraftFacebookPages((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId])}
              />
              <LinkedInTargetsPicker
                visible={draftPlatforms.includes('linkedin')}
                targets={linkedInTargets}
                selectedTargetIds={draftLinkedInTargets}
                loading={linkedInTargetsLoading}
                onRefresh={onLoadLinkedInTargets}
                onToggle={(targetId) => setDraftLinkedInTargets((prev) => prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId])}
              />
              {schedulablePlatforms.length === 0 && (
                <span style={{ color: '#f87171', fontSize: 12 }}>
                  Connect at least one platform to use quick schedule here.
                </span>
              )}

              <button
                style={{ ...styles.scheduleSubmitBtn, opacity: savingDraft ? 0.7 : 1 }}
                onClick={handleQuickSchedule}
                disabled={savingDraft || schedulablePlatforms.length === 0}
              >
                {savingDraft ? <><Spinner /> Scheduling...</> : '📅 Save to Calendar'}
              </button>
            </div>
          </div>

          {selectedDayPosts.length === 0 ? (
            <p style={{ color: '#555', fontSize: 14 }}>No posts for this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedDayPosts.map(post => (
                <div key={post.id} style={styles.historyCard}>
                  {editingPostId === post.id ? (
                    <>
                      <textarea
                        style={{ ...styles.textarea, minHeight: 90, fontSize: 13 }}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <textarea
                        style={{ ...styles.textarea, minHeight: 60, fontSize: 12, marginTop: 8 }}
                        value={editMediaUrls}
                        onChange={(e) => setEditMediaUrls(e.target.value)}
                        placeholder="Image URLs (one per line)"
                      />
                      <input
                        ref={editFileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => uploadEditFiles(e.target.files)}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={styles.secondaryBtn}
                          onClick={() => editFileInputRef.current?.click()}
                          disabled={editUploading}
                        >
                          {editUploading ? 'Uploading images...' : 'Upload Images for This Scheduled Post'}
                        </button>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label style={styles.aiLabel}>Platforms</label>
                        <PlatformPicker platformIds={schedulablePlatforms} selectedPlatforms={editPlatforms} onToggle={toggleEditPlatform} />
                      </div>
                      <FacebookPagesPicker
                        visible={editPlatforms.includes('facebook')}
                        pages={facebookPages}
                        selectedPageIds={editFacebookPages}
                        loading={facebookPagesLoading}
                        onRefresh={onLoadFacebookPages}
                        onToggle={(pageId) => setEditFacebookPages((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId])}
                      />
                      <LinkedInTargetsPicker
                        visible={editPlatforms.includes('linkedin')}
                        targets={linkedInTargets}
                        selectedTargetIds={editLinkedInTargets}
                        loading={linkedInTargetsLoading}
                        onRefresh={onLoadLinkedInTargets}
                        onToggle={(targetId) => setEditLinkedInTargets((prev) => prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId])}
                      />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                        <input type="date" style={styles.datetimeInput} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                        <input type="time" style={styles.datetimeInput} value={editTime} onChange={(e) => setEditTime(e.target.value)} step="60" />
                        <button style={styles.primaryBtn} onClick={() => saveEditedPost(post)} disabled={editingSaving}>
                          {editingSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button style={styles.secondaryBtn} onClick={cancelEditPost}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ color: '#ddd', fontSize: 13, margin: '0 0 8px', lineHeight: 1.6 }}>
                        {post.content?.substring(0, 200)}{post.content?.length > 200 ? '…' : ''}
                      </p>
                      <div style={styles.calPostMetaRow}>
                        <span style={{ ...styles.calTypeBadge, ...(hasMedia(post) ? styles.calTypeImage : styles.calTypeText) }}>
                          {hasMedia(post) ? `Image post${post.media_urls.length > 1 ? ` (${post.media_urls.length})` : ''}` : 'Text post'}
                        </span>
                        {renderGenerationBadges(post)}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: statusColor(post.status) + '20',
                          color: statusColor(post.status),
                          border: `1px solid ${statusColor(post.status)}40`
                        }}>{post.status}</span>
                        {(post.platforms || []).map(pl => (
                          <span key={pl} style={{ color: PLATFORM_META[pl]?.color || '#888', fontSize: 11 }}>
                            {PLATFORM_META[pl]?.name || pl}
                          </span>
                        ))}
                        <span style={{ color: '#444', fontSize: 11, marginLeft: 'auto' }}>
                          {new Date(post.scheduled_at || post.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {post.status === 'scheduled' && (
                          <>
                            <button style={styles.secondaryBtn} onClick={() => startEditPost(post)}>Edit / Reschedule</button>
                            <button style={styles.secondaryBtn} onClick={() => postNowScheduled(post.id)}>Post Now</button>
                            <button style={{ ...styles.secondaryBtn, borderColor: '#7f1d1d', color: '#fecaca' }} onClick={() => deleteScheduledPost(post.id)}>Delete</button>
                          </>
                        )}
                        {['draft', 'failed'].includes(post.status) && (
                          <button style={styles.secondaryBtn} onClick={() => postNowScheduled(post.id)}>Post Now</button>
                        )}
                        {(hasReport(post) || ['failed', 'partial'].includes(post.status)) && (
                          <button style={styles.secondaryBtn} onClick={() => setExpandedReportPostId((prev) => prev === post.id ? '' : post.id)}>
                            {expandedReportPostId === post.id ? 'Hide Report' : 'View Report'}
                          </button>
                        )}
                      </div>
                      {expandedReportPostId === post.id && <PlatformReport post={post} />}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ ...styles.settingsCard, background: 'transparent', border: 'none', padding: '8px 0' }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[{ color: '#4ade80', label: 'Published' }, { color: '#6366f1', label: 'Scheduled' }, { color: '#f87171', label: 'Failed' }, { color: '#888', label: 'Draft' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ ...styles.calDot, background: color }} />
              <span style={{ color: '#666', fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Schedule View (extracted from AI Workflow) ─────────────────────────────
function ScheduleView({
  platforms,
  connectedPlatforms,
  connectedAccountDetails,
  facebookPages,
  facebookPagesLoading,
  onLoadFacebookPages,
  linkedInTargets,
  linkedInTargetsLoading,
  onLoadLinkedInTargets,
  aiProviders,
  onConnect,
  onNotify,
  onError,
  onScheduled
}) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState('');
  const [days, setDays] = useState('7');
  const [aiProvider, setAiProvider] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [items, setItems] = useState([]);
  
  const textProviders = aiProviders.filter((provider) => provider.hasText !== false);
  
  const togglePlatform = (id) => {
    if (!connectedPlatforms.includes(id)) return;
    setSelectedPlatforms((prev) =>
      prev.includes(id)
        ? prev.filter((platformId) => platformId !== id)
        : [...prev, id]
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{...styles.composeCard, margin: 0}}>
        <h2 style={styles.sectionTitle}>Schedule Posts</h2>
        <p style={styles.sectionSubtitle}>Generate and schedule multiple posts for your selected platforms</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select style={styles.aiSelect} value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="professional">Professional Tone</option>
            <option value="casual">Casual Tone</option>
            <option value="educational">Educational Tone</option>
            <option value="inspirational">Inspirational Tone</option>
          </select>
          <input style={styles.aiInput} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche" />
          <input style={styles.aiInput} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
          <input style={styles.aiInput} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic / Campaign Theme" />
        </div>
        
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <TopicSuggestionPanel niche={niche} category={category} tone={tone} onSelect={(t) => setTopic(t)} />
        </div>
        
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <select style={{...styles.aiSelect, flex: 1}} value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="3">3 Days</option>
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
          </select>
          <select style={styles.aiSelect} value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
            <option value="">AI Provider: Auto</option>
            {textProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
          <button style={styles.primaryBtn} onClick={() => onNotify('Schedule generation coming soon')} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>
        
        <div style={{ marginTop: 12, padding: 12, background: '#0a0a12', borderRadius: 8, color: '#64748b', fontSize: 12 }}>
          This view will contain the AI Workflow scheduling functionality to batch-generate and schedule posts across multiple days.
        </div>
      </div>
    </div>
  );
}

// ─── (Removed) AI Monitor View ─────────────────────────────────────────────────
// MonitorView function has been removed as per requirements
// ────────────────────────────────────────────────────────────────────────────

// ─── Library View ─────────────────────────────────────────────────────────────
function LibraryView({ posts, onRefresh, platforms = [], connectedPlatforms = [], facebookPages = [], facebookPagesLoading = false, onLoadFacebookPages, linkedInTargets = [], linkedInTargetsLoading = false, onLoadLinkedInTargets, onError, onNotify }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [expandedReportPostId, setExpandedReportPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMediaUrls, setEditMediaUrls] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('10:00');
  const [editPlatforms, setEditPlatforms] = useState([]);
  const [editFacebookPages, setEditFacebookPages] = useState([]);
  const [editLinkedInTargets, setEditLinkedInTargets] = useState([]);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef(null);

  useEffect(() => { onRefresh(); }, [onRefresh]);

  const editablePlatforms = platforms.filter((platform) => connectedPlatforms.includes(platform.id)).map((platform) => platform.id);

  useEffect(() => {
    if (editPlatforms.includes('facebook') && !facebookPagesLoading && facebookPages.length === 0) {
      onLoadFacebookPages?.();
    }
    if (!editPlatforms.includes('facebook')) {
      setEditFacebookPages([]);
    }
  }, [editPlatforms, facebookPages.length, facebookPagesLoading, onLoadFacebookPages]);

  useEffect(() => {
    if (editPlatforms.includes('linkedin') && !linkedInTargetsLoading && linkedInTargets.length === 0) {
      onLoadLinkedInTargets?.();
    }
    if (!editPlatforms.includes('linkedin')) {
      setEditLinkedInTargets([]);
    }
  }, [editPlatforms, linkedInTargets.length, linkedInTargetsLoading, onLoadLinkedInTargets]);

  const allPlatforms = [...new Set(posts.flatMap(p => p.platforms || []))];

  const filtered = posts.filter(post => {
    if (statusFilter !== 'all' && post.status !== statusFilter) return false;
    if (platformFilter !== 'all' && !(post.platforms || []).includes(platformFilter)) return false;
    if (search && !post.content?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const copyToClipboard = (text) => { navigator.clipboard?.writeText(text).catch(() => {}); };

  const toggleEditPlatform = (platformId) => {
    setEditPlatforms((prev) => (
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    ));
  };

  const appendEditMediaUrls = (urls) => {
    const incoming = (urls || []).map((value) => String(value || '').trim()).filter(Boolean);
    if (incoming.length === 0) return;
    setEditMediaUrls((prev) => {
      const current = String(prev || '').split('\n').map((value) => value.trim()).filter(Boolean);
      return Array.from(new Set([...current, ...incoming])).join('\n');
    });
  };

  const uploadEditFiles = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    const formData = new FormData();
    list.forEach((file) => formData.append('files', file));

    setEditUploading(true);
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      appendEditMediaUrls(uploadedUrls);
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to upload images for scheduled post');
    }
    setEditUploading(false);
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content || '');
    setEditMediaUrls((post.media_urls || []).join('\n'));
    const date = new Date(post.scheduled_at || post.created_at);
    setEditDate(date.toISOString().slice(0, 10));
    setEditTime(date.toTimeString().slice(0, 5));
    setEditPlatforms(post.platforms || []);
    setEditFacebookPages(post.facebook_page_ids || []);
    setEditLinkedInTargets(post.linkedin_target_ids || []);
  };

  const cancelEditPost = () => {
    setEditingPostId('');
    setEditContent('');
    setEditMediaUrls('');
    setEditDate('');
    setEditTime('10:00');
    setEditPlatforms([]);
    setEditFacebookPages([]);
    setEditLinkedInTargets([]);
  };

  const saveEditedPost = async (post) => {
    if (post.status !== 'scheduled') return onError?.('Only scheduled posts can be edited/rescheduled');
    if (!editContent.trim()) return onError?.('Content is required');
    if (!editDate || !editTime) return onError?.('Date and time are required');
    if (editPlatforms.length === 0) return onError?.('Select at least one platform');
    if (editPlatforms.includes('facebook') && editFacebookPages.length === 0) return onError?.('Select at least one Facebook Page');
    if (editPlatforms.includes('linkedin') && editLinkedInTargets.length === 0) return onError?.('Select at least one LinkedIn target');

    const scheduledAt = `${editDate}T${editTime}:00`;
    if (new Date(scheduledAt) <= new Date()) {
      return onError?.('Please select a future time for rescheduling');
    }

    setEditingSaving(true);
    try {
      await axios.put(`${API}/api/posts/${post.id}`, {
        content: editContent,
        media_urls: editMediaUrls.split('\n').map((value) => value.trim()).filter(Boolean),
        platforms: editPlatforms,
        scheduled_at: scheduledAt,
        facebook_page_ids: editPlatforms.includes('facebook') ? editFacebookPages : [],
        linkedin_target_ids: editPlatforms.includes('linkedin') ? editLinkedInTargets : [],
      });
      await onRefresh();
      onNotify?.('Scheduled post updated');
      cancelEditPost();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to update scheduled post');
    }
    setEditingSaving(false);
  };

  const postNow = async (postId) => {
    try {
      await axios.post(`${API}/api/posts/${postId}/post-now`);
      await onRefresh();
      onNotify?.('Post published now');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to publish post now');
    }
  };

  const deleteScheduledPost = async (postId) => {
    if (!window.confirm('Delete this scheduled post?')) return;
    try {
      await axios.delete(`${API}/api/posts/${postId}`);
      await onRefresh();
      onNotify?.('Scheduled post deleted');
      if (editingPostId === postId) cancelEditPost();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to delete scheduled post');
    }
  };

  const statusColor = (status) =>
    status === 'published' || status === 'partial' ? '#4ade80'
    : status === 'scheduled' ? '#a78bfa'
    : status === 'failed' ? '#f87171'
    : '#888';

  return (
    <div style={styles.settingsWrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Content Library</h2>
        <button style={{ ...styles.secondaryBtn, marginLeft: 'auto', padding: '8px 14px' }} onClick={onRefresh}>Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ ...styles.input, flex: 1, minWidth: 180 }}
          placeholder="Search posts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={{ ...styles.input, width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All status</option>
          <option value="published">Published</option>
          <option value="partial">Partial</option>
          <option value="scheduled">Scheduled</option>
          <option value="failed">Failed</option>
        </select>
        <select style={{ ...styles.input, width: 'auto' }} value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
          <option value="all">All platforms</option>
          {allPlatforms.map(p => <option key={p} value={p}>{PLATFORM_META[p]?.name || p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48 }}>📚</div>
          <p style={{ color: '#555', marginTop: 12 }}>No posts match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(post => (
            <div key={post.id} style={styles.historyCard}>
              {editingPostId === post.id ? (
                <>
                  <textarea style={{ ...styles.textarea, minHeight: 100, fontSize: 13 }} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                  <textarea style={{ ...styles.textarea, minHeight: 60, fontSize: 12, marginTop: 8 }} value={editMediaUrls} onChange={(e) => setEditMediaUrls(e.target.value)} placeholder="Image URLs (one per line)" />
                  <input
                    ref={editFileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => uploadEditFiles(e.target.files)}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={editUploading}
                    >
                      {editUploading ? 'Uploading images...' : 'Upload Images for This Scheduled Post'}
                    </button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={styles.aiLabel}>Platforms</label>
                    <PlatformPicker platformIds={editablePlatforms} selectedPlatforms={editPlatforms} onToggle={toggleEditPlatform} />
                  </div>
                  <FacebookPagesPicker
                    visible={editPlatforms.includes('facebook')}
                    pages={facebookPages}
                    selectedPageIds={editFacebookPages}
                    loading={facebookPagesLoading}
                    onRefresh={onLoadFacebookPages}
                    onToggle={(pageId) => setEditFacebookPages((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId])}
                  />
                  <LinkedInTargetsPicker
                    visible={editPlatforms.includes('linkedin')}
                    targets={linkedInTargets}
                    selectedTargetIds={editLinkedInTargets}
                    loading={linkedInTargetsLoading}
                    onRefresh={onLoadLinkedInTargets}
                    onToggle={(targetId) => setEditLinkedInTargets((prev) => prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId])}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    <input type="date" style={styles.datetimeInput} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                    <input type="time" style={styles.datetimeInput} value={editTime} onChange={(e) => setEditTime(e.target.value)} step="60" />
                    <button style={styles.primaryBtn} onClick={() => saveEditedPost(post)} disabled={editingSaving}>{editingSaving ? 'Saving...' : 'Save'}</button>
                    <button style={styles.secondaryBtn} onClick={cancelEditPost}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ color: '#ddd', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
                    {post.content?.substring(0, 300)}{post.content?.length > 300 ? '…' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: statusColor(post.status) + '20',
                      color: statusColor(post.status),
                      border: `1px solid ${statusColor(post.status)}40`
                    }}>{post.status}</span>
                    {(post.platforms || []).map(pl => (
                      <span key={pl} style={{ color: PLATFORM_META[pl]?.color || '#888', fontSize: 11, fontWeight: 600 }}>
                        {PLATFORM_META[pl]?.name || pl}
                      </span>
                    ))}
                    {renderGenerationBadges(post)}
                    {post.scheduled_at && (
                      <span style={{ color: '#a78bfa', fontSize: 11 }}>
                        📅 {new Date(post.scheduled_at).toLocaleString()}
                      </span>
                    )}
                    <span style={{ color: '#444', fontSize: 11, marginLeft: 'auto' }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <button style={styles.reuseBtn} onClick={() => copyToClipboard(post.content)} title="Copy to clipboard">
                      📋 Copy
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {post.status === 'scheduled' && <button style={styles.secondaryBtn} onClick={() => startEditPost(post)}>Edit / Reschedule</button>}
                    {['scheduled', 'draft', 'failed'].includes(post.status) && <button style={styles.secondaryBtn} onClick={() => postNow(post.id)}>Post Now</button>}
                    {(post.platform_results || []).filter(Boolean).length > 0 && (
                      <button style={styles.secondaryBtn} onClick={() => setExpandedReportPostId((prev) => prev === post.id ? '' : post.id)}>
                        {expandedReportPostId === post.id ? 'Hide Report' : 'View Report'}
                      </button>
                    )}
                    {post.status === 'scheduled' && <button style={{ ...styles.secondaryBtn, borderColor: '#7f1d1d', color: '#fecaca' }} onClick={() => deleteScheduledPost(post.id)}>Delete</button>}
                  </div>
                  {expandedReportPostId === post.id && <PlatformReport post={post} />}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings View ─────────────────────────────────────────────────────────────
function SettingsView({ platforms, connectedPlatforms, connectedAccountDetails, onConnect, onDisconnect, user, onProfileSave, aiProviders = [], onRefreshAiProviders, theme = 'dark', onThemeChange }) {
  const [name, setName] = useState(user.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [aiTestProvider, setAiTestProvider] = useState('gemini');
  const [aiTestPrompt, setAiTestPrompt] = useState('Reply with one short sentence confirming the API key is working.');
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState('');
  const [aiTestError, setAiTestError] = useState('');
  const [aiTestProviderName, setAiTestProviderName] = useState('');
  const [tunnelStatus, setTunnelStatus] = useState(null);
  const textProviders = aiProviders.filter((provider) => provider.hasText !== false);

  useEffect(() => {
    setName(user.name || '');
    setAvatarUrl(user.avatar_url || '');
  }, [user]);

  useEffect(() => {
    axios.get(`${API}/api/media/tunnel-status`)
      .then(r => setTunnelStatus(r.data))
      .catch(() => setTunnelStatus({ active: false, tunnel_url: null, message: 'Could not reach backend.' }));
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    onProfileSave({ name, avatar_url: avatarUrl.trim() || null });
  };

  const handleAiTest = async () => {
    setAiTesting(true);
    setAiTestResult('');
    setAiTestError('');
    setAiTestProviderName('');

    try {
      const res = await axios.post(`${API}/api/ai/test`, {
        provider: aiTestProvider,
        prompt: aiTestPrompt.trim() || 'Reply with one short sentence confirming the API key is working.'
      });
      setAiTestProviderName(res.data.provider_name || aiTestProvider);
      setAiTestResult(res.data.text || 'The provider responded successfully.');
      if (onRefreshAiProviders) await onRefreshAiProviders();
    } catch (e) {
      setAiTestError(e.response?.data?.error || 'AI provider test failed');
    }

    setAiTesting(false);
  };

  return (
    <div style={styles.settingsWrap}>
      <h2 style={styles.sectionTitle}>Settings</h2>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Appearance</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { id: 'dark',  label: 'Dark',  swatches: ['#0a0a12', '#0f0f1e', '#1a1a2e'] },
            { id: 'dim',   label: 'Dim',   swatches: ['#111827', '#1a2236', '#2d3a50'] },
            { id: 'light', label: 'Light', swatches: ['#f0f4f8', '#ffffff', '#dde3ec'] },
          ].map(({ id, label, swatches }) => (
            <button
              key={id}
              onClick={() => onThemeChange(id)}
              style={{
                flex: 1,
                padding: '14px 10px',
                border: `2px solid ${theme === id ? '#6366f1' : 'var(--border-soft)'}`,
                borderRadius: 12,
                background: theme === id ? 'rgba(99,102,241,0.08)' : 'var(--bg-deep)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                {swatches.map((c, i) => (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: '1px solid rgba(128,128,128,0.25)' }} />
                ))}
              </div>
              <span style={{ color: theme === id ? '#6366f1' : 'var(--text-muted)', fontSize: 13, fontWeight: theme === id ? 700 : 500 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Account</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
            : <div style={styles.avatar}>{user.name?.[0]?.toUpperCase()}</div>
          }
          <div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{user.name}</div>
            <div style={{ color: '#555', fontSize: 13 }}>{user.email}</div>
          </div>
        </div>

        <form onSubmit={handleSave} style={styles.profileForm}>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
          />
          <input
            style={styles.input}
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Avatar URL (optional)"
          />
          <button type="submit" style={styles.primaryBtn}>Save Profile</button>
        </form>
      </div>

      <MetaTokenHealth onConnect={onConnect} />

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Connected Platforms</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {platforms.map(p => {
            const meta = PLATFORM_META[p.id];
            const connected = connectedPlatforms.includes(p.id);
            const accountInfo = connectedAccountDetails[p.id];
            return (
              <div key={p.id} style={styles.platformRow2}>
                <meta.icon size={22} color={meta.color} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#ddd', fontWeight: 600, display: 'block' }}>{meta.name}</span>
                  {connected && accountInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      {accountInfo.platform_avatar_url && (
                        <img src={accountInfo.platform_avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                      )}
                      <span style={{ color: '#4ade80', fontSize: 12 }}>
                        {accountInfo.platform_username || accountInfo.platform_display_name || 'Connected'}
                      </span>
                    </div>
                  )}
                </div>
                {connected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#4ade80', fontSize: 13 }}>● Connected</span>
                    <button style={styles.disconnectBtn} onClick={() => onDisconnect(p.id)}>
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button style={{ ...styles.connectBtnSmall, borderColor: meta.color }}
                    onClick={() => onConnect(p.id)}>
                    <span style={{ color: meta.color }}>Connect</span>
                  </button>
                )}
              </div>
            );
          })}

          {/* LinkedIn Pages — separate App 2 connection for company page posting */}
          {(() => {
            const meta = PLATFORM_META['linkedin_page'];
            const connected = connectedPlatforms.includes('linkedin_page');
            const accountInfo = connectedAccountDetails['linkedin_page'];
            return (
              <div style={{ ...styles.platformRow2, borderTop: '1px solid #1a1a2e', paddingTop: 12 }}>
                <meta.icon size={22} color={meta.color} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#ddd', fontWeight: 600, display: 'block' }}>{meta.name}</span>
                  <span style={{ color: '#555', fontSize: 12 }}>Company page posting (Community Management API)</span>
                  {connected && accountInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      {accountInfo.platform_avatar_url && (
                        <img src={accountInfo.platform_avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                      )}
                      <span style={{ color: '#4ade80', fontSize: 12 }}>
                        {accountInfo.platform_username || accountInfo.platform_display_name || 'Connected'}
                      </span>
                    </div>
                  )}
                </div>
                {connected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#4ade80', fontSize: 13 }}>● Connected</span>
                    <button style={styles.disconnectBtn} onClick={() => onDisconnect('linkedin_page')}>
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button style={{ ...styles.connectBtnSmall, borderColor: meta.color }}
                    onClick={() => onConnect('linkedin_page')}>
                    <span style={{ color: meta.color }}>Connect Pages</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Image Tunnel (Instagram)</h3>
        <p style={{ color: '#555', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
          Instagram requires images to be hosted at a public HTTPS URL. SocialHub uses a{' '}
          <strong style={{ color: '#aaa' }}>Cloudflare Quick Tunnel</strong> (no account needed)
          to expose locally-uploaded images automatically.
        </p>
        {tunnelStatus === null ? (
          <div style={{ color: '#666', fontSize: 13 }}>Checking tunnel…</div>
        ) : tunnelStatus.active ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: '#4ade80', fontSize: 18, lineHeight: 1.2 }}>●</span>
            <div>
              <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>Tunnel active — Instagram image posts enabled</div>
              <code style={{ ...styles.code, display: 'inline-block', marginTop: 6, fontSize: 12 }}>{tunnelStatus.tunnel_url}</code>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: '#f87171', fontSize: 18, lineHeight: 1.2 }}>●</span>
            <div>
              <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>Tunnel not active</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
                The <code style={styles.code}>cloudflared</code> service was not detected.{' '}
                Run <code style={styles.code}>docker-compose up -d cloudflared</code> or set{' '}
                <code style={styles.code}>PUBLIC_BACKEND_URL</code> manually in{' '}
                <code style={styles.code}>docker-compose.yml</code> to enable Instagram image posts.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>API Keys Setup</h3>
        <p style={{ color: '#555', fontSize: 13, lineHeight: 1.7 }}>
          To enable each platform, add your API credentials to <code style={styles.code}>docker-compose.yml</code>:
        </p>
        {[
          { p: 'Facebook', link: 'https://developers.facebook.com', key: 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET' },
          { p: 'Instagram', link: 'https://developers.facebook.com', key: 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET' },
          { p: 'LinkedIn', link: 'https://www.linkedin.com/developers/', key: 'LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET' },
          { p: 'Twitter/X', link: 'https://developer.twitter.com', key: 'TWITTER_API_KEY / TWITTER_API_SECRET' },
          { p: 'Reddit', link: 'https://www.reddit.com/prefs/apps', key: 'REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET' },
          { p: 'Pinterest', link: 'https://developers.pinterest.com', key: 'PINTEREST_APP_ID / PINTEREST_APP_SECRET' },
        ].map(({ p, link, key }) => (
          <div key={p} style={styles.apiRow}>
            <span style={{ color: '#aaa', fontWeight: 600, width: 90 }}>{p}</span>
            <code style={{ ...styles.code, flex: 1 }}>{key}</code>
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: 12 }}>
              Get keys →
            </a>
          </div>
        ))}
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>AI Providers</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
          <p style={{ color: '#555', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          Add these keys to <code style={styles.code}>docker-compose.yml</code> to enable AI content generation:
          </p>
          <button type="button" style={styles.secondaryBtn} onClick={onRefreshAiProviders}>Refresh providers</button>
        </div>
        {[
          { id: 'openai',    name: 'OpenAI GPT-4o',           key: 'OPENAI_API_KEY' },
          { id: 'gemini',    name: 'Google Gemini Flash Latest',  key: 'GEMINI_API_KEY' },
          { id: 'bigmodel',  name: 'BigModel GLM / CogView',  key: 'BIGMODEL_API_KEY' },
          { id: 'deapi',     name: 'DEAPI Flux Image',        key: 'DEAPI_API_KEY' },
          { id: 'anthropic', name: 'Anthropic Claude 3 Haiku', key: 'ANTHROPIC_API_KEY' },
          { id: 'grok',      name: 'xAI Grok (Beta)',          key: 'GROK_API_KEY' },
        ].map(({ id, name, key }) => {
          const active = aiProviders.some(p => p.id === id);
          return (
            <div key={id} style={styles.apiRow}>
              <span style={{ color: active ? '#4ade80' : '#555', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
                {active ? '●' : '○'}
              </span>
              <span style={{ color: active ? '#ddd' : '#777', fontWeight: 600, flex: 1 }}>{name}</span>
              <code style={styles.code}>{key}</code>
            </div>
          );
        })}

        <div style={styles.aiTestCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>AI text test</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Runs a real request against the selected provider using the configured API key.</div>
            </div>
            <button
              type="button"
              style={{
                ...styles.primaryBtn,
                opacity: aiTesting ? 0.7 : 1,
                cursor: aiTesting ? 'not-allowed' : 'pointer'
              }}
              onClick={handleAiTest}
              disabled={aiTesting}
            >
              {aiTesting ? 'Testing...' : 'Run Test'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 180, flex: '0 0 220px' }}>
              <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Provider</div>
              <select style={styles.input} value={aiTestProvider} onChange={(e) => setAiTestProvider(e.target.value)}>
                {textProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
                {textProviders.length === 0 && <option value="gemini">No text providers configured</option>}
              </select>
            </div>
          </div>

          <textarea
            style={{ ...styles.textarea, minHeight: 90, marginTop: 12, fontSize: 13 }}
            value={aiTestPrompt}
            onChange={(e) => setAiTestPrompt(e.target.value)}
            placeholder="Enter a short prompt to test the selected provider"
          />

          <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
            If the test returns a quota or billing error, the API key is recognized but that provider account or project still needs usable quota or billing enabled.
          </div>

          {aiTestError && (
            <div style={styles.aiTestError}>{aiTestError}</div>
          )}

          {aiTestResult && (
            <div style={styles.aiTestResult}>
              <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{aiTestProviderName || 'Provider'} response</div>
              <div style={{ color: '#d6f5dd', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{aiTestResult}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountPicker({ accounts, onSelect, onRefresh, onCreate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await onCreate({ name: name.trim(), email: email.trim(), avatarUrl: avatarUrl.trim() });
    setName('');
    setEmail('');
    setAvatarUrl('');
  };

  return (
    <div style={styles.landing}>
      <div style={styles.accountPickerWrap}>
        <div style={styles.logoGlow}>⚡</div>
        <h1 style={styles.landingTitle}>Choose an Account</h1>
        <p style={styles.landingSubtitle}>
          Start with one of the app accounts below. Each account can connect its own social profiles.
        </p>

        <div style={styles.accountGrid}>
          {accounts.map((account) => (
            <button
              key={account.id}
              style={styles.accountCard}
              onClick={() => onSelect(account.id)}
            >
              <div style={styles.avatarLg}>{account.name?.[0]?.toUpperCase()}</div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{account.name}</div>
                <div style={{ color: '#666', fontSize: 13 }}>{account.email}</div>
                <div style={{ color: '#4ade80', fontSize: 12, marginTop: 4 }}>
                  {Number(account.connected_platforms || 0)} platform(s) connected
                </div>
              </div>
              <span style={{ color: '#888', fontSize: 18 }}>→</span>
            </button>
          ))}
        </div>

        {accounts.length === 0 && (
          <div style={styles.ctaBox}>
            <p style={{ color: '#888', margin: 0, fontSize: 14 }}>No accounts found yet.</p>
          </div>
        )}

        <button style={styles.refreshBtn} onClick={onRefresh}>Refresh Accounts</button>

        <form style={styles.createAccountForm} onSubmit={handleCreate}>
          <h3 style={{ color: '#bbb', marginBottom: 10, fontSize: 14 }}>Create New Account</h3>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
          />
          <input
            style={styles.input}
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Avatar URL (optional)"
          />
          <button type="submit" style={styles.primaryBtn}>Create Account</button>
        </form>
      </div>
    </div>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────────
function LandingPage({ platforms, onConnect }) {
  return (
    <div style={styles.landing}>
      <div style={styles.landingContent}>
        <div style={styles.logoGlow}>⚡</div>
        <h1 style={styles.landingTitle}>SocialHub</h1>
        <p style={styles.landingSubtitle}>
          Connect once. Post everywhere.<br />
          All your social platforms in one place.
        </p>
        <div style={styles.platformShowcase}>
          {Object.entries(PLATFORM_META).map(([id, meta]) => (
            <button key={id} style={styles.landingPlatformBtn} onClick={() => onConnect(id)}>
              <meta.icon size={28} color={meta.color} />
              <span style={{ color: meta.color, fontSize: 12, fontWeight: 700 }}>{meta.name}</span>
            </button>
          ))}
        </div>
        <p style={{ color: '#333', fontSize: 13, marginTop: 24 }}>
          Click any platform above to sign in and get started
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ user, accounts, view, setView, onSwitchAccount, onLogout, connectedCount }) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarLogo}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <span style={styles.logoText}>SocialHub</span>
      </div>

      {user && (
        <>
          <nav style={styles.nav}>
            {[
              { id: 'compose', label: 'Compose', icon: '✏️' },
              { id: 'schedule', label: 'Schedule', icon: '📝' },
              { id: 'autopilot', label: 'Auto Pilot', icon: '🤖' },
              { id: 'calendar', label: 'Calendar', icon: '📅' },
              { id: 'analytics', label: 'Analytics', icon: '📊' },
            { id: 'groups', label: 'Groups', icon: '👥' },
            { id: 'onboarding', label: 'Setup Wizard', icon: '🧭' },
              { id: 'overlay', label: 'Overlay', icon: '🖼️' },
              { id: 'library', label: 'Library', icon: '📚' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map(item => (
              <button key={item.id}
                style={{ ...styles.navItem, ...(view === item.id ? styles.navItemActive : {}) }}
                onClick={() => setView(item.id)}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div style={styles.sidebarBottom}>
            <select
              style={styles.accountSelect}
              value={user.id}
              onChange={(e) => onSwitchAccount(e.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <div style={styles.connectedBadge}>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{connectedCount}</span>
              <span style={{ color: '#555', fontSize: 12 }}> platforms connected</span>
            </div>
            <div style={styles.userInfo}>
              <div style={styles.avatarSm}>{user.name?.[0]?.toUpperCase()}</div>
              <span style={{ color: '#888', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </span>
              <button style={styles.logoutBtn} onClick={onLogout} title="Logout">↗</button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

// (Removed) LinkedInFeedView function
// The LinkedIn Feed view has been removed as per requirements
// ──────────────────────────────────────────────────────────

// Placeholder for AutoPilotView (moved up)

function AutoPilotView_PLACEHOLDER({ onError, onNotify }) {
  const [chromeProfilePath, setChromeProfilePath] = useState('/host_chrome_data');
  const [profileDirectory, setProfileDirectory] = useState('Profile 15');
  const [maxPosts, setMaxPosts] = useState(30);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [running, setRunning] = useState(false);
  const [posts, setPosts] = useState([]);
  const [runs, setRuns] = useState([]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await axios.get(`${API}/api/linkedin-feed/posts`, { params: { limit: 100 } });
      setPosts(res.data?.posts || []);
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to load LinkedIn feed posts');
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [onError]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/linkedin-feed/runs`);
      setRuns(res.data?.runs || []);
      if (res.data?.running) setRunning(true);
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    loadRuns();
  }, [loadPosts, loadRuns]);

  const runScrape = async () => {
    if (!chromeProfilePath.trim()) return onError?.('Chrome profile path is required');
    setRunning(true);
    try {
      const res = await axios.post(`${API}/api/linkedin-feed/scrape`, {
        chromeProfilePath: chromeProfilePath.trim(),
        profileDirectory: profileDirectory.trim() || 'Default',
        maxPosts: Math.max(1, Math.min(100, Number(maxPosts) || 30)),
      });

      onNotify?.(`LinkedIn feed run complete. Captured ${res.data?.captured || 0} posts.`);
      await loadRuns();
      await loadPosts();
    } catch (e) {
      onError?.(e.response?.data?.error || 'LinkedIn feed extraction failed');
      await loadRuns();
    } finally {
      setRunning(false);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this extracted post?')) return;
    try {
      await axios.delete(`${API}/api/linkedin-feed/posts/${postId}`);
      setPosts((prev) => prev.filter((item) => item.id !== postId));
      onNotify?.('Extracted post deleted');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to delete extracted post');
    }
  };

  return (
    <div style={styles.monitorWrap}>
      <div style={styles.settingsCard}>
        <h2 style={styles.sectionTitle}>LinkedIn Feed</h2>
        <p style={styles.sectionSubtitle}>
          Separate feed extraction workspace for future tasks. Uses your real Chrome profile and captures home-feed posts only.
        </p>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 180px 120px', alignItems: 'end' }}>
          <div>
            <label style={styles.label}>Chrome Profile Path</label>
            <input
              style={styles.input}
              value={chromeProfilePath}
              onChange={(e) => setChromeProfilePath(e.target.value)}
              placeholder={'e.g. C:/Users/you/AppData/Local/Google/Chrome/User Data'}
            />
          </div>
          <div>
            <label style={styles.label}>Profile Directory</label>
            <input
              style={styles.input}
              value={profileDirectory}
              onChange={(e) => setProfileDirectory(e.target.value)}
              placeholder={'Default / Profile 1'}
            />
          </div>
          <div>
            <label style={styles.label}>Max Posts</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={100}
              value={maxPosts}
              onChange={(e) => setMaxPosts(Math.max(1, Math.min(100, Number(e.target.value) || 30)))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={styles.primaryBtn} onClick={runScrape} disabled={running}>
            {running ? 'Extracting...' : 'Run Feed Extraction'}
          </button>
          <button style={styles.secondaryBtn} onClick={() => { loadRuns(); loadPosts(); }}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>
          If backend runs in Docker, host Windows paths are not directly readable inside container unless mounted.
        </div>
        <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>
          Safety: keep low frequency, use manual real profile, avoid parallel sessions.
        </div>
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Recent Runs</h3>
        {runs.length === 0 ? (
          <div style={styles.hint}>No extraction runs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {runs.map((run) => (
              <div key={run.id} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: '8px 10px', background: '#0b1220' }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                  {new Date(run.created_at).toLocaleString()} • {run.status}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Max: {run.max_posts || 0} • Captured: {run.captured_posts || 0}
                </div>
                {run.error_message ? <div style={{ color: '#fda4af', fontSize: 12 }}>{run.error_message}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Extracted Feed Posts</h3>
        {loadingPosts ? (
          <div style={styles.hint}>Loading extracted posts...</div>
        ) : posts.length === 0 ? (
          <div style={styles.hint}>No posts captured yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={styles.feedTableHeader}>Author</th>
                  <th style={styles.feedTableHeader}>Text</th>
                  <th style={styles.feedTableHeader}>Comments</th>
                  <th style={styles.feedTableHeader}>Time</th>
                  <th style={styles.feedTableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} style={{ borderTop: '1px solid #1f2937' }}>
                    <td style={styles.feedTableCell}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{post.author || 'Unknown'}</div>
                      {post.profile_link ? (
                        <a href={post.profile_link} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                          Profile
                        </a>
                      ) : null}
                    </td>
                    <td style={styles.feedTableCell}>
                      <div style={{ color: '#cbd5e1', maxWidth: 520, whiteSpace: 'pre-wrap' }}>
                        {String(post.post_text || '').slice(0, 500)}
                      </div>
                      {post.post_link ? (
                        <a href={post.post_link} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                          Open post
                        </a>
                      ) : null}
                    </td>
                    <td style={styles.feedTableCell}>{post.comments || '-'}</td>
                    <td style={styles.feedTableCell}>{post.posted_time || '-'}</td>
                    <td style={styles.feedTableCell}>
                      <button style={styles.secondaryBtn} onClick={() => deletePost(post.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AutoPilotView({
  aiProviders,
  connectedPlatforms,
  facebookPages,
  facebookPagesLoading,
  onLoadFacebookPages,
  linkedInTargets,
  linkedInTargetsLoading,
  onLoadLinkedInTargets,
  onNotify,
  onError,
}) {
  const KARACHI_OFFSET_MINUTES = 5 * 60;

  const toKarachiDateTimeParts = (value) => {
    const date = new Date(value);
    const karachiMillis = date.getTime() + (KARACHI_OFFSET_MINUTES * 60 * 1000);
    const karachi = new Date(karachiMillis);
    const year = karachi.getUTCFullYear();
    const month = String(karachi.getUTCMonth() + 1).padStart(2, '0');
    const day = String(karachi.getUTCDate()).padStart(2, '0');
    const hours = String(karachi.getUTCHours()).padStart(2, '0');
    const minutes = String(karachi.getUTCMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    };
  };

  const karachiInputToIso = (dateText, timeText) => {
    const [year, month, day] = String(dateText || '').split('-').map((value) => Number(value));
    const [hour, minute] = String(timeText || '').split(':').map((value) => Number(value));
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return '';
    const utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0) - (KARACHI_OFFSET_MINUTES * 60 * 1000);
    return new Date(utcMillis).toISOString();
  };

  const formatKarachiDateTime = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value));
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runs, setRuns] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [autoPosts, setAutoPosts] = useState([]);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [editingPostId, setEditingPostId] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMediaUrls, setEditMediaUrls] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('10:00');
  const [editPlatforms, setEditPlatforms] = useState([]);
  const [editFacebookPages, setEditFacebookPages] = useState([]);
  const [editLinkedInTargets, setEditLinkedInTargets] = useState([]);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef(null);

  const normalizeMediaUrl = useCallback((rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:image/')) return raw;
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.pathname.startsWith('/uploads/')) return `${API}${parsed.pathname}`;
      return parsed.href;
    } catch {
      if (raw.startsWith('/uploads/')) return `${API}${raw}`;
      return raw;
    }
  }, []);

  const renderTemplateWithBase = useCallback(async ({ templateId, baseImageSource, nameSuffix = 'autopilot' }) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) throw new Error('Selected template not found');
    const normalizedLayers = (template.layers || []).map((layer) => {
      if (layer.type === 'image' && layer.src) {
        return { ...layer, src: normalizeMediaUrl(layer.src) };
      }
      return layer;
    });
    const res = await axios.post(`${API}/api/pple/render`, {
      baseImageUrl: normalizeMediaUrl(baseImageSource || ''),
      layers: normalizedLayers,
      outputWidth: template.canvas_width || 1080,
      outputHeight: template.canvas_height || 1080,
      name: `${template.name || 'template'}_${nameSuffix}`,
    });
    const renderedUrl = normalizeMediaUrl(res.data?.image?.preview_url || res.data?.image?.local_url || res.data?.image?.url || '');
    if (!renderedUrl) throw new Error('No image URL in render response');
    return renderedUrl;
  }, [savedTemplates, normalizeMediaUrl]);

  const appendEditMediaUrls = (urls) => {
    const incoming = (urls || []).map((v) => String(v || '').trim()).filter(Boolean);
    if (incoming.length === 0) return;
    setEditMediaUrls((prev) => {
      const current = String(prev || '').split('\n').map((v) => v.trim()).filter(Boolean);
      return Array.from(new Set([...current, ...incoming])).join('\n');
    });
  };

  const uploadEditFiles = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const formData = new FormData();
    list.forEach((file) => formData.append('files', file));
    setEditUploading(true);
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      appendEditMediaUrls(uploadedUrls);
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to upload images');
    }
    setEditUploading(false);
  };

  const [form, setForm] = useState({
    enabled: false,
    topic: '',
    niche: '',
    category: '',
    tone: 'professional',
    posts_per_day: 1,
    platforms: ['instagram', 'linkedin', 'facebook'],
    text_provider: '',
    image_provider: '',
    selected_template_id: '',
    facebook_page_ids: [],
    linkedin_target_ids: [],
  });

  const textProviders = aiProviders.filter((provider) => provider?.hasText || provider?.capabilities?.includes('text'));
  const imageProviders = aiProviders.filter((provider) => provider?.hasImage || provider?.capabilities?.includes('image'));

  const canUseFacebookPages = form.platforms.includes('facebook') && connectedPlatforms.includes('facebook');
  const canUseLinkedInTargets = (form.platforms.includes('linkedin') || form.platforms.includes('linkedin_page'))
    && (connectedPlatforms.includes('linkedin') || connectedPlatforms.includes('linkedin_page'));
  const editablePlatforms = ['facebook', 'instagram', 'linkedin'].filter((platformId) => connectedPlatforms.includes(platformId));

  const togglePlatform = (platform) => {
    setForm((prev) => {
      const exists = prev.platforms.includes(platform);
      return {
        ...prev,
        platforms: exists ? prev.platforms.filter((item) => item !== platform) : [...prev.platforms, platform]
      };
    });
  };

  const toggleListValue = (key, value) => {
    setForm((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const exists = list.includes(value);
      return { ...prev, [key]: exists ? list.filter((item) => item !== value) : [...list, value] };
    });
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/autopilot/config`);
      setForm((prev) => ({ ...prev, ...(res.data?.config || {}) }));
    } catch {
      onError?.('Failed to load Auto Pilot config');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await axios.get(`${API}/api/autopilot/runs`);
      setRuns(res.data?.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const loadAutoPilotPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await axios.get(`${API}/api/autopilot/posts`);
      setAutoPosts(res.data?.posts || []);
    } catch {
      setAutoPosts([]);
      onError?.('Failed to load Auto Pilot posts');
    } finally {
      setPostsLoading(false);
    }
  }, [onError]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/pple/templates`);
      setSavedTemplates(res.data?.templates || []);
    } catch {
      setSavedTemplates([]);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadRuns();
    loadAutoPilotPosts();
    loadTemplates();
  }, [loadConfig, loadRuns, loadAutoPilotPosts, loadTemplates]);

  useEffect(() => {
    if (canUseFacebookPages) onLoadFacebookPages?.();
  }, [canUseFacebookPages, onLoadFacebookPages]);

  useEffect(() => {
    if (canUseLinkedInTargets) onLoadLinkedInTargets?.();
  }, [canUseLinkedInTargets, onLoadLinkedInTargets]);

  const save = async () => {
    if (form.enabled && !String(form.topic || '').trim()) {
      onError?.('Topic is required when Auto Pilot is enabled');
      return;
    }

    if (form.enabled && !String(form.text_provider || '').trim()) {
      onError?.('Please select a Text AI provider');
      return;
    }

    if (form.enabled && !String(form.image_provider || '').trim()) {
      onError?.('Please select an Image AI provider');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/api/autopilot/config`, form);
      onNotify?.('Auto Pilot settings saved');
      await loadConfig();
    } catch (e) {
      onError?.(e?.response?.data?.error || 'Failed to save Auto Pilot settings');
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await axios.post(`${API}/api/autopilot/run-now`);
      const summary = res.data?.summary || {};
      onNotify?.(`Auto Pilot run complete: ${summary.scheduled || 0} scheduled, ${summary.duplicates || 0} duplicate skipped`);
      await loadRuns();
      await loadConfig();
      await loadAutoPilotPosts();
    } catch (e) {
      onError?.(e?.response?.data?.error || 'Failed to run Auto Pilot');
    } finally {
      setRunning(false);
    }
  };

  const toggleEditPlatform = (platformId) => {
    setEditPlatforms((prev) => (
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    ));
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content || '');
    setEditMediaUrls((post.media_urls || []).join('\n'));
    const parts = toKarachiDateTimeParts(post.scheduled_at || post.created_at);
    setEditDate(parts.date);
    setEditTime(parts.time);
    setEditPlatforms(post.platforms || []);
    setEditFacebookPages(post.facebook_page_ids || []);
    setEditLinkedInTargets(post.linkedin_target_ids || []);
  };

  const cancelEditPost = () => {
    setEditingPostId('');
    setEditContent('');
    setEditMediaUrls('');
    setEditDate('');
    setEditTime('10:00');
    setEditPlatforms([]);
    setEditFacebookPages([]);
    setEditLinkedInTargets([]);
  };

  const saveEditedPost = async (post) => {
    if (post.status !== 'scheduled') return onError?.('Only scheduled posts can be edited/rescheduled');
    if (!editContent.trim()) return onError?.('Content is required');
    if (!editDate || !editTime) return onError?.('Date and time are required');
    if (editPlatforms.length === 0) return onError?.('Select at least one platform');
    if (editPlatforms.includes('facebook') && editFacebookPages.length === 0) return onError?.('Select at least one Facebook page');
    if (editPlatforms.includes('linkedin') && editLinkedInTargets.length === 0) return onError?.('Select at least one LinkedIn target');

    const scheduledAt = karachiInputToIso(editDate, editTime);
    if (!scheduledAt) return onError?.('Invalid date/time');
    if (new Date(scheduledAt) <= new Date()) {
      return onError?.('Please select a future time for rescheduling');
    }

    setEditingSaving(true);
    try {
      let mediaUrlsToSave = editMediaUrls.split('\n').map((value) => value.trim()).filter(Boolean);
      // Apply template overlay if a template is selected and there's an image
      if (form.selected_template_id && mediaUrlsToSave.length > 0) {
        try {
          const renderedUrl = await renderTemplateWithBase({
            templateId: form.selected_template_id,
            baseImageSource: normalizeMediaUrl(mediaUrlsToSave[0]),
            nameSuffix: `autopilot_edit_${Date.now()}`,
          });
          mediaUrlsToSave = [renderedUrl];
          setEditMediaUrls(renderedUrl);
        } catch (overlayErr) {
          console.warn('Template overlay failed, using original image:', overlayErr.message);
        }
      }
      await axios.put(`${API}/api/posts/${post.id}`, {
        content: editContent,
        media_urls: mediaUrlsToSave,
        platforms: editPlatforms,
        scheduled_at: scheduledAt,
        facebook_page_ids: editPlatforms.includes('facebook') ? editFacebookPages : [],
        linkedin_target_ids: editPlatforms.includes('linkedin') ? editLinkedInTargets : [],
      });
      await loadAutoPilotPosts();
      onNotify?.('Auto Pilot post updated');
      cancelEditPost();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to update Auto Pilot post');
    }
    setEditingSaving(false);
  };

  const postNow = async (postId) => {
    try {
      await axios.post(`${API}/api/posts/${postId}/post-now`);
      await loadAutoPilotPosts();
      onNotify?.('Auto Pilot post published now');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to publish Auto Pilot post now');
    }
  };

  const deleteScheduledPost = async (postId) => {
    if (!window.confirm('Delete this Auto Pilot scheduled post?')) return;
    try {
      await axios.delete(`${API}/api/posts/${postId}`);
      await loadAutoPilotPosts();
      onNotify?.('Auto Pilot scheduled post deleted');
      if (editingPostId === postId) cancelEditPost();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to delete Auto Pilot post');
    }
  };

  const statusColor = (status) =>
    status === 'published' || status === 'partial' ? '#4ade80'
    : status === 'scheduled' ? '#a78bfa'
    : status === 'failed' ? '#f87171'
    : '#888';

  if (loading) {
    return (
      <div style={styles.settingsWrap}>
        <div style={styles.settingsCard}>Loading Auto Pilot…</div>
      </div>
    );
  }

  return (
    <div style={styles.settingsWrap}>
      <h2 style={styles.sectionTitle}>Auto Pilot</h2>
      <p style={styles.sectionSubtitle}>Autonomously generate and schedule daily posts for connected platforms.</p>

      <div style={styles.settingsCard}>
        <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          Enable Auto Pilot daily run
        </label>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <label style={styles.label}>Posts per day</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={5}
              value={form.posts_per_day || 1}
              onChange={(e) => setForm((prev) => ({ ...prev, posts_per_day: Math.max(1, Math.min(5, Number(e.target.value) || 1)) }))}
            />
          </div>
          <div>
            <label style={styles.label}>Tone</label>
            <select
              style={styles.select}
              value={form.tone || 'professional'}
              onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="educational">Educational</option>
              <option value="bold">Bold</option>
            </select>
          </div>
        </div>

        <label style={styles.label}>Main topic</label>
        <input
          style={styles.input}
          value={form.topic || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
          placeholder="e.g. AI automation for small businesses"
        />
        <div style={{ marginTop: 6 }}>
          <TopicSuggestionPanel
            niche={form.niche || ''}
            category={form.category || ''}
            tone={form.tone || 'professional'}
            onSelect={(t) => setForm((prev) => ({ ...prev, topic: t }))}
          />
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <label style={styles.label}>Niche</label>
            <input
              style={styles.input}
              value={form.niche || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, niche: e.target.value }))}
              placeholder="e.g. marketing"
            />
          </div>
          <div>
            <label style={styles.label}>Category</label>
            <input
              style={styles.input}
              value={form.category || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g. growth strategy"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <label style={styles.label}>Text AI provider</label>
            <select
              style={styles.select}
              value={form.text_provider || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, text_provider: e.target.value }))}
            >
              <option value="">Select provider</option>
              {textProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Image AI provider</label>
            <select
              style={styles.select}
              value={form.image_provider || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, image_provider: e.target.value }))}
            >
              <option value="">Select provider</option>
              {imageProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Default template (optional)</label>
            <select
              style={styles.select}
              value={form.selected_template_id || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, selected_template_id: e.target.value }))}
            >
              <option value="">None (use raw AI image)</option>
              {savedTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
              This template will be applied automatically on all Auto Pilot generated posts.
            </div>
          </div>
        </div>

        <label style={styles.label}>Platforms</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {['instagram', 'linkedin', 'facebook'].map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              style={{
                ...styles.smallChip,
                borderColor: form.platforms?.includes(platform) ? '#22c55e' : '#334155',
                color: form.platforms?.includes(platform) ? '#22c55e' : '#cbd5e1',
              }}
            >
              {PLATFORM_META[platform]?.name || platform}
            </button>
          ))}
        </div>

        {canUseFacebookPages && (
          <div style={{ marginBottom: 10 }}>
            <label style={styles.label}>Facebook pages</label>
            {facebookPagesLoading ? (
              <div style={styles.hint}>Loading Facebook pages…</div>
            ) : facebookPages.length === 0 ? (
              <div style={styles.hint}>No pages found. Connect Facebook and refresh.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {facebookPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => toggleListValue('facebook_page_ids', page.id)}
                    style={{
                      ...styles.smallChip,
                      borderColor: form.facebook_page_ids?.includes(page.id) ? '#22c55e' : '#334155',
                      color: form.facebook_page_ids?.includes(page.id) ? '#22c55e' : '#cbd5e1',
                    }}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canUseLinkedInTargets && (
          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>LinkedIn targets</label>
            {linkedInTargetsLoading ? (
              <div style={styles.hint}>Loading LinkedIn targets…</div>
            ) : linkedInTargets.length === 0 ? (
              <div style={styles.hint}>No targets found. Connect LinkedIn and refresh.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {linkedInTargets.map((target) => (
                  <button
                    key={target.id || target.targetId}
                    type="button"
                    onClick={() => toggleListValue('linkedin_target_ids', target.id || target.targetId)}
                    style={{
                      ...styles.smallChip,
                      borderColor: form.linkedin_target_ids?.includes(target.id || target.targetId) ? '#22c55e' : '#334155',
                      color: form.linkedin_target_ids?.includes(target.id || target.targetId) ? '#22c55e' : '#cbd5e1',
                    }}
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={styles.primaryBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button style={styles.secondaryBtn} onClick={runNow} disabled={running}>
            {running ? 'Generating…' : 'Generate More Posts'}
          </button>
        </div>
      </div>

      <div style={styles.settingsCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h3 style={{ ...styles.settingsSubtitle, margin: 0 }}>Auto Pilot Posts</h3>
          <button style={{ ...styles.secondaryBtn, marginLeft: 'auto' }} onClick={loadAutoPilotPosts}>
            Refresh
          </button>
        </div>
        {postsLoading ? (
          <div style={styles.hint}>Loading Auto Pilot posts…</div>
        ) : autoPosts.length === 0 ? (
          <div style={styles.hint}>No Auto Pilot posts yet. Click Generate More Posts to create them.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {autoPosts.map((post) => (
              <div key={post.id} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                {editingPostId === post.id ? (
                  <>
                    <textarea
                      style={{ ...styles.textarea, minHeight: 110, fontSize: 13 }}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <textarea
                      style={{ ...styles.textarea, minHeight: 70, fontSize: 12, marginTop: 8 }}
                      value={editMediaUrls}
                      onChange={(e) => setEditMediaUrls(e.target.value)}
                      placeholder="Image URLs (one per line)"
                    />
                    <input
                      ref={editFileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => { uploadEditFiles(e.target.files); e.target.value = ''; }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        style={styles.secondaryBtn}
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={editUploading}
                      >
                        {editUploading ? 'Uploading...' : '⬆ Upload Image'}
                      </button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label style={styles.aiLabel}>Platforms</label>
                      <PlatformPicker platformIds={editablePlatforms} selectedPlatforms={editPlatforms} onToggle={toggleEditPlatform} />
                    </div>
                    <FacebookPagesPicker
                      visible={editPlatforms.includes('facebook')}
                      pages={facebookPages}
                      selectedPageIds={editFacebookPages}
                      loading={facebookPagesLoading}
                      onRefresh={onLoadFacebookPages}
                      onToggle={(pageId) => setEditFacebookPages((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId])}
                    />
                    <LinkedInTargetsPicker
                      visible={editPlatforms.includes('linkedin')}
                      targets={linkedInTargets}
                      selectedTargetIds={editLinkedInTargets}
                      loading={linkedInTargetsLoading}
                      onRefresh={onLoadLinkedInTargets}
                      onToggle={(targetId) => setEditLinkedInTargets((prev) => prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId])}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      <input type="date" style={styles.datetimeInput} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                      <input type="time" style={styles.datetimeInput} value={editTime} onChange={(e) => setEditTime(e.target.value)} step="60" />
                      <button style={styles.primaryBtn} onClick={() => saveEditedPost(post)} disabled={editingSaving}>
                        {editingSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button style={styles.secondaryBtn} onClick={cancelEditPost}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {post.content || ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: `${statusColor(post.status)}20`,
                        color: statusColor(post.status),
                        border: `1px solid ${statusColor(post.status)}40`
                      }}>
                        {post.status}
                      </span>
                      {(post.platforms || []).map((pl) => (
                        <span key={pl} style={{ color: PLATFORM_META[pl]?.color || '#94a3b8', fontSize: 11, fontWeight: 600 }}>
                          {PLATFORM_META[pl]?.name || pl}
                        </span>
                      ))}
                      {renderGenerationBadges(post)}
                      {post.scheduled_at ? (
                        <span style={{ color: '#a78bfa', fontSize: 11 }}>📅 {formatKarachiDateTime(post.scheduled_at)} (Karachi)</span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {post.status === 'scheduled' ? <button style={styles.secondaryBtn} onClick={() => startEditPost(post)}>Edit / Reschedule</button> : null}
                      {['scheduled', 'draft', 'failed'].includes(post.status) ? <button style={styles.secondaryBtn} onClick={() => postNow(post.id)}>Post Now</button> : null}
                      {post.status === 'scheduled' ? <button style={{ ...styles.secondaryBtn, borderColor: '#7f1d1d', color: '#fecaca' }} onClick={() => deleteScheduledPost(post.id)}>Delete</button> : null}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Recent Runs</h3>
        {runsLoading ? (
          <div style={styles.hint}>Loading run history…</div>
        ) : runs.length === 0 ? (
          <div style={styles.hint}>No runs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {runs.map((run) => (
              <div key={run.id} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: '8px 10px', background: '#0b1220' }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                  {new Date(run.created_at).toLocaleString()} • {run.status}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Generated: {run.generated_count || 0} · Scheduled: {run.scheduled_count || 0} · Duplicates: {run.duplicate_count || 0}
                </div>
                {run.error_message ? <div style={{ color: '#fda4af', fontSize: 12 }}>{run.error_message}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsView({ data, onRefresh, onError }) {
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
    } catch {
      onError?.('Failed to refresh analytics');
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const totals = data?.totals || { posts: 0, reactions: 0, comments: 0, likes: 0 };
  const byPlatform = data?.by_platform || [];
  const items = data?.items || [];

  return (
    <div style={styles.settingsWrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Analytics (Last 7 Days)</h2>
        <button style={{ ...styles.secondaryBtn, marginLeft: 'auto', padding: '8px 14px' }} onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div style={styles.settingsCard}><div style={{ color: '#64748b', fontSize: 12 }}>Posts</div><div style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{totals.posts || 0}</div></div>
        <div style={styles.settingsCard}><div style={{ color: '#64748b', fontSize: 12 }}>Reactions</div><div style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{totals.reactions || 0}</div></div>
        <div style={styles.settingsCard}><div style={{ color: '#64748b', fontSize: 12 }}>Comments</div><div style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{totals.comments || 0}</div></div>
        <div style={styles.settingsCard}><div style={{ color: '#64748b', fontSize: 12 }}>Likes</div><div style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{totals.likes || 0}</div></div>
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>By Platform</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {byPlatform.map((row) => (
            <div key={row.platform} style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', gap: 8, padding: '8px 10px', border: '1px solid #1f2937', borderRadius: 8 }}>
              <span style={{ color: PLATFORM_META[row.platform]?.color || '#ddd', fontSize: 12, fontWeight: 700 }}>{PLATFORM_META[row.platform]?.name || row.platform}</span>
              <span style={{ color: '#ddd', fontSize: 12 }}>Posts: {row.posts || 0}</span>
              <span style={{ color: '#ddd', fontSize: 12 }}>Reactions: {row.reactions || 0}</span>
              <span style={{ color: '#ddd', fontSize: 12 }}>Comments: {row.comments || 0}</span>
              <span style={{ color: '#ddd', fontSize: 12 }}>Likes: {row.likes || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsSubtitle}>Post-Level Metrics</h3>
        {items.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>No published Facebook/Instagram/LinkedIn posts in the last 7 days.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, index) => (
              <div key={`${item.platform}-${item.platform_post_id || index}`} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: PLATFORM_META[item.platform]?.color || '#ddd', fontSize: 12, fontWeight: 700 }}>{PLATFORM_META[item.platform]?.name || item.platform}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>{item.posted_at ? new Date(item.posted_at).toLocaleString() : 'N/A'}</span>
                </div>
                <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{item.content_preview}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {renderGenerationBadges(item)}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ color: '#facc15', fontSize: 12 }}>Reactions: {item.reactions || 0}</span>
                  <span style={{ color: '#60a5fa', fontSize: 12 }}>Comments: {item.comments || 0}</span>
                  <span style={{ color: '#4ade80', fontSize: 12 }}>Likes: {item.likes || 0}</span>
                </div>
                {item.unavailable_reason && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 6 }}>{item.unavailable_reason}</div>}
                {item.platform_post_url && (
                  <a href={item.platform_post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: 12, marginTop: 6, display: 'inline-block' }}>
                    Open Post
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Misc components ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ ...styles.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
        <div style={styles.spinner} />
      </div>
    </div>
  );
}

function Notification({ msg, type }) {
  return (
    <div style={{
      ...styles.notification,
      background: type === 'error' ? '#2d0f0f' : '#0f2d1a',
      borderColor: type === 'error' ? '#f87171' : '#4ade80',
    }}>
      <span style={{ color: type === 'error' ? '#f87171' : '#4ade80' }}>
        {type === 'error' ? '✗' : '✓'} {msg}
      </span>
    </div>
  );
}

function LoginGate({ onLogin, loading = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin?.({ username, password });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', width: '100%' }}>
      <div style={{ ...styles.settingsCard, width: '100%', maxWidth: 420 }}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Sign in to SocialHub</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
          Sign in with Google, or use the local app username and password below, then choose any internal profile inside the app.
        </p>
        <a
          href={`${API}/auth/google`}
          style={{ ...styles.primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 12 }}
        >
          Continue with Google
        </a>
        <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
          Google sign-in needs Google Cloud credentials configured on the backend; if they are not set, you will be sent back here and can still use the local login below.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
          />
          <input
            type="password"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
          <button type="submit" style={styles.primaryBtn} disabled={loading || !username.trim() || !password}>
            {loading ? 'Signing in…' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Phase 4: account groups. A group holds several connected
// social accounts; an account belongs to at most one group.
// Deleting a group never deletes its accounts — they become
// ungrouped. Posting still uses one account per platform;
// choosing which account in a group to post to is later work.
function GroupsView({ onNotify, onError }) {
  const [groups, setGroups] = useState([]);
  const [ungrouped, setUngrouped] = useState([]);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [assignSelection, setAssignSelection] = useState({});

  const loadGroups = useCallback(async () => {
    try {
      const [groupsRes, ungroupedRes] = await Promise.all([
        axios.get(`${API}/api/groups`),
        axios.get(`${API}/api/groups/ungrouped`),
      ]);
      setGroups(groupsRes.data || []);
      setUngrouped(ungroupedRes.data || []);
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to load groups');
    }
  }, [onError]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await axios.post(`${API}/api/groups`, { name: newName, description: newDescription });
      setNewName('');
      setNewDescription('');
      await loadGroups();
      onNotify?.('Group created');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to create group');
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      await axios.delete(`${API}/api/groups/${groupId}`);
      await loadGroups();
      onNotify?.('Group deleted — its accounts are now ungrouped');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to delete group');
    }
  };

  const assignAccount = async (groupId) => {
    const socialAccountId = assignSelection[groupId];
    if (!socialAccountId) return;
    try {
      await axios.post(`${API}/api/groups/${groupId}/accounts`, { socialAccountId });
      await loadGroups();
      onNotify?.('Account added to group');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to add account to group');
    }
  };

  const unassignAccount = async (groupId, accountId) => {
    try {
      await axios.delete(`${API}/api/groups/${groupId}/accounts/${accountId}`);
      await loadGroups();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to remove account from group');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.settingsCard}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Account Groups</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
          Group your connected accounts by purpose — for example English video, Urdu video, or images.
          A user can now hold several accounts on the same platform, and each account sits in at most one group.
        </p>
        <form onSubmit={createGroup} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <input style={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group name, e.g. English video" />
          <input style={styles.input} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description (optional)" />
          <button type="submit" style={styles.primaryBtn} disabled={!newName.trim()}>Create Group</button>
        </form>
      </div>
      {groups.map((group) => (
        <div key={group.id} style={styles.settingsCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ ...styles.sectionTitle, margin: 0 }}>{group.name}</h3>
            <button style={styles.secondaryBtn} onClick={() => deleteGroup(group.id)}>Delete group</button>
          </div>
          {group.description && <p style={{ color: '#94a3b8', fontSize: 13 }}>{group.description}</p>}
          {(group.accounts || []).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No accounts in this group yet.</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {(group.accounts || []).map((account) => (
                <li key={account.id} style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 6 }}>
                  {account.platform}: {account.platform_display_name || account.platform_username || account.platform_user_id}
                  {' '}
                  <button style={styles.secondaryBtn} onClick={() => unassignAccount(group.id, account.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          {ungrouped.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <select
                style={styles.input}
                value={assignSelection[group.id] || ''}
                onChange={(e) => setAssignSelection({ ...assignSelection, [group.id]: e.target.value })}
              >
                <option value="">Add an ungrouped account…</option>
                {ungrouped.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.platform}: {account.platform_display_name || account.platform_username || account.platform_user_id}
                  </option>
                ))}
              </select>
              <button style={styles.primaryBtn} onClick={() => assignAccount(group.id)} disabled={!assignSelection[group.id]}>Add</button>
            </div>
          )}
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div style={styles.settingsCard}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Ungrouped accounts</h3>
          <ul style={{ paddingLeft: 18 }}>
            {ungrouped.map((account) => (
              <li key={account.id} style={{ color: '#cbd5e1', fontSize: 13 }}>
                {account.platform}: {account.platform_display_name || account.platform_username || account.platform_user_id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Phase 5: developer onboarding wizard. Walks the user
// through connecting each platform by hand: create a
// developer app, paste the exact redirect URI, set the env
// vars, restart the backend, then Connect. It never writes
// .env and never creates a developer app — those stay owner
// actions. Env-var values are never shown, only present /
// missing, because the API only reports presence.
function OnboardingWizard({ onConnect, onError }) {
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadOnboarding = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/onboarding`);
      setEntries(res.data || []);
      setSelectedId((prev) => prev || (res.data && res.data.length > 0 ? res.data[0].id : null));
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to load setup wizard');
    }
  }, [onError]);

  useEffect(() => { loadOnboarding(); }, [loadOnboarding]);

  const selected = entries.find((e) => e.id === selectedId) || null;

  const copyRedirectUri = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      onError?.('Could not copy — select the URL and copy it by hand');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.settingsCard}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Setup Wizard</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
          Each platform needs its own developer app — a Google credential cannot log into social platforms,
          and official posting cannot skip this step. Pick a platform, follow its steps, then connect.
          On the final VPS the redirect URIs must match the VPS domain, so you will re-do this step there.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {entries.map((entry) => (
            <button
              key={entry.id}
              style={selectedId === entry.id ? styles.primaryBtn : styles.secondaryBtn}
              onClick={() => setSelectedId(entry.id)}
            >
              {entry.name} {entry.configured ? '✓' : '○'}
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <div style={styles.settingsCard}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>{selected.name}</h3>
          <ol style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
            <li>
              Create an app at <a href={selected.portalUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{selected.portalName}</a>.
              {' '}{selected.productNote}
            </li>
            <li>
              Paste this redirect URI into the app. {selected.redirectFieldNote}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input style={styles.input} readOnly value={selected.redirectUri} onFocus={(e) => e.target.select()} />
                <button style={styles.secondaryBtn} onClick={copyRedirectUri}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </li>
            <li>
              Set these variables in the backend .env, then restart the backend:
              <ul style={{ paddingLeft: 18, marginTop: 6 }}>
                {selected.vars.map((v) => (
                  <li key={v.name} style={{ color: v.present ? '#86efac' : '#fca5a5' }}>
                    {v.present ? '✓' : '✗'} {v.name} {v.present ? '' : '— missing'}
                  </li>
                ))}
              </ul>
            </li>
            <li>Connect below and approve the consent screen as the account owner.</li>
          </ol>
          <button
            style={styles.primaryBtn}
            disabled={!selected.configured}
            onClick={() => onConnect?.(selected.connectId)}
            title={selected.configured ? '' : 'Set the missing variables and restart the backend first'}
          >
            {selected.configured ? `Connect ${selected.name}` : 'Connect (waiting on missing variables)'}
          </button>
          {!selected.configured && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
              The wizard cannot set these for you — edit the backend .env on the machine running HiSocial,
              restart the backend, and this page will pick up the change.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Phase 6: Meta token health. Before Phase 6, Facebook and
// Instagram tokens were stored short-lived with no expiry,
// so connections broke silently hours after setup. This
// block shows each connection's health (ok / expiring soon
// / expired / unknown for pre-Phase-6 connections) and
// offers Refresh for Facebook. Instagram page tokens cannot
// be refreshed — a broken Instagram connection must be
// reconnected, and the block says so.
function MetaTokenHealth({ onConnect }) {
  const [entries, setEntries] = useState([]);
  const [message, setMessage] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta/status`);
      setEntries(res.data || []);
    } catch (e) {
      setMessage(e.response?.data?.error || 'Could not load Meta token health');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const refreshFacebook = async () => {
    setMessage('');
    try {
      const res = await axios.post(`${API}/api/meta/refresh`, { platform: 'facebook' });
      setMessage(res.data.refreshed ? 'Facebook token refreshed' : (res.data.message || 'No refresh needed'));
      await loadStatus();
    } catch (e) {
      setMessage(e.response?.data?.error || 'Refresh failed — reconnect Facebook if posting fails');
      await loadStatus();
    }
  };

  if (entries.length === 0 && !message) return null;

  const statusLabel = (status) => ({
    ok: '✓ Healthy',
    expiring_soon: '⚠ Expiring soon',
    expired: '✗ Expired',
    unknown: '? Unknown (connected before expiry tracking)',
  }[status] || status);

  return (
    <div style={styles.settingsCard}>
      <h3 style={styles.settingsSubtitle}>Meta Token Health</h3>
      <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
        Facebook tokens last about 60 days once exchanged; Instagram page tokens from a long-lived
        Facebook token do not expire. Connections made before this fix show Unknown — reconnect them
        once and they will be tracked.
      </p>
      <ul style={{ paddingLeft: 18 }}>
        {entries.map((entry) => (
          <li key={entry.id} style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 6 }}>
            {entry.platform}: {entry.username || 'connected'} — {statusLabel(entry.status)}
            {entry.expiresAt && ` (expires ${new Date(entry.expiresAt).toLocaleDateString()})`}
          </li>
        ))}
      </ul>
      {entries.some((e) => e.platform === 'facebook') && (
        <button style={styles.primaryBtn} onClick={refreshFacebook}>Refresh Facebook token</button>
      )}
      {entries.some((e) => e.platform === 'instagram' && (e.status === 'expired' || e.status === 'unknown')) && (
        <button style={styles.secondaryBtn} onClick={() => onConnect?.('instagram')}>Reconnect Instagram</button>
      )}
      {message && <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>{message}</p>}
    </div>
  );
}

function InstagramSelectModal({ accounts, onSelect, loading }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h2 style={{ ...styles.sectionTitle, fontSize: 18, marginBottom: 20, marginTop: 0 }}>Select Instagram Account</h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
          Multiple Instagram accounts were found. Which one would you like to connect?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
          {accounts.map((account) => (
            <button
              key={account.id}
              style={styles.instagramAccountButton}
              onClick={() => onSelect(account.id)}
              disabled={loading}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                {account.igAccount.profile_picture_url && (
                  <img src={account.igAccount.profile_picture_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                )}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                    {account.igAccount.username}
                  </div>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    {account.name}
                  </div>
                </div>
              </div>
              {loading && <Spinner />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PPLEView({ connectedPlatforms = [], facebookPages = [], linkedInTargets = [], onNotify, onError }) {
  const [baseImageUrl, setBaseImageUrl] = useState('');
  const [baseImageLoadError, setBaseImageLoadError] = useState('');
  const [baseSize, setBaseSize] = useState({ width: 1080, height: 1080 });
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [renderedUrl, setRenderedUrl] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduleContent, setScheduleContent] = useState('');
  const [schedulePlatforms, setSchedulePlatforms] = useState(() => (connectedPlatforms.includes('instagram') ? ['instagram'] : []));
  const [scheduleDate, setScheduleDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [facebookPageIds, setFacebookPageIds] = useState([]);
  const [linkedInTargetIds, setLinkedInTargetIds] = useState([]);

  const dragRef = useRef(null);

  const stageWidth = Math.max(1, Number(baseSize.width) || 1080);
  const stageHeight = Math.max(1, Number(baseSize.height) || 1080);
  const stageScale = Math.min(560 / stageWidth, 420 / stageHeight, 1);

  const sortedLayers = [...layers].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) || null;

  const normalizeMediaUrl = useCallback((rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:image/')) return raw;

    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.pathname.startsWith('/uploads/')) {
        return `${API}${parsed.pathname}`;
      }
      return parsed.href;
    } catch {
      if (raw.startsWith('/uploads/')) return `${API}${raw}`;
      return raw;
    }
  }, []);

  const normalizeLayersForRender = useCallback((inputLayers = []) => {
    return (Array.isArray(inputLayers) ? inputLayers : []).map((layer) => {
      if (layer.type !== 'image') return layer;
      return {
        ...layer,
        src: normalizeMediaUrl(layer.src || ''),
      };
    });
  }, [normalizeMediaUrl]);

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/pple/templates`);
      setTemplates(res.data?.templates || []);
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to load PPLE templates');
    }
  }, [onError]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragRef.current) return;
      const { layerId, startX, startY, originX, originY } = dragRef.current;
      const dx = (event.clientX - startX) / stageScale;
      const dy = (event.clientY - startY) / stageScale;
      setLayers((prev) => prev.map((layer) => (layer.id === layerId ? { ...layer, x: Math.round(originX + dx), y: Math.round(originY + dy) } : layer)));
    };

    const onUp = () => { dragRef.current = null; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [stageScale]);

  const addLayer = (type) => {
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const zIndex = layers.length;

    const baseLayer = {
      id,
      type,
      x: 60,
      y: 60,
      width: 220,
      height: 80,
      opacity: 1,
      rotation: 0,
      zIndex,
      visible: true,
      locked: false,
    };

    const nextLayer = type === 'image'
      ? { ...baseLayer, src: '' }
      : type === 'text'
        ? { ...baseLayer, content: 'Your text', fontSize: 32, fontFamily: 'Arial', color: '#FFFFFF', align: 'left', maxWidth: 320 }
        : { ...baseLayer, shape: 'rectangle', fill: '#1E3A5F' };

    setLayers((prev) => [...prev, nextLayer]);
    setSelectedLayerId(id);
  };

  const updateLayer = (layerId, patch) => {
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)));
  };

  const removeLayer = (layerId) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const nudgeZ = (layerId, delta) => {
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? { ...layer, zIndex: (layer.zIndex || 0) + delta } : layer)));
  };

  const applyTemplate = () => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setLayers(Array.isArray(template.layers) ? template.layers : []);
    if (template.canvas_width && template.canvas_height) {
      setBaseSize({ width: template.canvas_width, height: template.canvas_height });
    }
    setTemplateName(template.name || '');
    setSelectedLayerId(null);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return onError?.('Template name is required');
    setSavingTemplate(true);
    try {
      await axios.post(`${API}/api/pple/templates`, {
        id: selectedTemplateId || undefined,
        name: templateName.trim(),
        layers,
        canvas_width: stageWidth,
        canvas_height: stageHeight,
      });
      onNotify?.('PPLE template saved');
      await refreshTemplates();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete selected template?')) return;
    try {
      await axios.delete(`${API}/api/pple/templates/${selectedTemplateId}`);
      setSelectedTemplateId('');
      onNotify?.('Template deleted');
      await refreshTemplates();
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to delete template');
    }
  };

  const renderImage = async () => {
    if (!baseImageUrl.trim()) return onError?.('Base image URL is required');
    setRendering(true);
    try {
      const res = await axios.post(`${API}/api/pple/render`, {
        baseImageUrl: normalizeMediaUrl(baseImageUrl.trim()),
        layers: normalizeLayersForRender(layers),
        outputWidth: stageWidth,
        outputHeight: stageHeight,
        name: `pple_${Date.now()}.png`,
      });
      const preview = res.data?.image?.preview_url || res.data?.image?.local_url || res.data?.image?.url || '';
      setRenderedUrl(normalizeMediaUrl(preview));
      onNotify?.('PPLE rendered image created');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to render image');
    } finally {
      setRendering(false);
    }
  };

  const renderAndSchedule = async () => {
    if (!baseImageUrl.trim()) return onError?.('Base image URL is required');
    if (!scheduleContent.trim()) return onError?.('Post content is required');
    if (!Array.isArray(schedulePlatforms) || schedulePlatforms.length === 0) return onError?.('Select at least one platform');

    const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
    if (new Date(scheduledAt) <= new Date()) return onError?.('Scheduled time must be in the future');

    setScheduling(true);
    try {
      const res = await axios.post(`${API}/api/pple/render-and-schedule`, {
        baseImageUrl: normalizeMediaUrl(baseImageUrl.trim()),
        layers: normalizeLayersForRender(layers),
        outputWidth: stageWidth,
        outputHeight: stageHeight,
        content: scheduleContent.trim(),
        platforms: schedulePlatforms,
        scheduled_at: scheduledAt,
        facebook_page_ids: facebookPageIds,
        linkedin_target_ids: linkedInTargetIds,
        name: `pple_schedule_${Date.now()}.png`,
      });

      const preview = res.data?.image?.preview_url || res.data?.image?.local_url || res.data?.image?.url || '';
      setRenderedUrl(normalizeMediaUrl(preview));
      onNotify?.('Final image rendered and scheduled');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to render and schedule');
    } finally {
      setScheduling(false);
    }
  };

  const uploadOverlay = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/media/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const firstFile = (res.data?.files || [])[0] || null;
      const first = firstFile?.local_url || firstFile?.url || res.data?.urls?.[0] || '';
      if (first) {
        const normalizedSrc = normalizeMediaUrl(first);
        const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const imageLayer = {
          id,
          type: 'image',
          src: normalizedSrc,
          x: 60,
          y: 60,
          width: 220,
          height: 220,
          opacity: 1,
          rotation: 0,
          zIndex: layers.length,
          visible: true,
          locked: false,
          previewError: false,
        };
        setLayers((prev) => [...prev, imageLayer]);
        setSelectedLayerId(id);
        onNotify?.('Overlay uploaded and added as layer');
      }
    } catch (e) {
      onError?.(e.response?.data?.error || 'Failed to upload overlay');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const onBaseImageLoad = (event) => {
    const img = event.target;
    if (!img.naturalWidth || !img.naturalHeight) return;
    setBaseImageLoadError('');
    setBaseSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const togglePlatform = (platform) => {
    setSchedulePlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const selectedStyleForLayer = (layer) => ({
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    width: layer.type === 'text' ? layer.maxWidth || layer.width : layer.width,
    height: layer.height,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation || 0}deg)`,
    border: selectedLayerId === layer.id ? '1px dashed #38bdf8' : '1px solid transparent',
    cursor: layer.locked ? 'not-allowed' : 'move',
    boxSizing: 'border-box',
    overflow: 'hidden',
  });

  return (
    <div style={styles.ppleWrap}>
      <h2 style={styles.sectionTitle}>Post Processing Layer Engine (PPLE)</h2>
      <div style={styles.ppleSubTitle}>Generate image {'->'} approve {'->'} apply layers {'->'} final render {'->'} schedule</div>

      <div style={styles.ppleGrid}>
        <div style={styles.settingsCard}>
          <div style={styles.ppleSectionTitle}>Canvas + Templates</div>
          <label style={styles.label}>Base image URL</label>
          <input style={styles.input} value={baseImageUrl} onChange={(e) => { setBaseImageUrl(e.target.value); setBaseImageLoadError(''); }} placeholder="Paste generated image URL" />
          {baseImageLoadError && <div style={{ color: '#fecaca', fontSize: 12, marginTop: 6 }}>{baseImageLoadError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input style={styles.input} type="number" value={stageWidth} onChange={(e) => setBaseSize((prev) => ({ ...prev, width: Math.max(1, Number(e.target.value) || prev.width) }))} placeholder="Width" />
            <input style={styles.input} type="number" value={stageHeight} onChange={(e) => setBaseSize((prev) => ({ ...prev, height: Math.max(1, Number(e.target.value) || prev.height) }))} placeholder="Height" />
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={styles.secondaryBtn} onClick={() => addLayer('image')}>+ Image Layer</button>
            <button style={styles.secondaryBtn} onClick={() => addLayer('text')}>+ Text Layer</button>
            <button style={styles.secondaryBtn} onClick={() => addLayer('shape')}>+ Shape Layer</button>
            <label style={{ ...styles.secondaryBtn, display: 'inline-flex', alignItems: 'center' }}>
              {uploading ? 'Uploading...' : 'Upload Overlay PNG'}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={uploadOverlay} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1f2937' }}>
            <label style={styles.label}>Template</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={styles.select} value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <button style={styles.secondaryBtn} onClick={applyTemplate}>Apply</button>
              <button style={styles.secondaryBtn} onClick={deleteTemplate}>Delete</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={styles.input} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
              <button style={styles.primaryBtn} onClick={saveTemplate} disabled={savingTemplate}>{savingTemplate ? 'Saving...' : 'Save Template'}</button>
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button style={styles.primaryBtn} onClick={renderImage} disabled={rendering}>{rendering ? 'Rendering...' : 'Render Final Image'}</button>
            <button style={styles.secondaryBtn} onClick={refreshTemplates}>Refresh Templates</button>
          </div>

          {renderedUrl && (
            <div style={{ marginTop: 12 }}>
              <div style={styles.label}>Rendered Output</div>
              <img src={renderedUrl} alt="PPLE output" style={{ width: '100%', borderRadius: 10, border: '1px solid #1f2937' }} />
            </div>
          )}
        </div>

        <div style={styles.settingsCard}>
          <div style={styles.ppleSectionTitle}>Mini Editor</div>
          <div style={styles.ppleCanvasWrap}>
            <div style={{ position: 'relative', width: stageWidth * stageScale, height: stageHeight * stageScale, background: '#0a0a12', border: '1px solid #1f2937' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: stageWidth, height: stageHeight, transform: `scale(${stageScale})`, transformOrigin: 'top left' }}>
                {baseImageUrl ? (
                  <img
                    src={normalizeMediaUrl(baseImageUrl)}
                    alt="base"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    onLoad={onBaseImageLoad}
                    onError={() => setBaseImageLoadError('Unable to preview base image. Try a direct /uploads URL or a reachable image URL.')}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>Set base image URL to start</div>
                )}

                {sortedLayers.map((layer) => (
                  <div
                    key={layer.id}
                    style={selectedStyleForLayer(layer)}
                    onMouseDown={(event) => {
                      setSelectedLayerId(layer.id);
                      if (layer.locked) return;
                      dragRef.current = {
                        layerId: layer.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        originX: layer.x,
                        originY: layer.y,
                      };
                    }}
                  >
                    {layer.type === 'image' && layer.src && (
                      <>
                        <img
                          src={normalizeMediaUrl(layer.src)}
                          alt="layer"
                          style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
                          onLoad={() => {
                            if (layer.previewError) updateLayer(layer.id, { previewError: false });
                          }}
                          onError={() => {
                            if (!layer.previewError) updateLayer(layer.id, { previewError: true });
                          }}
                        />
                        {layer.previewError && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(127,29,29,0.35)', color: '#fecaca', fontSize: 11, textAlign: 'center', padding: 6 }}>
                            Unable to preview this image
                          </div>
                        )}
                      </>
                    )}
                    {layer.type === 'text' && (
                      <div style={{ color: layer.color || '#fff', fontSize: layer.fontSize || 32, fontFamily: layer.fontFamily || 'Arial', textAlign: layer.align || 'left', width: '100%', pointerEvents: 'none' }}>
                        {layer.content || 'Text'}
                      </div>
                    )}
                    {layer.type === 'shape' && (
                      <div style={{ width: '100%', height: '100%', background: layer.fill || '#1E3A5F', borderRadius: layer.shape === 'circle' ? '9999px' : 8, pointerEvents: 'none' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.ppleSectionTitle}>Layers</div>
            <div style={styles.ppleLayerList}>
              {sortedLayers.map((layer) => (
                <div key={layer.id} style={{ ...styles.ppleLayerItem, borderColor: selectedLayerId === layer.id ? '#38bdf8' : '#1f2937' }} onClick={() => setSelectedLayerId(layer.id)}>
                  <div style={{ color: '#e2e8f0', fontSize: 12 }}>{layer.type.toUpperCase()}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: layer.visible === false }); }}>{layer.visible === false ? 'Show' : 'Hide'}</button>
                    <button style={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}>{layer.locked ? 'Unlock' : 'Lock'}</button>
                    <button style={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); nudgeZ(layer.id, 1); }}>Front</button>
                    <button style={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); nudgeZ(layer.id, -1); }}>Back</button>
                    <button style={{ ...styles.secondaryBtn, borderColor: '#7f1d1d', color: '#fecaca' }} onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}>Delete</button>
                  </div>
                </div>
              ))}
              {sortedLayers.length === 0 && <div style={{ color: '#64748b', fontSize: 12 }}>No layers yet.</div>}
            </div>
          </div>
        </div>

        <div style={styles.settingsCard}>
          <div style={styles.ppleSectionTitle}>Properties + Scheduler</div>

          {selectedLayer ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={styles.input} type="number" value={selectedLayer.x || 0} onChange={(e) => updateLayer(selectedLayer.id, { x: Number(e.target.value) || 0 })} placeholder="x" />
                <input style={styles.input} type="number" value={selectedLayer.y || 0} onChange={(e) => updateLayer(selectedLayer.id, { y: Number(e.target.value) || 0 })} placeholder="y" />
                <input style={styles.input} type="number" value={selectedLayer.width || 0} onChange={(e) => updateLayer(selectedLayer.id, { width: Math.max(1, Number(e.target.value) || 1) })} placeholder="width" />
                <input style={styles.input} type="number" value={selectedLayer.height || 0} onChange={(e) => updateLayer(selectedLayer.id, { height: Math.max(1, Number(e.target.value) || 1) })} placeholder="height" />
                <input style={styles.input} type="number" step="0.05" min="0" max="1" value={selectedLayer.opacity ?? 1} onChange={(e) => updateLayer(selectedLayer.id, { opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })} placeholder="opacity" />
                <input style={styles.input} type="number" value={selectedLayer.rotation || 0} onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) || 0 })} placeholder="rotation" />
              </div>

              {selectedLayer.type === 'image' && (
                <div style={{ marginTop: 8 }}>
                  <label style={styles.label}>Image source URL</label>
                  <input style={styles.input} value={selectedLayer.src || ''} onChange={(e) => updateLayer(selectedLayer.id, { src: e.target.value })} />
                </div>
              )}

              {selectedLayer.type === 'text' && (
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  <textarea style={{ ...styles.textarea, minHeight: 80 }} value={selectedLayer.content || ''} onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input style={styles.input} type="number" value={selectedLayer.fontSize || 32} onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Math.max(8, Number(e.target.value) || 8) })} placeholder="font size" />
                    <input style={styles.input} value={selectedLayer.fontFamily || 'Arial'} onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })} placeholder="font family" />
                    <input style={styles.input} value={selectedLayer.color || '#FFFFFF'} onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })} placeholder="color" />
                    <select style={styles.select} value={selectedLayer.align || 'left'} onChange={(e) => updateLayer(selectedLayer.id, { align: e.target.value })}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedLayer.type === 'shape' && (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select style={styles.select} value={selectedLayer.shape || 'rectangle'} onChange={(e) => updateLayer(selectedLayer.id, { shape: e.target.value })}>
                    <option value="rectangle">Rectangle</option>
                    <option value="circle">Circle</option>
                  </select>
                  <input style={styles.input} value={selectedLayer.fill || '#1E3A5F'} onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })} placeholder="fill" />
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Select a layer to edit properties.</div>
          )}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1f2937' }}>
            <label style={styles.label}>Post content</label>
            <textarea style={{ ...styles.textarea, minHeight: 90 }} value={scheduleContent} onChange={(e) => setScheduleContent(e.target.value)} placeholder="Content for scheduler" />

            <div style={{ marginTop: 8 }}>
              <div style={styles.label}>Platforms</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {connectedPlatforms.map((platform) => (
                  <button key={platform} style={{ ...styles.smallChip, ...(schedulePlatforms.includes(platform) ? { borderColor: '#38bdf8', color: '#e0f2fe' } : {}) }} onClick={() => togglePlatform(platform)}>
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            {schedulePlatforms.includes('facebook') && facebookPages.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label style={styles.label}>Facebook pages</label>
                <select style={styles.select} multiple value={facebookPageIds} onChange={(e) => setFacebookPageIds(Array.from(e.target.selectedOptions || []).map((opt) => opt.value))}>
                  {facebookPages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
                </select>
              </div>
            )}

            {(schedulePlatforms.includes('linkedin') || schedulePlatforms.includes('linkedin_page')) && linkedInTargets.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label style={styles.label}>LinkedIn targets</label>
                <select style={styles.select} multiple value={linkedInTargetIds} onChange={(e) => setLinkedInTargetIds(Array.from(e.target.selectedOptions || []).map((opt) => opt.value))}>
                  {linkedInTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={styles.input} type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              <input style={styles.input} type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} step="60" />
            </div>

            <button style={{ ...styles.primaryBtn, marginTop: 10, width: '100%' }} onClick={renderAndSchedule} disabled={scheduling}>
              {scheduling ? 'Rendering & Scheduling...' : 'Render Final Image + Add to Scheduler'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ ...styles.spinner, display: 'inline-block', marginRight: 8 }} />;
}


// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  app: { display: 'flex', minHeight: '100vh', background: 'var(--bg-deep)', fontFamily: UI_FONT_STACK },
  sidebar: { width: 220, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '24px 0', position: 'sticky', top: 0, height: '100vh' },
  sidebarLogo: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px', borderBottom: '1px solid var(--border)' },
  logoText: { fontFamily: HEADING_FONT_STACK, color: 'var(--text-primary)', fontWeight: 800, fontSize: 18, letterSpacing: -0.5 },
  nav: { padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, fontWeight: 500, fontFamily: UI_FONT_STACK, textAlign: 'left', transition: 'all 0.15s' },
  navItemActive: { background: 'var(--nav-active)', color: 'var(--text-primary)' },
  sidebarBottom: { padding: '16px 12px', borderTop: '1px solid var(--border)' },
  accountSelect: { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontFamily: UI_FONT_STACK, fontSize: 13 },
  connectedBadge: { padding: '8px 12px', marginBottom: 8 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--border)' },
  avatarSm: { width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: 0, lineHeight: 1 },
  main: { flex: 1, overflow: 'auto', padding: '32px' },
  sectionTitle: { fontFamily: HEADING_FONT_STACK, color: 'var(--text-primary)', fontSize: 22, fontWeight: 800, marginBottom: 20, margin: '0 0 20px' },
  sectionSubtitle: { color: '#7c8797', fontSize: 13, marginTop: -12, marginBottom: 4 },
  composeWrap: { maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 },
  composeCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 },
  platformRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  platformChip: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 30, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s', fontFamily: UI_FONT_STACK },
  textarea: { width: '100%', background: 'var(--bg-deep)', border: '1.5px solid', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 15, padding: 14, fontFamily: UI_FONT_STACK, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 120 },
  targetCard: { marginBottom: 14, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 10 },
  targetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  targetLabel: { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: 0.2 },
  targetHint: { color: '#6b6b82', fontSize: 11, marginTop: 2 },
  targetActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: { padding: '6px 8px', background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: UI_FONT_STACK, fontSize: 11 },
  pageList: { display: 'grid', gap: 6 },
  pageOption: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid', borderRadius: 8, cursor: 'pointer' },
  pageOptionText: { display: 'flex', flexDirection: 'column', gap: 2 },
  pageOptionName: { color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 },
  pageOptionId: { color: '#777793', fontSize: 11 },
  charCount: { position: 'absolute', bottom: 10, right: 12, fontSize: 12 },
  mediaSection: { margin: '12px 0', cursor: 'pointer' },
  mediaSummary: { color: '#555', fontSize: 13, cursor: 'pointer', userSelect: 'none' },
  postBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, fontFamily: UI_FONT_STACK, transition: 'opacity 0.2s' },
  ctaBox: { marginTop: 16, padding: '12px 16px', background: 'var(--border)', borderRadius: 10, textAlign: 'center' },
  resultsCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  resultRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  connectCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 },
  connectGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 },
  connectBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px', background: 'var(--bg-deep)', border: '1px solid', borderRadius: 12, cursor: 'pointer' },
  historyWrap: { maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  historyCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 },
  settingsWrap: { maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 },
  settingsCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 },
  settingsSubtitle: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16, margin: '0 0 16px' },
  platformRow2: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  disconnectBtn: { background: 'none', border: '1px solid var(--border-soft)', borderRadius: 8, color: 'var(--text-muted)', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: UI_FONT_STACK },
  connectBtnSmall: { background: 'none', border: '1px solid', borderRadius: 8, padding: '4px 14px', cursor: 'pointer', fontFamily: UI_FONT_STACK },
  avatar: { width: 48, height: 48, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 },
  apiRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' },
  code: { background: 'var(--border)', color: '#a78bfa', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' },
  landing: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 },
  accountPickerWrap: { width: '100%', maxWidth: 760, textAlign: 'center' },
  accountGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 20 },
  accountCard: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', width: '100%' },
  avatarLg: { width: 44, height: 44, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0 },
  refreshBtn: { marginTop: 16, padding: '10px 16px', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 10, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: UI_FONT_STACK },
  createAccountForm: { marginTop: 18, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 10, textAlign: 'left' },
  profileForm: { marginTop: 14, display: 'grid', gap: 10 },
  input: { width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 14, padding: '10px 12px', outline: 'none', fontFamily: UI_FONT_STACK },
  select: { width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 14, padding: '10px 12px', outline: 'none', fontFamily: UI_FONT_STACK },
  label: { display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 },
  hint: { color: '#64748b', fontSize: 12 },
  smallChip: { padding: '6px 10px', borderRadius: 999, background: '#0b1220', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer', fontSize: 12, fontFamily: UI_FONT_STACK },
  primaryBtn: { padding: '10px 14px', background: '#25335f', border: '1px solid #3b4c86', borderRadius: 10, color: '#d7e1ff', fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT_STACK },
  landingContent: { textAlign: 'center', maxWidth: 520 },
  logoGlow: { fontSize: 64, marginBottom: 8, filter: 'drop-shadow(0 0 40px #6366f1)' },
  landingTitle: { fontFamily: HEADING_FONT_STACK, color: '#fff', fontSize: 52, fontWeight: 800, margin: '0 0 12px', letterSpacing: -2 },
  landingSubtitle: { color: '#555', fontSize: 17, lineHeight: 1.7, margin: '0 0 32px' },
  platformShowcase: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  landingPlatformBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s' },
  notification: { position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 12, border: '1px solid', maxWidth: 360 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  modal: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%', maxHeight: '80vh', overflowY: 'auto' },
  instagramAccountButton: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--border)', border: '1px solid var(--border-soft)', borderRadius: 10, cursor: 'pointer', fontFamily: UI_FONT_STACK, transition: 'all 0.15s' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' },
  spinner: { width: 20, height: 20, border: '2px solid #2a2a3e', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  // AI Studio panel
  aiPanel: { border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14, background: 'var(--bg-card-alt)' },
  aiPanelHeader: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', background: 'var(--bg-card-alt)', border: 'none', cursor: 'pointer', fontFamily: UI_FONT_STACK, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' },
  aiControlRow: { display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  aiControl: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120 },
  aiLabel: { color: 'var(--text-faint)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' },
  aiInput: { background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: UI_FONT_STACK, width: '100%' },
  aiSelect: { background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: UI_FONT_STACK, width: '100%' },
  aiGenerateBtn: { padding: '10px 18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI_FONT_STACK, marginTop: 4 },
  aiResultItem: { display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 10, alignItems: 'flex-start' },
  aiUseBtn: { padding: '6px 12px', background: '#0f2a3a', border: '1px solid #1a4a5a', borderRadius: 8, color: '#60d0fa', fontSize: 12, cursor: 'pointer', fontFamily: UI_FONT_STACK, whiteSpace: 'nowrap', flexShrink: 0 },
  brainCard: { marginTop: 14, border: '1px solid #1e293b', borderRadius: 12, background: '#0b1220', padding: 12 },
  brainResultBox: { marginTop: 10, border: '1px solid #1f5134', borderRadius: 10, background: '#0d1f14', padding: 10 },
  // Scheduling
  scheduleBtn: { padding: '12px 18px', background: '#0f1f0f', border: '1px solid #2a3e2a', borderRadius: 12, color: '#4ade80', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT_STACK, display: 'flex', alignItems: 'center', gap: 6 },
  scheduleRow: { display: 'flex', gap: 10, padding: '12px', background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' },
  datetimeInput: { flex: 1, background: '#0a0a12', border: '1px solid #2a2a3e', borderRadius: 8, color: '#ddd', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: UI_FONT_STACK, minWidth: 180 },
  scheduleSubmitBtn: { padding: '10px 16px', background: '#1a3a1a', border: '1px solid #2a4a2a', borderRadius: 10, color: '#4ade80', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT_STACK, display: 'flex', alignItems: 'center', gap: 6 },
  // Calendar
  calendarWrap: { width: '100%', maxWidth: 1380, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  calendarHeaderRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 },
  calDayHeader: { textAlign: 'center', padding: '8px 0', color: '#6b7280', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
  calDay: { borderRadius: 12, padding: '8px 8px 10px', minHeight: 116, display: 'flex', flexDirection: 'column', gap: 8 },
  calDayTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calDayCount: { color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  calTypeRow: { display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 24, alignItems: 'flex-start' },
  calTypeBadge: { padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, border: '1px solid transparent', textTransform: 'uppercase' },
  calTypeImage: { background: '#1f2937', color: '#7dd3fc', borderColor: '#164e63' },
  calTypeText: { background: '#1f1726', color: '#f9a8d4', borderColor: '#6b214f' },
  calDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
  calNavBtn: { padding: '6px 14px', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, fontFamily: UI_FONT_STACK },
  calEditorCard: { marginBottom: 14, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-deep)' },
  calPostMetaRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 },
  // Library
  reuseBtn: { padding: '4px 10px', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: UI_FONT_STACK},
  aiTestCard: { marginTop: 16, padding: 16, borderRadius: 12, border: '1px solid #1f2d1f', background: '#0d1710' },
  aiTestResult: { marginTop: 12, padding: 14, borderRadius: 10, border: '1px solid #235c31', background: '#0f2214' },
  aiTestError: { marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid #7f1d1d', background: '#2d0f0f', color: '#fecaca', fontSize: 13, lineHeight: 1.6 },
  // PPLE
  ppleWrap: { width: '100%', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 },
  ppleSubTitle: { color: '#7c8797', fontSize: 13, marginTop: -8, marginBottom: 4 },
  ppleGrid: { display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 12, alignItems: 'start' },
  ppleSectionTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  ppleCanvasWrap: { border: '1px solid #1f2937', borderRadius: 12, background: '#020617', padding: 10, overflow: 'auto' },
  ppleLayerList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 2 },
  ppleLayerItem: { border: '1px solid #1f2937', borderRadius: 8, background: '#0b1220', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' },
  // AI Monitor
  monitorWrap: { maxWidth: 1380, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  monitorHeaderRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  monitorTopFeedCard: { background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 12 },
  monitorProgressTrack: { width: '100%', height: 8, background: '#111827', border: '1px solid #1f2937', borderRadius: 999, overflow: 'hidden', marginBottom: 10 },
  monitorProgressFill: { height: '100%', background: 'linear-gradient(90deg, #22d3ee, #4ade80)', borderRadius: 999, transition: 'width 0.4s ease' },
  monitorTopFeedList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, maxHeight: 240, overflowY: 'auto' },
  monitorTopFeedItem: { border: '1px solid #1f2937', background: '#0f172a', borderRadius: 8, padding: 8 },
  monitorStatsCard: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 12 },
  monitorGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  monitorCol: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, minHeight: 620 },
  monitorToggleRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  monitorJobBtn: { width: '100%', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '8px 10px', textAlign: 'left', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' },
  monitorList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 760, overflowY: 'auto', paddingRight: 2 },
  monitorDebugList: { marginBottom: 10, border: '1px solid #1e293b', background: '#0b1220', borderRadius: 10, padding: 10, maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  monitorDebugRow: { border: '1px solid #1f2937', background: '#0f172a', borderRadius: 8, padding: 8 },
  monitorPostCard: { width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card-alt)', padding: 10, cursor: 'pointer' },
  monitorKeywordChip: { padding: '2px 8px', borderRadius: 999, border: '1px solid #1f3b2a', background: '#102016', color: '#86efac', fontSize: 10, fontWeight: 700 },
  monitorActionRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  feedTableHeader: {
    textAlign: 'left',
    color: '#94a3b8',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    padding: '8px 10px',
    borderBottom: '1px solid #1f2937',
  },
  feedTableCell: {
    verticalAlign: 'top',
    color: '#cbd5e1',
    fontSize: 12,
    padding: '10px',
  },
};

const globalCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg-deep, #0a0a12); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes scanPulse {
    0% { opacity: 0.6; filter: saturate(0.9); }
    50% { opacity: 1; filter: saturate(1.2); }
    100% { opacity: 0.6; filter: saturate(0.9); }
  }
  textarea:focus { border-color: #6366f1 !important; }
  details summary::-webkit-details-marker { display: none; }
  button:hover { filter: brightness(1.1); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--border-soft, #2a2a3e); border-radius: 4px; }
  @media (max-width: 640px) {
    aside { width: 60px !important; }
    aside span:not(:first-child) { display: none; }
    main { padding: 16px !important; }
  }
`;
