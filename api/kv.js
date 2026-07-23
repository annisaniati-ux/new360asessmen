// /api/kv.js
// Simple key-value proxy backed by Upstash Redis REST API.
// Works with either the native Upstash integration (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
// or the Vercel Marketplace "KV" naming (KV_REST_API_URL / KV_REST_API_TOKEN).

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function upstash(command) {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error('NO_DB');
  }
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`UPSTASH_ERROR_${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET' && req.query.health === '1') {
    res.status(200).json({ connected: !!(REST_URL && REST_TOKEN) });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { action, key, value, prefix } = req.body || {};
    if (!action || (!key && action !== 'list')) {
      res.status(400).json({ error: 'Missing action/key' });
      return;
    }

    if (action === 'get') {
      const result = await upstash(['GET', key]);
      res.status(200).json({ value: result === null ? null : result });
      return;
    }

    if (action === 'set') {
      await upstash(['SET', key, typeof value === 'string' ? value : JSON.stringify(value)]);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'delete') {
      await upstash(['DEL', key]);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'list') {
      // SCAN for keys matching prefix* (best-effort, single pass)
      const match = prefix ? `${prefix}*` : '*';
      let cursor = '0';
      let keys = [];
      do {
        const result = await upstash(['SCAN', cursor, 'MATCH', match, 'COUNT', '200']);
        cursor = result[0];
        keys = keys.concat(result[1] || []);
      } while (cursor !== '0' && keys.length < 5000);
      res.status(200).json({ keys });
      return;
    }

    if (action === 'mget') {
      const { keys } = req.body || {};
      if (!Array.isArray(keys) || keys.length === 0) {
        res.status(400).json({ error: 'Missing keys array' });
        return;
      }
      if (!REST_URL || !REST_TOKEN) throw new Error('NO_DB');
      const pipelineRes = await fetch(`${REST_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(keys.map(k => ['GET', k])),
      });
      if (!pipelineRes.ok) {
        const text = await pipelineRes.text().catch(() => '');
        throw new Error(`UPSTASH_ERROR_${pipelineRes.status}: ${text}`);
      }
      const pipelineData = await pipelineRes.json();
      const values = {};
      keys.forEach((k, i) => { values[k] = pipelineData[i] ? pipelineData[i].result : null; });
      res.status(200).json({ values });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    if (String(err.message).includes('NO_DB')) {
      res.status(503).json({ error: 'NO_DB', message: 'Database belum tersambung. Hubungkan Upstash Redis di Vercel dashboard (Storage -> Create Database -> Upstash), lalu redeploy.' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL', message: String(err.message || err) });
  }
}
