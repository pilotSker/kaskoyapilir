// Akşam hatırlatma bildirimleri (Vercel Cron günde 1 kez çağırır; ücretsiz planda saat içinde bir anda çalışır)
// Mesajlar depodaki mesajlar.json dosyasından okunur. GitHub'da düzenlemen yeterli.
// Ortam değişkenleri: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET, PUSH_SECRET (Apps Script'tekiyle aynı)
const webpush = require('web-push');
const APPS_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwSn0Fg6c5crShQLu48u78oREJLMtycYhrQy62_-Rpzbe1ZBZWWUCxlkuXrXynnXzQ-/exec';
let MSG = [];
try { MSG = require('../mesajlar.json').filter((x) => typeof x === 'string' && x); } catch (e) {}
if (!MSG.length) MSG = ['Kapkapçı Eymen sizi ayağına çağırıyor.'];

async function apps(payload) {
  const r = await fetch(APPS_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
  return r.json();
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const q = req.query || {};
  const ok = secret && (req.headers.authorization === 'Bearer ' + secret || q.key === secret);
  if (!ok) return res.status(401).json({ error: 'yetkisiz' });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.PUSH_SECRET) {
    return res.status(500).json({ error: 'ortam degiskenleri eksik (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET)' });
  }
  webpush.setVapidDetails('mailto:admin@kasko.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const test = q.test === '1';
  const t = await apps({ action: 'push_targets', secret: process.env.PUSH_SECRET, all: true, n: MSG.length, peek: test });
  if (!t.ok) return res.status(502).json({ error: t.error || 'Apps Script hatasi (yeni kodu dagittin mi?)' });
  let sent = 0;
  const dead = [];
  const hatalar = [];
  for (const x of t.targets) {
    const msg = MSG[x.pick] || MSG[0];
    for (const s of x.subs) {
      try {
        await webpush.sendNotification(s, JSON.stringify({ title: 'KASKO YAPILIR YKS', body: msg, url: './' }));
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
        else hatalar.push({ kullanici: x.u, durum: e.statusCode, mesaj: String(e.body || e.message).slice(0, 120) });
      }
    }
  }
  if (dead.length) await apps({ action: 'push_clean', secret: process.env.PUSH_SECRET, endpoints: dead });
  return res.status(200).json({ kullanici: t.targets.length, gonderilen: sent, gecersiz: dead.length, mesajSayisi: MSG.length, hatalar });
};
