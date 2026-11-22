// Akşam hatırlatma bildirimleri (Vercel Cron günde 1 kez çağırır; ücretsiz planda saat içinde bir anda çalışır)
// Ortam değişkenleri: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET, PUSH_SECRET (Apps Script'tekiyle aynı)
const webpush = require('web-push');
const APPS_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwSn0Fg6c5crShQLu48u78oREJLMtycYhrQy62_-Rpzbe1ZBZWWUCxlkuXrXynnXzQ-/exec';
const MSG = ["Soru sormanın zamanını bilmelisin yoksa sıraya sıçrayabilir!", "Büllükyamin bugün derste seni hoplatacağını söylüyor…", "Faraşı kırmak bu kadar kolay olmamalı…", "Bize ayak yapmayın yalarız!", "Coşkunbete halen kayıt olmadınızmı? (coşkunailesideburada)", "Burgerlerin tadı bugün lezizdi, sosun tarifini öğrenebilir miyim?", "Muhteşem anneden 5000 TL deneme bonusu coşkunbete hala kayıt olmadınmı.", "\"TAYT10\" koduyla sahibe UYSAL’dan %10 indirimi kaçırma.", "⚠️Dikkat⚠️ Sipan arabası çıkabilir.", "Önümüze halı sermeyin, yolunda sıçarız."];

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
  const t = await apps({ action: 'push_targets', secret: process.env.PUSH_SECRET, all: true });
  if (!t.ok) return res.status(502).json({ error: t.error || 'Apps Script hatasi (yeni kodu dagittin mi?)' });
  const day = new Date().getDate();
  let sent = 0;
  const dead = [];
  for (const x of t.targets) {
    // Başlıkta sadece mesaj: telefon zaten uygulamanın adını üstte gösteriyor
    const title = MSG[(day + x.u.length) % MSG.length];
    for (const s of x.subs) {
      try {
        await webpush.sendNotification(s, JSON.stringify({ title, body: '', url: './' }));
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
      }
    }
  }
  if (dead.length) await apps({ action: 'push_clean', secret: process.env.PUSH_SECRET, endpoints: dead });
  return res.status(200).json({ kullanici: t.targets.length, gonderilen: sent, gecersiz: dead.length });
};
