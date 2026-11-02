// Program Mitra Pokama · pengirim email ke mitra (Brevo, kunci yang sama dengan email Sistem Kerja).
// POST (cron tiap 2 menit): kirim notifikasi otomatis (af_notifs) + antrean campaign (af_campaign_sends).
// GET ?unsub=<token>: halaman berhenti menerima email info & promo (email transaksi tetap terkirim).
// Mitra DEMO tidak pernah dikirimi email (difilter di database).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("PK_MAIL_FROM") || "notifikasi@pokama.org";
const FROM_NAME = "Program Mitra Rentalaja";
const PORTAL = "https://mitra.pokama.org/";
const UNSUB = `${SB}/functions/v1/af-mail?unsub=`;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, '<a href="$1" style="color:#067A70;font-weight:700">$1</a>');
const paras = (s: string) => String(s || "").trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:#3B4250">${linkify(p).replace(/\n/g, "<br>")}</p>`).join("");

const SUBJ: Record<string, string> = {
  disetujui: "Selamat, Anda resmi jadi Mitra Rentalaja",
  booking: "Ada booking baru dari kode Anda",
  siap_cair: "Komisi Anda siap dicairkan",
  transfer: "Komisi Anda sudah ditransfer",
  naik_tingkat: "Selamat, tingkat mitra Anda naik",
  tantangan_tercapai: "Tantangan tercapai, hadiah menunggu",
  juara: "Selamat, Anda juara bulan ini",
};
const BADGE: Record<string, [string, string, string]> = { // label, bg, fg
  disetujui: ["Mitra aktif", "#09BEAF", "#1D3149"], booking: ["Booking baru", "#1D3149", "#FFFFFF"], siap_cair: ["Siap cair", "#09BEAF", "#1D3149"],
  transfer: ["Ditransfer", "#09BEAF", "#1D3149"], naik_tingkat: ["Naik tingkat", "#F2C14E", "#1D3149"], tantangan_tercapai: ["Tantangan", "#F2C14E", "#1D3149"],
  juara: ["Juara", "#F2C14E", "#1D3149"], info: ["Info mitra", "#1D3149", "#FFFFFF"],
};

function shell(o: { badge: string; name: string; title: string; inner: string; code?: string; unsub?: string; transactional: boolean; pre: string }) {
  const [label, bg, fg] = BADGE[o.badge] || BADGE.info;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#F3F5F8;font-family:'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif;color:#1F2933">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E3E6EB;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:#09BEAF;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:18px 24px 14px;border-bottom:1px solid #EEF0F3"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="font-size:20px;font-weight:900;color:#1D3149">rental<span style="color:#09BEAF">aja</span></span><div style="font-size:11px;font-weight:800;color:#5B6573;letter-spacing:.06em">PROGRAM MITRA</div></td>
<td align="right"><span style="display:inline-block;font-size:12px;font-weight:800;color:${fg};background:${bg};border-radius:20px;padding:6px 12px">${esc(label)}</span></td></tr></table></td></tr>
<tr><td style="padding:22px 24px 4px"><div style="font-size:13px;color:#5B6573">Halo ${esc(o.name)},</div><h1 style="margin:4px 0 12px;font-size:21px;line-height:28px;color:#1D3149">${esc(o.title)}</h1>${o.inner}</td></tr>
<tr><td style="padding:6px 24px 4px" align="center"><a href="${PORTAL}" style="display:inline-block;background:#1D3149;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:15px;padding:13px 26px;border-radius:12px">Buka portal mitra</a></td></tr>
${o.code ? `<tr><td style="padding:12px 24px 0" align="center"><span style="font-size:12px;color:#5B6573">Kode Anda</span> <b style="font-family:Menlo,Consolas,monospace;font-size:15px;letter-spacing:.12em;color:#1D3149">${esc(o.code)}</b></td></tr>` : ""}
<tr><td style="padding:18px 24px 22px"><div style="border-top:1px solid #EEF0F3;padding-top:14px;font-size:12px;line-height:18px;color:#8A94A3">
Program Mitra Rentalaja · PT Popo Karya Investama, Garut.<br>${o.transactional ? "Email ini terkait akun mitra Anda." : `Anda menerima email ini sebagai Mitra Rentalaja. <a href="${o.unsub}" style="color:#8A94A3">Berhenti menerima info & promo</a>.`}
</div></td></tr></table></td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string, unsub?: string) {
  if (!BREVO) return "BREVO_API_KEY belum diisi";
  const body: Record<string, unknown> = { sender: { name: FROM_NAME, email: FROM_EMAIL }, to: [{ email: to }], subject, htmlContent: html, replyTo: { email: FROM_EMAIL, name: FROM_NAME } };
  if (unsub) body.headers = { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
    return r.ok ? null : `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`;
  } catch (e) { return String(e).slice(0, 200); }
}

async function notifs() {
  const { data, error } = await db.rpc("af_mail_claim_notifs", { p_limit: 40 });
  if (error) return { error: error.message };
  let sent = 0, failed = 0;
  for (const n of (data || []) as any[]) {
    if (!n.email) { await db.rpc("af_mail_notif_result", { p_id: n.id, p_error: "mitra tanpa email" }); failed++; continue; }
    const title = SUBJ[n.kind] || "Kabar dari Program Mitra Rentalaja";
    const html = shell({ badge: n.kind, name: n.name || "Mitra", title, inner: paras(n.text), code: n.code, transactional: true, pre: String(n.text || "").slice(0, 120) });
    const err = await send(n.email, title, html);
    if (err) { failed++; await db.rpc("af_mail_notif_result", { p_id: n.id, p_error: err }); } else sent++;
  }
  return { claimed: (data || []).length, sent, failed };
}

const fill = (s: string, x: any) => String(s || "").replace(/\{nama\}/g, x.name || "Mitra").replace(/\{kode\}/g, x.code || "")
  .replace(/\{kota\}/g, x.city || "").replace(/\{usaha\}/g, x.org || x.name || "").replace(/\{link\}/g, PORTAL);

async function campaigns() {
  const { data, error } = await db.rpc("af_mail_claim_sends", { p_limit: 40 });
  if (error) return { error: error.message };
  let sent = 0, failed = 0;
  for (const s of (data || []) as any[]) {
    const unsub = s.token ? UNSUB + s.token : PORTAL;
    const subject = (s.test ? "[UJI] " : "") + fill(s.subject, s);
    const html = shell({ badge: "info", name: s.name, title: fill(s.subject, s), inner: paras(fill(s.body, s)), code: s.test ? undefined : s.code,
      transactional: false, unsub, pre: fill(s.body, s).slice(0, 120) });
    const err = await send(s.to, subject, html, s.token ? unsub : undefined);
    await db.rpc("af_mail_send_result", { p_id: s.id, p_error: err });
    if (err) failed++; else sent++;
    await new Promise((x) => setTimeout(x, 150));
  }
  return { claimed: (data || []).length, sent, failed };
}

const page = (title: string, msg: string) => new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F3F5F8;font-family:Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px">
<div style="background:#fff;border:1px solid #E3E6EB;border-radius:16px;padding:26px;max-width:420px"><div style="font-size:20px;font-weight:900;color:#1D3149">rental<span style="color:#09BEAF">aja</span></div>
<h1 style="font-size:20px;color:#1D3149;margin:14px 0 6px">${esc(title)}</h1><p style="color:#5B6573;font-size:15px;line-height:22px;margin:0 0 16px">${msg}</p>
<a href="${PORTAL}" style="display:inline-block;background:#09BEAF;color:#1D3149;font-weight:800;text-decoration:none;padding:11px 18px;border-radius:10px">Buka portal mitra</a></div></body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const tok = u.searchParams.get("unsub");
  if (tok) {
    if (!/^[0-9a-f-]{36}$/i.test(tok)) return page("Tautan tidak valid", "Tautan berhenti langganan ini tidak dikenali.");
    if (req.method === "GET" && !u.searchParams.has("ok")) {
      return page("Berhenti menerima info & promo?", `Anda tetap menerima email penting tentang komisi dan pencairan. <br><br><a href="?unsub=${esc(tok)}&ok=1" style="color:#067A70;font-weight:800">Ya, berhenti menerima info & promo</a>`);
    }
    const { data } = await db.rpc("af_mail_optout", { p_token: tok });
    return page("Berhasil", data ? `${esc(data)} tidak akan menerima email info & promo lagi. Bisa diaktifkan kembali di portal mitra, menu Akun.` : "Tautan tidak dikenali.");
  }
  if (req.method !== "POST") return new Response("POST", { status: 405 });
  const out = { notifs: await notifs(), campaigns: await campaigns() };
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
