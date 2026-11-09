const { videos: { youtubePlaylist } } = require('./media-config.json');

function readPlaylistData(html) {
  const encoded = html.match(/(?:window\[['"]ytInitialData['"]\]|ytInitialData)\s*=\s*'((?:\\.|[^'\\])*)'/)?.[1];
  if (encoded) {
    const json = encoded.replace(/\\(x[\da-f]{2}|u[\da-f]{4}|.)/gi, (_, code) => {
      if (code.length > 1) return String.fromCharCode(parseInt(code.slice(1), 16));
      return { n: '\n', r: '\r', t: '\t' }[code] ?? code;
    });
    return JSON.parse(json);
  }
  const json = html.match(/(?:window\[['"]ytInitialData['"]\]|ytInitialData)\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)?.[1];
  if (!json) throw new Error('Playlist data unavailable');
  return JSON.parse(json);
}

function videoItem(id, title) {
  if (!/^[\w-]{11}$/.test(id || '') || typeof title !== 'string' || !title.trim()) return null;
  if (/^(?:private|deleted) video$/i.test(title.trim())) return null;
  return {
    title,
    url: 'https://www.youtube.com/watch?v=' + id,
    thumbnail: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'
  };
}

function readPublicPlaylist(html) {
  const found = new Map();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    const lockup = node.lockupViewModel;
    const legacy = node.playlistVideoRenderer;
    let item;
    if (lockup?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
      item = videoItem(lockup.contentId, lockup.metadata?.lockupMetadataViewModel?.title?.content);
    } else if (legacy) {
      const title = legacy.title?.simpleText ?? legacy.title?.runs?.map(run => run.text).join('');
      item = videoItem(legacy.videoId, title);
    }
    if (item && !found.has(item.url)) found.set(item.url, item);
    for (const child of Object.values(node)) visit(child);
  }
  visit(readPlaylistData(html).contents);
  if (!found.size) throw new Error('Playlist videos unavailable');
  return [...found.values()];
}

async function fetchPlaylist() {
  if (process.env.YOUTUBE_API_KEY) {
    const items = new Map();
    const seenTokens = new Set();
    let pageToken;
    do {
      const params = new URLSearchParams({
        part: 'snippet',
        playlistId: youtubePlaylist.playlistId,
        maxResults: '50',
        key: process.env.YOUTUBE_API_KEY
      });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?' + params, {
        signal: AbortSignal.timeout(4500)
      });
      if (!response.ok) throw new Error('YouTube API unavailable');
      const page = await response.json();
      for (const entry of page.items ?? []) {
        const item = videoItem(entry.snippet?.resourceId?.videoId, entry.snippet?.title);
        if (item && !items.has(item.url)) items.set(item.url, item);
      }
      pageToken = page.nextPageToken;
      if (pageToken && seenTokens.has(pageToken)) throw new Error('Repeated playlist page');
      seenTokens.add(pageToken);
    } while (pageToken);
    return [...items.values()];
  }

  const page = await fetch('https://www.youtube.com/playlist?list=' + youtubePlaylist.playlistId + '&hl=en', {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(4500)
  });
  if (!page.ok) throw new Error('YouTube playlist unavailable');
  return readPublicPlaylist(await page.text());
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  let items;
  let source = 'playlist';
  try {
    items = await fetchPlaylist();
  } catch {
    items = youtubePlaylist.items;
    source = 'respaldo';
  }
  res.setHeader('Vercel-CDN-Cache-Control', source === 'playlist'
    ? 's-maxage=300, stale-while-revalidate=600'
    : 's-maxage=60');
  return res.status(200).json({ source, items });
};
