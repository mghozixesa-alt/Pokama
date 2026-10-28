// Sistem Kerja Pokama · pengirim email notifikasi
// mode "instant" (tiap 5 menit): kirim notifikasi penting yang belum terkirim, digabung per orang.
// mode "digest"  (07.00 WIB): ringkasan pagi per orang, sekali sehari.
// mode "test"    : kirim email uji ke pemanggil (harus login sebagai CEO / Kepala Staf).
// Layanan: Brevo (BREVO_API_KEY) atau Resend (RESEND_API_KEY). Tanpa kunci, tidak ada yang dikirim dan antrean tetap tersimpan.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const KEY = BREVO || RESEND;
const FROM_NAME = Deno.env.get("PK_MAIL_NAME") || "Sistem Kerja Pokama";
const FROM_EMAIL = Deno.env.get("PK_MAIL_FROM") || "notifikasi@pokama.org";
const APP = "https://pokama.org/";
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const CORS: Record<string, string> = { "Access-Control-Allow-Origin": "https://pokama.org", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const KIND: Record<string, string> = { tugas: "Tugas", review: "Review", rab: "Belanja", kkh: "KKH", cuti: "Kehadiran", permintaan: "Permintaan" };
const wibToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const wibHour = () => new Date(Date.now() + 7 * 3600e3).getUTCHours();

function shell(name: string, heading: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#F3F5F8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1F2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E3E6EB;border-radius:16px">
<tr><td style="padding:22px 24px 6px"><span style="font-size:20px;font-weight:900;color:#1D3149">poka<span style="color:#09BEAF">ma</span></span>
<div style="font-size:12px;color:#5B6573">Sistem Kerja Harian</div></td></tr>
<tr><td style="padding:10px 24px 4px"><div style="font-size:15px;color:#3B4250">Halo ${esc(name)},</div><h1 style="margin:6px 0 4px;font-size:19px;color:#1D3149">${esc(heading)}</h1></td></tr>
<tr><td style="padding:6px 24px 18px">${inner}</td></tr>
<tr><td style="padding:14px 24px 20px;border-top:1px solid #EEF0F3;font-size:12px;color:#8A94A3">Email otomatis dari pokama.org. Atur email notifikasi di menu Pengaturan.</td></tr>
</table></td></tr></table></body></html>`;
}
const btn = (href: string, label: string) => `<a href="${esc(href)}" style="display:inline-block;background:#09BEAF;color:#1D3149;text-decoration:none;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px">${esc(label)}</a>`;
const item = (n: any) => `<tr><td style="padding:10px 0;border-top:1px solid #EEF0F3">
  <div style="font-size:11px;font-weight:800;color:#067A70;letter-spacing:.04em">${esc((KIND[n.kind] || n.kind).toUpperCase())}</div>
  <div style="font-size:15px;font-weight:800;color:#1F2933;margin:2px 0">${esc(n.title)}</div>
  ${n.body ? `<div style="font-size:13px;color:#5B6573">${esc(n.body)}</div>` : ""}
  <div style="margin-top:6px"><a href="${esc(APP + (n.link || ""))}" style="font-size:13px;font-weight:800;color:#067A70">Buka →</a></div></td></tr>`;

async function send(to: string, subject: string, html: string) {
  if (!KEY) return { ok: false, skipped: "Kunci layanan email (BREVO_API_KEY) belum diisi" };
  const r = BREVO
    ? await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM_EMAIL }, to: [{ email: to }], subject, htmlContent: html }) })
    : await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }) });
  return r.ok ? { ok: true } : { ok: false, error: await r.text() };
}

async function people() {
  const { data } = await db.from("pk_people").select("id,name,nickname,email,notify_email,last_digest,is_active").eq("is_active", true);
  return (data || []).filter((p: any) => p.email && p.notify_email !== false);
}

async function instant() {
  const ppl = await people(); const byId = Object.fromEntries(ppl.map((p: any) => [p.id, p]));
  const { data: rows } = await db.from("pk_notifications").select("*").eq("urgent", true).is("emailed_at", null).order("created_at").limit(500);
  const groups: Record<string, any[]> = {};
  for (const n of rows || []) if (byId[n.person_id]) (groups[n.person_id] ||= []).push(n);
  let sent = 0; const errors: unknown[] = [];
  for (const [pid, list] of Object.entries(groups)) {
    const p = byId[pid]; const nm = p.nickname || p.name;
    const subject = list.length === 1 ? list[0].title : `${list.length} hal perlu tindakan Anda`;
    const html = shell(nm, list.length === 1 ? "Ada yang perlu tindakan Anda" : `${list.length} hal perlu tindakan Anda`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list.map(item).join("")}</table><div style="margin-top:14px">${btn(APP + (list[0].link || ""), "Buka Sistem Kerja")}</div>`);
    const r = await send(p.email, subject, html);
    if (r.ok) { sent++; await db.from("pk_notifications").update({ emailed_at: new Date().toISOString() }).in("id", list.map((x) => x.id)); }
    else errors.push({ to: p.email, ...r });
    if (!KEY) break;
  }
  // notifikasi penting untuk orang tanpa email / email dimatikan: tandai agar tidak menumpuk
  const skip = (rows || []).filter((n: any) => !byId[n.person_id]).map((n: any) => n.id);
  if (skip.length && KEY) await db.from("pk_notifications").update({ emailed_at: new Date().toISOString() }).in("id", skip);
  return { pending: (rows || []).length, sent, errors };
}

const LINES: [string, string, string][] = [
  ["kkh_kosong", "KKH hari ini belum diisi — isi rencana sebelum 08.00", "#/kkh"],
  ["review", "pekerjaan menunggu Anda cek", "#/review?tab=cek"],
  ["rab", "RAB menunggu persetujuan Anda", "#/belanja?tab=setujui"],
  ["cair", "RAB siap dicairkan", "#/belanja?tab=keuangan"],
  ["revisi", "pekerjaan Anda diminta revisi", "#/review?tab=saya"],
  ["revisi_telat", "revisi lewat tenggat", "#/review?tab=saya"],
  ["tenggat", "tugas bertenggat hari ini atau besok", "#/tugas?me=1"],
  ["nota_telat", "nota RAB terlambat — RAB berikutnya ditahan", "#/belanja?tab=saya"],
  ["validasi", "slot KKH tim menunggu validasi", "#/kkh"],
  ["cuti", "pengajuan cuti/izin/libur perlu disetujui", "#/kehadiran"],
  ["pilah", "permintaan perlu dipilah", "#/permintaan?tab=pilah"],
  ["permintaan", "permintaan diberikan ke Anda, belum diterima", "#/permintaan?tab=untuk"],
];

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const HARI = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const tgl = (d: string, long = false) => { const x = new Date(d + "T00:00:00Z"); return long ? `${["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][x.getUTCDay()]}, ${x.getUTCDate()} ${BULAN[x.getUTCMonth()]}` : `${HARI[x.getUTCDay()]} ${x.getUTCDate()}`; };
const head = (t: string) => `<div style="font-size:12px;font-weight:800;color:#5B6573;margin-top:18px;letter-spacing:.03em">${esc(t)}</div>`;
const bar = (pct: number, color = "#09BEAF") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px"><tr><td style="background:#EEF0F3;border-radius:6px;height:8px;font-size:0;line-height:0"><div style="width:${Math.max(2, Math.min(100, pct || 0))}%;background:${color};height:8px;border-radius:6px"></div></td></tr></table>`;
const tone = (pct: number) => pct >= 90 ? "#09BEAF" : pct >= 70 ? "#E8A33D" : "#D9534F";

// capaian kemarin + progres bulan + jejak per hari
function progress(m: any) {
  if (!m) return "";
  const y = m.yesterday || {}; const mon = new Date(m.month + "T00:00:00Z"); const bln = BULAN[mon.getUTCMonth()];
  const recap = m.days_left === 0 || wibToday().slice(0, 7) !== String(m.month).slice(0, 7);
  let h = head(`CAPAIAN KEMARIN · ${tgl(y.day, true).toUpperCase()}`);
  const rows: string[] = [];
  for (const w of y.work || []) rows.push(`<tr><td style="padding:6px 8px 6px 0;font-size:12px;color:#8A94A3;white-space:nowrap;vertical-align:top">${String(w.hour).padStart(2, "0")}.00</td><td style="padding:6px 0;font-size:14px;color:#1F2933"><b style="color:#1D3149">${esc(w.code)}</b> · ${esc(w.note)}${w.valid ? ` <span style="color:#067A70;font-weight:800">✓</span>` : ""}</td></tr>`);
  for (const t of y.done || []) rows.push(`<tr><td style="padding:6px 8px 6px 0;font-size:12px;color:#067A70;font-weight:800;vertical-align:top">SELESAI</td><td style="padding:6px 0;font-size:14px;color:#1F2933">${esc(t)}</td></tr>`);
  for (const t of (y.submitted || []).filter((x: string) => !(y.done || []).includes(x))) rows.push(`<tr><td style="padding:6px 8px 6px 0;font-size:12px;color:#5B6573;font-weight:800;vertical-align:top">DIAJUKAN</td><td style="padding:6px 0;font-size:14px;color:#1F2933">${esc(t)}</td></tr>`);
  if (+y.reviewed > 0) rows.push(`<tr><td style="padding:6px 8px 6px 0;font-size:12px;color:#5B6573;font-weight:800;vertical-align:top">REVIEW</td><td style="padding:6px 0;font-size:14px;color:#1F2933">${y.reviewed} pekerjaan tim dicek</td></tr>`);
  h += rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEF0F3;margin-top:4px">${rows.join("")}</table>`
    : `<div style="font-size:14px;color:#5B6573;padding:8px 0">Belum ada catatan kerja kemarin. Isi catatan di KKH supaya capaian Anda tercatat.</div>`;

  h += head(recap ? `REKAP BULAN ${bln.toUpperCase()}` : `PROGRES ${bln.toUpperCase()} · SISA ${m.days_left} HARI`);
  const stat = (v: string, l: string) => `<td width="33%" style="padding:10px 6px;text-align:center;background:#F7F8FA;border-radius:10px"><div style="font-size:20px;font-weight:900;color:#1D3149">${v}</div><div style="font-size:11px;color:#5B6573">${l}</div></td>`;
  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="margin-top:4px"><tr>${stat(m.cap == null ? "–" : m.cap + "%", "capaian target")}${stat(m.kkh == null ? "–" : m.kkh + "%", `KKH valid (${m.valid}/${m.slots})`)}${stat(String(m.done), "tugas selesai")}</tr></table>`;
  if ((m.outputs || []).length) h += (m.outputs as any[]).map((o) => `<div style="margin-top:10px;font-size:13px;color:#1F2933"><b>${esc(o.name)}</b> <span style="float:right;color:#5B6573">${(+o.actual).toLocaleString("id-ID")} / ${(+o.target).toLocaleString("id-ID")} · <b style="color:#1D3149">${o.pct ?? 0}%</b></span></div>${bar(o.pct, tone(o.pct))}`).join("");
  else h += `<div style="font-size:13px;color:#5B6573;margin-top:8px">Target output bulan ini belum ditetapkan.</div>`;
  if (m.score != null) h += `<div style="font-size:13px;color:#5B6573;margin-top:10px">Skor performa sementara <b style="color:#1D3149">${m.score}</b>${m.eligible ? "" : " · KKH valid masih di bawah 80%, insentif belum memenuhi syarat"}.</div>`;

  const days = (m.days || []) as any[];
  if (days.length) {
    h += head("JEJAK HARIAN BULAN INI");
    h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">` + days.slice().reverse().map((d) => {
      const txt = d.off ? `<span style="color:#5B6573">${esc(d.off === "cuti" ? "Cuti" : d.off === "izin" ? "Izin" : "Libur")}</span>`
        : `${d.slots} jam tercatat${d.valid ? `, ${d.valid} valid` : ""}${(d.done || []).length ? ` · <b>selesai:</b> ${(d.done as string[]).map(esc).join(", ")}` : ""}`;
      return `<tr><td style="padding:5px 10px 5px 0;border-top:1px solid #F0F2F5;font-size:12px;font-weight:800;color:#1D3149;white-space:nowrap;vertical-align:top">${tgl(d.day)}</td><td style="padding:5px 0;border-top:1px solid #F0F2F5;font-size:13px;color:#3B4250">${txt}</td></tr>`;
    }).join("") + `</table>`;
  }
  return h + `<div style="margin-top:8px"><a href="${APP}#/performa" style="font-size:13px;font-weight:800;color:#067A70">Lihat performa lengkap →</a></div>`;
}

async function digest(force = false) {
  if (!force && wibHour() < 7) return { skipped: "belum jam 07.00 WIB" };
  const today = wibToday(); const ppl = await people(); let sent = 0; const errors: unknown[] = [];
  const { data: off } = await db.from("pk_leave").select("person_id,day,end_day").eq("status", "disetujui").lte("day", today);
  for (const p of ppl) {
    if (!force && p.last_digest && p.last_digest >= today) continue;
    if ((off || []).some((l: any) => l.person_id === p.id && today >= l.day && today <= (l.end_day || l.day))) { await db.from("pk_people").update({ last_digest: today }).eq("id", p.id); continue; }
    const { data: it } = await db.rpc("pk_digest_items", { p: p.id });
    const { data: mp } = await db.rpc("pk_month_progress", { p: p.id });
    const { data: fyi } = await db.from("pk_notifications").select("*").eq("person_id", p.id).eq("urgent", false).is("emailed_at", null).order("created_at").limit(30);
    const lines = LINES.filter(([k]) => it && (k === "kkh_kosong" ? it[k] === true : +it[k] > 0))
      .map(([k, txt, lk]) => `<tr><td style="padding:9px 0;border-top:1px solid #EEF0F3;font-size:14px">${k === "kkh_kosong" ? "" : `<b style="color:#1D3149;font-size:16px">${it[k]}</b> `}<a href="${APP + lk}" style="color:#1F2933;text-decoration:none">${esc(txt)}</a> <a href="${APP + lk}" style="color:#067A70;font-weight:800;text-decoration:none">→</a></td></tr>`);
    const nm = p.nickname || p.name;
    const inner = (lines.length ? `<div style="font-size:12px;font-weight:800;color:#5B6573;margin-top:4px">PERLU DIKERJAKAN HARI INI</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines.join("")}</table>` : "")
      + progress(mp)
      + ((fyi || []).length ? `<div style="font-size:12px;font-weight:800;color:#5B6573;margin-top:18px">KABAR SEJAK KEMARIN</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${(fyi || []).map(item).join("")}</table>` : "")
      + `<div style="margin-top:16px">${btn(APP, "Buka Sistem Kerja")}</div>`;
    const r = await send(p.email, lines.length ? `Ringkasan pagi · ${lines.length} hal perlu dikerjakan` : `Ringkasan pagi · capaian kemarin & progres bulan ini`, shell(nm, "Ringkasan pagi Anda", inner));
    if (r.ok) { sent++; await db.from("pk_people").update({ last_digest: today }).eq("id", p.id);
      if ((fyi || []).length) await db.from("pk_notifications").update({ emailed_at: new Date().toISOString() }).in("id", (fyi || []).map((x: any) => x.id)); }
    else { errors.push({ to: p.email, ...r }); if (!KEY) break; }
  }
  return { sent, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST saja" }, 405);
  let body: any = {}; try { body = await req.json(); } catch { /* kosong */ }
  try {
    if (body.mode === "digest") return json(await digest(false));
    if (body.mode === "test") {
      const asUser = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
      const { data: role } = await asUser.rpc("pk_role"); const { data: me } = await asUser.rpc("pk_me");
      if (!(role === "ceo" || role === "kepala_staf")) return json({ error: "Hanya CEO atau Kepala Staf" }, 403);
      const { data: p } = await db.from("pk_people").select("name,nickname,email").eq("id", me).maybeSingle();
      if (!p?.email) return json({ error: "Email Anda belum terdaftar" }, 400);
      if (!KEY) return json({ error: "Layanan email belum disambungkan (BREVO_API_KEY belum diisi)" }, 400);
      const { data: mp } = await db.rpc("pk_month_progress", { p: me });
      const r = await send(p.email, "Uji email notifikasi Pokama", shell(p.nickname || p.name, "Email notifikasi sudah tersambung",
        `<p style="font-size:14px;color:#3B4250">Mulai sekarang hal yang perlu tindakan dikirim langsung, sisanya dirangkum setiap pagi jam 07.00. Contoh bagian progres di ringkasan pagi Anda:</p>${progress(mp)}<div style="margin-top:16px">${btn(APP, "Buka Sistem Kerja")}</div>`));
      return json({ to: p.email, ...r }, r.ok ? 200 : 400);
    }
    return json(await instant());
  } catch (e) { return json({ error: String(e) }, 500); }
});
