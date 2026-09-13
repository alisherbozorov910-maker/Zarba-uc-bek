import React, { useState, useEffect, useCallback } from "react";
import { Check, Clock, ShieldCheck, Plus, Trash2, LogOut, Search, ChevronRight, Zap, Ban, User, Wallet, Upload, Globe, LifeBuoy } from "lucide-react";
import { supabase } from "./supabaseClient";
import { makeT } from "./i18n";

const SEED_PACKAGES = [
  { id: "p1", uc: 60, price: 14000, popular: false, active: true },
  { id: "p2", uc: 325, price: 69000, popular: false, active: true },
  { id: "p3", uc: 660, price: 138000, popular: true, active: true },
  { id: "p4", uc: 1800, price: 345000, popular: false, active: true },
  { id: "p5", uc: 3850, price: 690000, popular: false, active: true },
  { id: "p6", uc: 8100, price: 1380000, popular: false, active: true },
];

const ADMIN_PASS = "alisherbek20134";

function fmt(n) {
  return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function genId() {
  return "ZB" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function fromDbOrder(o) {
  return { id: o.id, uc: o.uc, price: o.price, pubgId: o.pubg_id, phone: o.phone, payment: o.payment, status: o.status, createdAt: new Date(o.created_at).getTime() };
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("zarba:lang") || "uz");
  const t = makeT(lang);
  function changeLang(l) { setLang(l); localStorage.setItem("zarba:lang", l); }

  const [packages, setPackages] = useState(SEED_PACKAGES);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("store");
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [form, setForm] = useState({ pubgId: "", phone: "", payment: "payme" });
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [checkId, setCheckId] = useState("");
  const [checkResult, setCheckResult] = useState(undefined);
  const [saveError, setSaveError] = useState(false);

  const [adminAuthed, setAdminAuthed] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [adminTab, setAdminTab] = useState("orders");
  const [newPkg, setNewPkg] = useState({ uc: "", price: "" });
  const [allTopups, setAllTopups] = useState([]);
  const [allSupport, setAllSupport] = useState([]);
  const [settings, setSettings] = useState({ card_number: "", card_owner: "" });
  const [settingsDraft, setSettingsDraft] = useState({ card_number: "", card_owner: "" });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", phone: "" });
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [myTopups, setMyTopups] = useState([]);
  const [topupForm, setTopupForm] = useState({ amount: "", file: null });
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMsg, setTopupMsg] = useState("");

  const [mySupport, setMySupport] = useState([]);
  const [supportMsg, setSupportMsg] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  const loadPackages = useCallback(async () => {
    const { data, error } = await supabase.from("packages").select("*").order("price", { ascending: true });
    if (error) { setSaveError(true); return; }
    if (!data || data.length === 0) {
      const { data: seeded } = await supabase.from("packages").insert(SEED_PACKAGES).select();
      setPackages(seeded || SEED_PACKAGES);
    } else setPackages(data);
  }, []);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) { setSaveError(true); return; }
    setOrders((data || []).map(fromDbOrder));
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (data) { setSettings(data); setSettingsDraft(data); }
  }, []);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data || null);
  }, []);

  const loadMyTopups = useCallback(async (userId) => {
    const { data } = await supabase.from("topup_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMyTopups(data || []);
  }, []);

  const loadMySupport = useCallback(async (userId) => {
    const { data } = await supabase.from("support_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMySupport(data || []);
  }, []);

  const loadAllTopups = useCallback(async () => {
    const { data } = await supabase.from("topup_requests").select("*").order("created_at", { ascending: false });
    setAllTopups(data || []);
  }, []);

  const loadAllSupport = useCallback(async () => {
    const { data } = await supabase.from("support_messages").select("*").order("created_at", { ascending: false });
    setAllSupport(data || []);
  }, []);

  useEffect(() => {
    loadPackages();
    loadOrders();
    loadSettings();

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));

    const channel = supabase
      .channel("zarba-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "packages" }, loadPackages)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, loadSettings)
      .subscribe();

    return () => { supabase.removeChannel(channel); sub.subscription.unsubscribe(); };
  }, [loadPackages, loadOrders, loadSettings]);

  useEffect(() => {
    if (session?.user) {
      loadProfile(session.user.id);
      loadMyTopups(session.user.id);
      loadMySupport(session.user.id);
    } else {
      setProfile(null);
    }
  }, [session, loadProfile, loadMyTopups, loadMySupport]);

  useEffect(() => {
    if (view === "admin" && adminAuthed) {
      loadAllTopups();
      loadAllSupport();
      const ch = supabase
        .channel("zarba-admin-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "topup_requests" }, loadAllTopups)
        .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, loadAllSupport)
        .subscribe();
      return () => supabase.removeChannel(ch);
    }
  }, [view, adminAuthed, loadAllTopups, loadAllSupport]);

  function selectPkg(pkg) {
    setSelectedPkg(pkg);
    setSubmittedOrder(null);
    setTimeout(() => document.getElementById("zarba-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function submitOrder(e) {
    e.preventDefault();
    if (!selectedPkg || !/^\d{6,12}$/.test(form.pubgId) || form.phone.trim().length < 7) return;
    if (form.payment === "balance") {
      if (!profile || profile.balance < selectedPkg.price) { setTopupMsg(""); alert(t("order_insufficient")); return; }
    }
    const row = { id: genId(), uc: selectedPkg.uc, price: selectedPkg.price, pubg_id: form.pubgId.trim(), phone: form.phone.trim(), payment: form.payment, status: form.payment === "balance" ? "paid" : "pending" };
    const { data, error } = await supabase.from("orders").insert(row).select().single();
    if (error) { setSaveError(true); return; }
    if (form.payment === "balance") {
      const newBalance = profile.balance - selectedPkg.price;
      await supabase.from("profiles").update({ balance: newBalance }).eq("id", session.user.id);
      setProfile({ ...profile, balance: newBalance });
    }
    const order = fromDbOrder(data);
    setOrders([order, ...orders]);
    setSubmittedOrder(order);
    setSelectedPkg(null);
    setForm({ pubgId: "", phone: "", payment: "payme" });
  }

  function runCheck(e) {
    e.preventDefault();
    const found = orders.find((o) => o.id.toLowerCase() === checkId.trim().toLowerCase());
    setCheckResult(found || null);
  }

  function tryAdminLogin(e) {
    e.preventDefault();
    if (passInput === ADMIN_PASS) { setAdminAuthed(true); setPassError(false); }
    else setPassError(true);
  }

  async function setOrderStatus(id, status) {
    setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { setSaveError(true); loadOrders(); }
  }

  async function addPackage(e) {
    e.preventDefault();
    const uc = parseInt(newPkg.uc, 10);
    const price = parseInt(newPkg.price, 10);
    if (!uc || !price) return;
    const row = { id: "p" + Date.now(), uc, price, popular: false, active: true };
    const { data, error } = await supabase.from("packages").insert(row).select().single();
    if (error) { setSaveError(true); return; }
    setPackages([...packages, data]);
    setNewPkg({ uc: "", price: "" });
  }

  async function updatePackage(id, patch) {
    setPackages(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("packages").update(patch).eq("id", id);
    if (error) { setSaveError(true); loadPackages(); }
  }

  async function removePackage(id) {
    setPackages(packages.filter((p) => p.id !== id));
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) { setSaveError(true); loadPackages(); }
  }

  async function saveSettings(e) {
    e.preventDefault();
    const { error } = await supabase.from("settings").update(settingsDraft).eq("id", 1);
    if (!error) { setSettings(settingsDraft); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); }
  }

  async function approveTopup(reqRow) {
    setAllTopups(allTopups.map((r) => (r.id === reqRow.id ? { ...r, status: "approved" } : r)));
    const { data: prof } = await supabase.from("profiles").select("balance").eq("id", reqRow.user_id).single();
    const newBalance = (prof?.balance || 0) + reqRow.amount;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", reqRow.user_id);
    await supabase.from("topup_requests").update({ status: "approved" }).eq("id", reqRow.id);
    if (session?.user?.id === reqRow.user_id) setProfile((p) => (p ? { ...p, balance: newBalance } : p));
  }

  async function rejectTopup(id) {
    setAllTopups(allTopups.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
    await supabase.from("topup_requests").update({ status: "rejected" }).eq("id", id);
  }

  async function markSupportAnswered(id) {
    setAllSupport(allSupport.map((m) => (m.id === id ? { ...m, status: "answered" } : m)));
    await supabase.from("support_messages").update({ status: "answered" }).eq("id", id);
  }

  async function signUp(e) {
    e.preventDefault();
    setAuthError(""); setAuthNotice("");
    const { error } = await supabase.auth.signUp({
      email: authForm.email.trim(),
      password: authForm.password,
      options: { data: { phone: authForm.phone.trim() } },
    });
    if (error) setAuthError(error.message);
    else setAuthNotice(t("acc_check_email"));
  }

  async function signIn(e) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: authForm.email.trim(), password: authForm.password });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function submitTopup(e) {
    e.preventDefault();
    const amount = parseInt(topupForm.amount, 10);
    if (!amount || amount <= 0 || !session?.user) return;
    setTopupBusy(true);
    let receipt_url = null;
    try {
      if (topupForm.file) {
        const ext = topupForm.file.name.split(".").pop();
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, topupForm.file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
        receipt_url = pub.publicUrl;
      }
      const row = { user_id: session.user.id, phone: profile?.phone || "", amount, receipt_url, status: "pending" };
      const { error } = await supabase.from("topup_requests").insert(row);
      if (error) throw error;
      setTopupMsg(t("topup_sent"));
      setTopupForm({ amount: "", file: null });
      loadMyTopups(session.user.id);
    } catch (err) {
      setSaveError(true);
    } finally {
      setTopupBusy(false);
    }
  }

  async function submitSupport(e) {
    e.preventDefault();
    if (!supportMsg.trim() || !session?.user) return;
    setSupportBusy(true);
    const row = { user_id: session.user.id, phone: profile?.phone || "", message: supportMsg.trim(), status: "new" };
    const { error } = await supabase.from("support_messages").insert(row);
    setSupportBusy(false);
    if (!error) {
      setSupportMsg("");
      setSupportSent(true);
      loadMySupport(session.user.id);
      setTimeout(() => setSupportSent(false), 3000);
    } else setSaveError(true);
  }

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap');
        .zb-root * { box-sizing: border-box; }
        .zb-root { font-family: 'Manrope', system-ui, sans-serif; color: var(--text); }
        .zb-h { font-family: 'Oswald', system-ui, sans-serif; letter-spacing: 0.01em; }
        .zb-card { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
        .zb-btn { font-family: 'Oswald', system-ui, sans-serif; letter-spacing: 0.03em; cursor: pointer; border: none; transition: transform .12s ease, background .15s ease; }
        .zb-btn:active { transform: scale(0.97); }
        .zb-input { background: var(--bg); border: 1px solid var(--line); color: var(--text); border-radius: 4px; font-family: 'Manrope', sans-serif; }
        .zb-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
        .zb-pkg { cursor: pointer; transition: border-color .15s ease, background .15s ease; }
        .zb-pkg:hover { border-color: var(--accent-dim); }
        .zb-pkg.sel { border-color: var(--accent); background: var(--surface2); }
        .zb-nav-link { cursor: pointer; font-family: 'Oswald', system-ui, sans-serif; letter-spacing: .02em; }
        .zb-nav-link:hover { color: var(--accent); }
        table.zb-table { border-collapse: collapse; width: 100%; }
        table.zb-table th { text-align: left; font-family: 'Oswald', sans-serif; font-weight: 500; color: var(--text-muted); font-size: 12px; padding: 8px 10px; border-bottom: 1px solid var(--line); }
        table.zb-table td { padding: 10px; border-bottom: 1px solid var(--line); font-size: 13px; }
        select.zb-status { background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 4px; padding: 4px 6px; font-family: 'Manrope'; font-size: 12px; }
        .zb-lang-btn { background: transparent; border: 1px solid var(--line); color: var(--text-muted); border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; font-family: 'Oswald'; }
        .zb-lang-btn.on { color: var(--accent); border-color: var(--accent); }
        ::selection { background: var(--accent); color: #12140F; }
      `}</style>
      <div className="zb-root" style={{ minHeight: "100%" }}>
        {view === "store" && (
          <Store
            t={t} lang={lang} changeLang={changeLang}
            packages={packages.filter((p) => p.active)}
            selectedPkg={selectedPkg} onSelect={selectPkg}
            form={form} setForm={setForm}
            submittedOrder={submittedOrder} onSubmit={submitOrder}
            checkId={checkId} setCheckId={setCheckId} checkResult={checkResult} runCheck={runCheck}
            goAdmin={() => setView("admin")} goAccount={() => setView("account")} goSupport={() => setView("support")}
            session={session} profile={profile}
          />
        )}
        {view === "account" && (
          <Account
            t={t} lang={lang} changeLang={changeLang}
            session={session} profile={profile}
            authMode={authMode} setAuthMode={setAuthMode}
            authForm={authForm} setAuthForm={setAuthForm}
            authError={authError} authNotice={authNotice}
            signUp={signUp} signIn={signIn} signOut={signOut}
            settings={settings}
            topupForm={topupForm} setTopupForm={setTopupForm}
            submitTopup={submitTopup} topupBusy={topupBusy} topupMsg={topupMsg}
            myTopups={myTopups}
            goStore={() => setView("store")} goSupport={() => setView("support")}
          />
        )}
        {view === "support" && (
          <Support
            t={t} lang={lang} changeLang={changeLang}
            session={session} supportMsg={supportMsg} setSupportMsg={setSupportMsg}
            submitSupport={submitSupport} supportBusy={supportBusy} supportSent={supportSent}
            mySupport={mySupport}
            goStore={() => setView("store")} goAccount={() => setView("account")}
          />
        )}
        {view === "admin" && (
          <Admin
            t={t}
            authed={adminAuthed} passInput={passInput} setPassInput={setPassInput} passError={passError} tryLogin={tryAdminLogin}
            orders={orders} packages={packages}
            adminTab={adminTab} setAdminTab={setAdminTab}
            setOrderStatus={setOrderStatus}
            newPkg={newPkg} setNewPkg={setNewPkg} addPackage={addPackage} updatePackage={updatePackage} removePackage={removePackage}
            allTopups={allTopups} approveTopup={approveTopup} rejectTopup={rejectTopup}
            allSupport={allSupport} markSupportAnswered={markSupportAnswered}
            settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} saveSettings={saveSettings} settingsSaved={settingsSaved}
            logout={() => { setAdminAuthed(false); setPassInput(""); }}
            goStore={() => setView("store")}
          />
        )}
        {saveError && (
          <div style={{ position: "fixed", bottom: 12, left: 12, right: 12, background: "var(--danger)", color: "#fff", padding: "10px 14px", borderRadius: 6, fontSize: 13, textAlign: "center" }} onClick={() => setSaveError(false)}>
            Xatolik yuz berdi. Qayta urinib ko'ring.
          </div>
        )}
      </div>
    </div>
  );
}

function LangSwitch({ lang, changeLang }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <Globe size={13} color="var(--text-muted)" />
      <button className={"zb-lang-btn" + (lang === "uz" ? " on" : "")} onClick={() => changeLang("uz")}>UZ</button>
      <button className={"zb-lang-btn" + (lang === "ru" ? " on" : "")} onClick={() => changeLang("ru")}>RU</button>
    </div>
  );
}

function TopNav({ t, lang, changeLang, goStore, goPackages, goCheck, goAccount, goSupport, goAdmin }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap", gap: 10 }}>
      <div className="zb-h" style={{ fontSize: 20, fontWeight: 700, cursor: "pointer" }} onClick={goStore}>
        ZARBA<span style={{ color: "var(--accent)" }}>.UC</span>
      </div>
      <nav style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
        {goPackages && <span className="zb-nav-link" style={{ color: "var(--text-muted)" }} onClick={goPackages}>{t("nav_packages")}</span>}
        {goCheck && <span className="zb-nav-link" style={{ color: "var(--text-muted)" }} onClick={goCheck}>{t("nav_check")}</span>}
        <span className="zb-nav-link" style={{ color: "var(--text-muted)" }} onClick={goAccount}>{t("nav_account")}</span>
        <span className="zb-nav-link" style={{ color: "var(--text-muted)" }} onClick={goSupport}>{t("nav_support")}</span>
        <span className="zb-nav-link" style={{ color: "var(--text-muted)" }} onClick={goAdmin}>{t("nav_admin")}</span>
        <LangSwitch lang={lang} changeLang={changeLang} />
      </nav>
    </header>
  );
}

function Store({ t, lang, changeLang, packages, selectedPkg, onSelect, form, setForm, submittedOrder, onSubmit, checkId, setCheckId, checkResult, runCheck, goAdmin, goAccount, goSupport, session, profile }) {
  return (
    <div>
      <TopNav t={t} lang={lang} changeLang={changeLang}
        goStore={() => {}}
        goPackages={() => document.getElementById("zarba-packages")?.scrollIntoView({ behavior: "smooth" })}
        goCheck={() => document.getElementById("zarba-check")?.scrollIntoView({ behavior: "smooth" })}
        goAccount={goAccount} goSupport={goSupport} goAdmin={goAdmin}
      />

      <section style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", padding: "48px 20px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 12, fontFamily: "'Oswald'", letterSpacing: ".04em", marginBottom: 10 }}>
            <Zap size={13} /> {t("hero_eyebrow")}
          </div>
          <h1 className="zb-h" style={{ fontSize: 40, lineHeight: 1.08, fontWeight: 700, margin: "0 0 14px" }}>{t("hero_title")}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, maxWidth: 440, margin: "0 0 22px" }}>{t("hero_desc")}</p>
          <button className="zb-btn" style={{ background: "var(--accent)", color: "#161810", padding: "12px 22px", borderRadius: 4, fontSize: 14, fontWeight: 600 }} onClick={() => document.getElementById("zarba-packages")?.scrollIntoView({ behavior: "smooth" })}>
            {t("hero_cta")}
          </button>
        </div>
        <div style={{ flex: "0 0 200px" }}><DropSVG /></div>
      </section>

      <section id="zarba-packages" style={{ padding: "10px 20px 50px", maxWidth: 980, margin: "0 auto" }}>
        <h2 className="zb-h" style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>{t("packages_title")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {packages.map((p) => (
            <div key={p.id} className={"zb-card zb-pkg" + (selectedPkg?.id === p.id ? " sel" : "")} onClick={() => onSelect(p)} style={{ padding: 16, position: "relative" }}>
              {p.popular && <div style={{ position: "absolute", top: -1, right: -1, background: "var(--accent)", color: "#161810", fontSize: 10, fontFamily: "'Oswald'", padding: "3px 8px", borderRadius: "0 5px 0 5px" }}>{t("popular")}</div>}
              <div className="zb-h" style={{ fontSize: 22, fontWeight: 600 }}>{fmt(p.uc)} <span style={{ fontSize: 13, color: "var(--text-muted)" }}>UC</span></div>
              <div style={{ marginTop: 8, fontSize: 15, color: "var(--accent)", fontWeight: 600 }}>{fmt(p.price)} so'm</div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>{t("select")} <ChevronRight size={12} /></div>
            </div>
          ))}
        </div>
      </section>

      <section id="zarba-order-form" style={{ padding: "10px 20px 60px", maxWidth: 560, margin: "0 auto" }}>
        {submittedOrder ? (
          <div className="zb-card" style={{ padding: 22, textAlign: "center" }}>
            <Check size={30} color="var(--accent)" style={{ marginBottom: 8 }} />
            <h3 className="zb-h" style={{ fontSize: 18, marginBottom: 6 }}>{t("order_success_title")}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
              {t("order_success_id")}: <strong style={{ color: "var(--text)" }}>{submittedOrder.id}</strong>. {t("order_success_save")}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {submittedOrder.payment === "balance" ? t("order_success_balance") : t("order_success_manual")}
            </p>
          </div>
        ) : selectedPkg ? (
          <form className="zb-card" onSubmit={onSubmit} style={{ padding: 22 }}>
            <h3 className="zb-h" style={{ fontSize: 18, marginBottom: 4 }}>{t("order_title")}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>{t("order_selected")}: {fmt(selectedPkg.uc)} UC — {fmt(selectedPkg.price)} so'm</p>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("order_pubgid")}</label>
            <input className="zb-input" required pattern="\d{6,12}" placeholder="5123456789" value={form.pubgId} onChange={(e) => setForm({ ...form, pubgId: e.target.value })} style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14 }} />
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("order_phone")}</label>
            <input className="zb-input" required placeholder="+998 90 123 45 67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14 }} />
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{t("order_payment")}</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {["payme", "click", "balance"].map((m) => (
                <div key={m} onClick={() => setForm({ ...form, payment: m })} className="zb-card" style={{ flex: "1 1 80px", padding: "10px 0", textAlign: "center", cursor: "pointer", borderColor: form.payment === m ? "var(--accent)" : "var(--line)", background: form.payment === m ? "var(--surface2)" : "var(--surface)" }}>
                  <span className="zb-h" style={{ fontSize: 12, textTransform: "uppercase" }}>{m === "balance" ? t("order_pay_balance") : m}</span>
                </div>
              ))}
            </div>
            {form.payment === "balance" && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{t("acc_balance")}: {fmt(profile?.balance)} so'm</p>
            )}
            <button type="submit" className="zb-btn" style={{ width: "100%", background: "var(--accent)", color: "#161810", padding: "12px 0", borderRadius: 4, fontSize: 14, fontWeight: 600 }}>{t("order_confirm")}</button>
          </form>
        ) : (
          <div className="zb-card" style={{ padding: 22, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{t("order_empty")}</div>
        )}
      </section>

      <section id="zarba-check" style={{ padding: "10px 20px 60px", maxWidth: 560, margin: "0 auto" }}>
        <h2 className="zb-h" style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>{t("check_title")}</h2>
        <form className="zb-card" onSubmit={runCheck} style={{ padding: 18, display: "flex", gap: 10 }}>
          <input className="zb-input" placeholder={t("check_placeholder")} value={checkId} onChange={(e) => setCheckId(e.target.value)} style={{ flex: 1, padding: "10px 12px", fontSize: 14 }} />
          <button type="submit" className="zb-btn" style={{ background: "var(--olive)", color: "#fff", padding: "0 16px", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}><Search size={14} /> {t("check_btn")}</button>
        </form>
        {checkResult !== undefined && (
          <div className="zb-card" style={{ marginTop: 12, padding: 16, fontSize: 13 }}>
            {checkResult ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div>{fmt(checkResult.uc)} UC — {fmt(checkResult.price)} so'm</div>
                  <div style={{ color: "var(--text-muted)", marginTop: 4 }}>ID: {checkResult.pubgId}</div>
                </div>
                <StatusBadge t={t} status={checkResult.status} />
              </div>
            ) : <span style={{ color: "var(--text-muted)" }}>{t("check_notfound")}</span>}
          </div>
        )}
      </section>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "18px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>{t("footer")}</footer>
    </div>
  );
}

function StatusBadge({ t, status }) {
  const map = {
    pending: { color: "var(--text-muted)", icon: <Clock size={12} />, key: "status_pending" },
    paid: { color: "var(--accent)", icon: <ShieldCheck size={12} />, key: "status_paid" },
    delivered: { color: "var(--success)", icon: <Check size={12} />, key: "status_delivered" },
    cancelled: { color: "var(--danger)", icon: <Ban size={12} />, key: "status_cancelled" },
    approved: { color: "var(--success)", icon: <Check size={12} />, key: "status_approved" },
    rejected: { color: "var(--danger)", icon: <Ban size={12} />, key: "status_rejected" },
  };
  const s = map[status] || map.pending;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: s.color, fontSize: 12, fontFamily: "'Oswald'" }}>{s.icon} {t(s.key)}</span>;
}

function DropSVG() {
  return (
    <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle cx="100" cy="100" r="32" fill="none" stroke="var(--olive)" strokeWidth="1.5" />
      <line x1="100" y1="4" x2="100" y2="196" stroke="var(--line)" strokeWidth="1" />
      <line x1="4" y1="100" x2="196" y2="100" stroke="var(--line)" strokeWidth="1" />
      <path d="M100 40 L112 96 L100 160 L88 96 Z" fill="var(--accent)" opacity="0.85" />
      <circle cx="100" cy="96" r="5" fill="#161810" />
      <circle cx="150" cy="60" r="3" fill="var(--olive)" />
      <circle cx="55" cy="140" r="3" fill="var(--olive)" />
    </svg>
  );
}

function Account(props) {
  const { t, lang, changeLang, session, profile, authMode, setAuthMode, authForm, setAuthForm, authError, authNotice, signUp, signIn, signOut, settings, topupForm, setTopupForm, submitTopup, topupBusy, topupMsg, myTopups, goStore, goSupport } = props;

  return (
    <div>
      <TopNav t={t} lang={lang} changeLang={changeLang} goStore={goStore} goAccount={() => {}} goSupport={goSupport} goAdmin={goStore} />
      <div style={{ padding: "30px 20px 60px", maxWidth: 560, margin: "0 auto" }}>
        {!session ? (
          <div className="zb-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <button className="zb-btn" onClick={() => setAuthMode("login")} style={{ flex: 1, padding: "9px 0", borderRadius: 4, background: authMode === "login" ? "var(--accent)" : "var(--surface2)", color: authMode === "login" ? "#161810" : "var(--text-muted)", fontSize: 13 }}>{t("acc_login")}</button>
              <button className="zb-btn" onClick={() => setAuthMode("signup")} style={{ flex: 1, padding: "9px 0", borderRadius: 4, background: authMode === "signup" ? "var(--accent)" : "var(--surface2)", color: authMode === "signup" ? "#161810" : "var(--text-muted)", fontSize: 13 }}>{t("acc_signup")}</button>
            </div>
            <form onSubmit={authMode === "login" ? signIn : signUp}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("acc_email")}</label>
              <input className="zb-input" required type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14 }} />
              {authMode === "signup" && (
                <>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("acc_phone")}</label>
                  <input className="zb-input" required value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="+998 90 123 45 67" style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14 }} />
                </>
              )}
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("acc_password")}</label>
              <input className="zb-input" required type="password" minLength={6} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} style={{ width: "100%", padding: "10px 12px", marginBottom: 16, fontSize: 14 }} />
              {authError && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{authError}</div>}
              {authNotice && <div style={{ color: "var(--success)", fontSize: 12, marginBottom: 12 }}>{authNotice}</div>}
              <button type="submit" className="zb-btn" style={{ width: "100%", background: "var(--accent)", color: "#161810", padding: "11px 0", borderRadius: 4, fontWeight: 600, fontSize: 13 }}>
                {authMode === "login" ? t("acc_login_btn") : t("acc_signup_btn")}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="zb-card" style={{ padding: 22, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 12, marginBottom: 6 }}><User size={13} /> {session.user.email}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Wallet size={16} color="var(--accent)" />
                  <span className="zb-h" style={{ fontSize: 22, fontWeight: 700 }}>{fmt(profile?.balance)} so'm</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{t("acc_balance")}</div>
              </div>
              <span className="zb-nav-link" style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }} onClick={signOut}><LogOut size={13} /> {t("acc_logout")}</span>
            </div>

            <form className="zb-card" onSubmit={submitTopup} style={{ padding: 22, marginBottom: 18 }}>
              <h3 className="zb-h" style={{ fontSize: 16, marginBottom: 12 }}>{t("topup_title")}</h3>
              {settings.card_number ? (
                <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 4, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("topup_card_label")}</div>
                  <div className="zb-h" style={{ fontSize: 18, letterSpacing: "1px" }}>{settings.card_number}</div>
                  {settings.card_owner && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{settings.card_owner}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{t("topup_no_card")}</div>
              )}
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("topup_amount")}</label>
              <input className="zb-input" required type="number" min="1000" value={topupForm.amount} onChange={(e) => setTopupForm({ ...topupForm, amount: e.target.value })} style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14 }} />
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("topup_receipt")}</label>
              <label className="zb-card" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 16, cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>
                <Upload size={15} /> {topupForm.file ? topupForm.file.name : t("topup_receipt")}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setTopupForm({ ...topupForm, file: e.target.files[0] })} />
              </label>
              <button type="submit" disabled={topupBusy} className="zb-btn" style={{ width: "100%", background: "var(--accent)", color: "#161810", padding: "11px 0", borderRadius: 4, fontWeight: 600, fontSize: 13, opacity: topupBusy ? 0.6 : 1 }}>{t("topup_submit")}</button>
              {topupMsg && <div style={{ color: "var(--success)", fontSize: 12, marginTop: 10 }}>{topupMsg}</div>}
            </form>

            {myTopups.length > 0 && (
              <div className="zb-card" style={{ padding: 18 }}>
                <h3 className="zb-h" style={{ fontSize: 14, marginBottom: 10 }}>{t("acc_my_topups")}</h3>
                {myTopups.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                    <span>{fmt(r.amount)} so'm</span>
                    <StatusBadge t={t} status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Support(props) {
  const { t, lang, changeLang, session, supportMsg, setSupportMsg, submitSupport, supportBusy, supportSent, mySupport, goStore, goAccount } = props;
  return (
    <div>
      <TopNav t={t} lang={lang} changeLang={changeLang} goStore={goStore} goAccount={goAccount} goSupport={() => {}} goAdmin={goStore} />
      <div style={{ padding: "30px 20px 60px", maxWidth: 560, margin: "0 auto" }}>
        <div className="zb-card" style={{ padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <LifeBuoy size={18} color="var(--accent)" />
            <h2 className="zb-h" style={{ fontSize: 18 }}>{t("support_title")}</h2>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>{t("support_desc")}</p>
          {!session ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("support_need_login")}</div>
          ) : (
            <form onSubmit={submitSupport}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("support_message")}</label>
              <textarea className="zb-input" required rows={4} value={supportMsg} onChange={(e) => setSupportMsg(e.target.value)} style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14, resize: "vertical" }} />
              <button type="submit" disabled={supportBusy} className="zb-btn" style={{ width: "100%", background: "var(--accent)", color: "#161810", padding: "11px 0", borderRadius: 4, fontWeight: 600, fontSize: 13, opacity: supportBusy ? 0.6 : 1 }}>{t("support_send")}</button>
              {supportSent && <div style={{ color: "var(--success)", fontSize: 12, marginTop: 10 }}>{t("support_sent")}</div>}
            </form>
          )}
        </div>
        {session && mySupport.length > 0 && (
          <div className="zb-card" style={{ padding: 18 }}>
            <h3 className="zb-h" style={{ fontSize: 14, marginBottom: 10 }}>{t("support_my_messages")}</h3>
            {mySupport.map((m) => (
              <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <div style={{ marginBottom: 4 }}>{m.message}</div>
                <span style={{ fontSize: 11, color: m.status === "answered" ? "var(--success)" : "var(--text-muted)" }}>{m.status === "answered" ? t("support_status_answered") : t("support_status_new")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Admin(props) {
  const { t, authed, passInput, setPassInput, passError, tryLogin, orders, packages, adminTab, setAdminTab, setOrderStatus, newPkg, setNewPkg, addPackage, updatePackage, removePackage, allTopups, approveTopup, rejectTopup, allSupport, markSupportAnswered, settingsDraft, setSettingsDraft, saveSettings, settingsSaved, logout, goStore } = props;

  if (!authed) {
    return (
      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <form className="zb-card" onSubmit={tryLogin} style={{ padding: 26, width: "100%", maxWidth: 320 }}>
          <div className="zb-h" style={{ fontSize: 18, marginBottom: 4 }}>{t("admin_login_title")}</div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 16 }}>{t("admin_login_desc")}</p>
          <input className="zb-input" type="password" autoFocus value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="Parol" style={{ width: "100%", padding: "10px 12px", marginBottom: 10, fontSize: 14 }} />
          {passError && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{t("admin_wrong_pass")}</div>}
          <button type="submit" className="zb-btn" style={{ width: "100%", background: "var(--accent)", color: "#161810", padding: "11px 0", borderRadius: 4, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t("admin_login_btn")}</button>
          <div className="zb-nav-link" style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }} onClick={goStore}>{t("admin_back")}</div>
        </form>
      </div>
    );
  }

  const tabs = ["orders", "packages", "topups", "support", "settings"];
  const tabLabels = { orders: "admin_tab_orders", packages: "admin_tab_packages", topups: "admin_tab_topups", support: "admin_tab_support", settings: "admin_tab_settings" };

  return (
    <div>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
        <div className="zb-h" style={{ fontSize: 18, fontWeight: 700 }}>ZARBA<span style={{ color: "var(--accent)" }}>.UC</span> · Admin</div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="zb-nav-link" style={{ fontSize: 13, color: "var(--text-muted)" }} onClick={goStore}>{t("admin_store")}</span>
          <span className="zb-nav-link" style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }} onClick={logout}><LogOut size={13} /> {t("acc_logout")}</span>
        </div>
      </header>

      <div style={{ display: "flex", gap: 6, padding: "14px 20px 0", maxWidth: 900, margin: "0 auto", flexWrap: "wrap" }}>
        {tabs.map((tb) => (
          <button key={tb} className="zb-btn" onClick={() => setAdminTab(tb)} style={{ background: adminTab === tb ? "var(--surface2)" : "transparent", border: "1px solid var(--line)", color: adminTab === tb ? "var(--accent)" : "var(--text-muted)", padding: "8px 14px", borderRadius: "4px 4px 0 0", fontSize: 12 }}>
            {t(tabLabels[tb])}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 20px 40px", maxWidth: 900, margin: "0 auto" }}>
        {adminTab === "orders" && (
          <div className="zb-card" style={{ padding: 6, marginTop: -1, borderTopLeftRadius: 0 }}>
            {orders.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{t("admin_no_orders")}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="zb-table">
                  <thead><tr><th>ID</th><th>PUBG ID</th><th>UC</th><th>Narx</th><th>Telefon</th><th>To'lov</th><th>Holat</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td><td>{o.pubgId}</td><td>{fmt(o.uc)}</td><td>{fmt(o.price)}</td><td>{o.phone}</td>
                        <td style={{ textTransform: "uppercase" }}>{o.payment}</td>
                        <td>
                          <select className="zb-status" value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)}>
                            <option value="pending">{t("status_pending")}</option>
                            <option value="paid">{t("status_paid")}</option>
                            <option value="delivered">{t("status_delivered")}</option>
                            <option value="cancelled">{t("status_cancelled")}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {adminTab === "packages" && (
          <div className="zb-card" style={{ padding: 18, marginTop: -1, borderTopLeftRadius: 0 }}>
            <div style={{ display: "grid", gap: 10 }}>
              {packages.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10, flexWrap: "wrap" }}>
                  <input className="zb-input" type="number" value={p.uc} onChange={(e) => updatePackage(p.id, { uc: parseInt(e.target.value, 10) || 0 })} style={{ width: 90, padding: "6px 8px", fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>UC</span>
                  <input className="zb-input" type="number" value={p.price} onChange={(e) => updatePackage(p.id, { price: parseInt(e.target.value, 10) || 0 })} style={{ width: 120, padding: "6px 8px", fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>so'm</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}><input type="checkbox" checked={p.popular} onChange={(e) => updatePackage(p.id, { popular: e.target.checked })} /> mashhur</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}><input type="checkbox" checked={p.active} onChange={(e) => updatePackage(p.id, { active: e.target.checked })} /> faol</label>
                  <button className="zb-btn" onClick={() => removePackage(p.id)} style={{ marginLeft: "auto", background: "transparent", color: "var(--danger)", padding: 6 }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <form onSubmit={addPackage} style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
              <input className="zb-input" type="number" placeholder="UC miqdori" value={newPkg.uc} onChange={(e) => setNewPkg({ ...newPkg, uc: e.target.value })} style={{ width: 110, padding: "8px 10px", fontSize: 13 }} />
              <input className="zb-input" type="number" placeholder="Narxi (so'm)" value={newPkg.price} onChange={(e) => setNewPkg({ ...newPkg, price: e.target.value })} style={{ width: 140, padding: "8px 10px", fontSize: 13 }} />
              <button type="submit" className="zb-btn" style={{ background: "var(--accent)", color: "#161810", padding: "8px 14px", borderRadius: 4, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}><Plus size={14} /> Qo'shish</button>
            </form>
          </div>
        )}

        {adminTab === "topups" && (
          <div className="zb-card" style={{ padding: 6, marginTop: -1, borderTopLeftRadius: 0 }}>
            {allTopups.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{t("admin_no_topups")}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="zb-table">
                  <thead><tr><th>Vaqt</th><th>Telefon</th><th>Summa</th><th>{t("admin_receipt")}</th><th>Holat</th><th></th></tr></thead>
                  <tbody>
                    {allTopups.map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.created_at).toLocaleString("uz-UZ")}</td>
                        <td>{r.phone}</td>
                        <td>{fmt(r.amount)} so'm</td>
                        <td>{r.receipt_url ? <a href={r.receipt_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{t("admin_receipt")}</a> : "—"}</td>
                        <td><StatusBadge t={t} status={r.status} /></td>
                        <td>
                          {r.status === "pending" && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="zb-btn" onClick={() => approveTopup(r)} style={{ background: "var(--success)", color: "#0c1408", padding: "4px 8px", borderRadius: 3, fontSize: 11 }}>{t("admin_approve")}</button>
                              <button className="zb-btn" onClick={() => rejectTopup(r.id)} style={{ background: "var(--danger)", color: "#fff", padding: "4px 8px", borderRadius: 3, fontSize: 11 }}>{t("admin_reject")}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {adminTab === "support" && (
          <div className="zb-card" style={{ padding: 6, marginTop: -1, borderTopLeftRadius: 0 }}>
            {allSupport.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{t("admin_no_support")}</div>
            ) : (
              <div style={{ padding: 10 }}>
                {allSupport.map((m) => (
                  <div key={m.id} className="zb-card" style={{ padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                      <span>{m.phone}</span><span>{new Date(m.created_at).toLocaleString("uz-UZ")}</span>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>{m.message}</div>
                    {m.status !== "answered" ? (
                      <button className="zb-btn" onClick={() => markSupportAnswered(m.id)} style={{ background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--accent)", padding: "5px 10px", borderRadius: 3, fontSize: 11 }}>{t("admin_mark_answered")}</button>
                    ) : (
                      <StatusBadge t={t} status="approved" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {adminTab === "settings" && (
          <form className="zb-card" onSubmit={saveSettings} style={{ padding: 22, marginTop: -1, borderTopLeftRadius: 0, maxWidth: 400 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("admin_card_number")}</label>
            <input className="zb-input" value={settingsDraft.card_number || ""} onChange={(e) => setSettingsDraft({ ...settingsDraft, card_number: e.target.value })} placeholder="8600 1234 5678 9012" style={{ width: "100%", padding: "10px 12px", marginBottom: 14, fontSize: 14 }} />
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{t("admin_card_owner")}</label>
            <input className="zb-input" value={settingsDraft.card_owner || ""} onChange={(e) => setSettingsDraft({ ...settingsDraft, card_owner: e.target.value })} placeholder="ALISHER B." style={{ width: "100%", padding: "10px 12px", marginBottom: 16, fontSize: 14 }} />
            <button type="submit" className="zb-btn" style={{ background: "var(--accent)", color: "#161810", padding: "10px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600 }}>{t("admin_save")}</button>
            {settingsSaved && <span style={{ marginLeft: 12, color: "var(--success)", fontSize: 12 }}>{t("admin_saved")}</span>}
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  app: {
    "--bg": "#12140F",
    "--surface": "#1C2016",
    "--surface2": "#232819",
    "--line": "#31351F",
    "--accent": "#E8A33D",
    "--accent-dim": "#B97E22",
    "--olive": "#6B7A4F",
    "--text": "#F1EDE1",
    "--text-muted": "#9BA187",
    "--danger": "#C0533B",
    "--success": "#7A9B5C",
    background: "var(--bg)",
    minHeight: "100vh",
  },
};
