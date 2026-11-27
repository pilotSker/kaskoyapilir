// Dürtme: giriş yapmış kullanıcı başka birinin telefonuna bildirim gönderir
const webpush = require('web-push');
const APPS_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwSn0Fg6c5crShQLu48u78oREJLMtycYhrQy62_-Rpzbe1ZBZWWUCxlkuXrXynnXzQ-/exec';

async function apps(payload) {
  const r = await fetch(APPS_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  const token = String(req.headers['x-token'] || '');
  const to = String((req.body || {}).to || '').toLowerCase();
  if (!token || !to) return res.status(400).json({ ok: false, error: 'Eksik bilgi' });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.PUSH_SECRET) {
    return res.status(500).json({ ok: false, error: 'Sunucu ayarları eksik (VAPID ve PUSH_SECRET değişkenleri)' });
  }
  try {
    const c = await apps({ action: 'poke_check', token, to });
    if (!c.ok) return res.status(200).json({ ok: false, error: c.error === 'Bilinmeyen işlem' ? 'Apps Script kodunu güncelleyip yeniden dağıtman gerekiyor.' : (c.error || 'Hata') });
    webpush.setVapidDetails('mailto:admin@kasko.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const t = await apps({ action: 'push_targets', secret: process.env.PUSH_SECRET, all: true, only: to, peek: true, n: 1 });
    if (!t.ok) return res.status(200).json({ ok: false, error: t.error || 'Abonelik listesi alınamadı' });
    let sent = 0;
    for (const x of t.targets) {
      for (const s of x.subs) {
        try {
          await webpush.sendNotification(s, JSON.stringify({ title: 'KASKO YKS', body: c.from + ' seni dürttü. Kalk, çalış!', url: './' }));
          sent++;
        } catch (e) {}
      }
    }
    if (!sent) return res.status(200).json({ ok: false, error: to + ' bildirimleri açmamış ya da cihazına ulaşılamadı.' });
    await apps({ action: 'poke_done', token, to });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'Sunucu hatası: ' + String((e && e.message) || e).slice(0, 100) });
  }
};
