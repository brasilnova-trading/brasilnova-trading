import React, { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "./firebase";
import { ShieldCheck, Users, Wallet, Clock3, RefreshCw, Search, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import "./admin.css";

const API = "https://brasilnova-trading.onrender.com";
const money = value => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 2
}).format(Number(value || 0));
const date = value => value ? new Date(value).toLocaleString("pt-BR") : "—";

export default function AdminPanel() {
  const [data, setData] = useState(null);
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const current = auth.currentUser;
    if (!current) throw new Error("Please sign in again.");
    const token = await current.getIdToken();
    const response = await fetch(API + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
    return body;
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/admin/overview");
      setData(result);
    } catch (e) {
      setError(e.message || "Unable to load admin data.");
    } finally {
      setBusy(false);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const users = useMemo(() => (data?.users || []).filter(u =>
    `${u.fullName} ${u.email} ${u.uid}`.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  const requests = useMemo(() => (data?.requests || []).filter(r =>
    `${r.userEmail} ${r.reference} ${r.type} ${r.status}`.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  async function review(item, status) {
    const action = status === "verified" ? "mark this request as verified" : "reject this request";
    if (!window.confirm(`Are you sure you want to ${action}?\n\nThis does not transfer money or change the user's balance.`)) return;
    const note = window.prompt("Admin note (optional):", "") ?? null;
    if (note === null) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await request(`/api/admin/requests/${item.type}/${item.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, note })
      });
      setNotice(result.message);
      await load();
    } catch (e) {
      setError(e.message || "Could not review request.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-page">
    <div className="admin-heading">
      <div>
        <div className="eyebrow"><ShieldCheck size={14}/> ADMIN CONTROL CENTER</div>
        <h1>Administration</h1>
        <p>Manage account visibility and review requests securely.</p>
      </div>
      <button className="btn light" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button>
    </div>

    {error && <div className="admin-alert error"><AlertTriangle size={17}/><span>{error}</span></div>}
    {notice && <div className="admin-alert"><CheckCircle2 size={17}/><span>{notice}</span></div>}

    <div className="admin-stats">
      <div className="admin-stat"><span><Users size={18}/></span><small>Accounts loaded</small><strong>{data?.totalUsers ?? "—"}</strong><em>Maximum 500 fetched</em></div>
      <div className="admin-stat"><span><Wallet size={18}/></span><small>Recorded user balances</small><strong>{data ? money(data.recordedBalances) : "—"}</strong><em>Not a bank balance</em></div>
      <div className="admin-stat"><span><Clock3 size={18}/></span><small>Pending deposits</small><strong>{data?.pendingDeposits ?? "—"}</strong><em>Awaiting manual checks</em></div>
      <div className="admin-stat"><span><Clock3 size={18}/></span><small>Pending withdrawals</small><strong>{data?.pendingWithdrawals ?? "—"}</strong><em>Awaiting manual checks</em></div>
    </div>

    <div className="admin-tabs">
      {[["overview","Overview"],["users","Users"],["requests","Financial requests"]].map(([id,label]) =>
        <button key={id} className={section === id ? "active" : ""} onClick={() => { setSection(id); setSearch(""); }}>{label}</button>
      )}
    </div>

    <div className="admin-panel-card">
      <div className="admin-panel-title">
        <div><h2>{section === "users" ? "User accounts" : section === "requests" ? "Deposit & withdrawal requests" : "Recent activity"}</h2>
        <p>{section === "users" ? "Search registered accounts. Balances are view-only." : "Review request records. Reviews do not transfer or release funds."}</p></div>
        <label className="admin-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={section === "users" ? "Search users..." : "Search requests..."}/></label>
      </div>

      {section === "users" ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>User</th><th>Balance</th><th>Status</th><th>Joined</th></tr></thead>
        <tbody>{users.map(u => <tr key={u.uid}><td><strong>{u.fullName || "Unnamed user"}</strong><small>{u.email || u.uid}</small></td><td>{money(u.balance)}</td><td><span className={`admin-status ${u.status === "active" ? "good" : "neutral"}`}>{u.status}</span></td><td>{date(u.createdAt)}</td></tr>)}</tbody>
      </table>{users.length === 0 && <div className="admin-empty">No matching users.</div>}</div>
      : section === "requests" ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Request</th><th>Amount</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
        <tbody>{requests.map(r => <tr key={`${r.type}-${r.id}`}><td><strong>{r.type === "deposit" ? "Deposit" : "Withdrawal"}</strong><small>{r.userEmail || r.userId}<br/>Ref: {r.reference || "—"}</small></td><td>{money(r.amount)}</td><td><span className={`admin-status ${r.status === "pending" ? "wait" : r.status === "verified" ? "good" : "neutral"}`}>{r.status}</span></td><td>{date(r.createdAt)}</td><td>{r.status === "pending" ? <div className="admin-actions"><button disabled={busy} onClick={() => review(r,"verified")} title="Record verification"><CheckCircle2 size={15}/> Verify</button><button className="reject" disabled={busy} onClick={() => review(r,"rejected")} title="Reject request"><XCircle size={15}/> Reject</button></div> : "Reviewed"}</td></tr>)}</tbody>
      </table>{requests.length === 0 && <div className="admin-empty">No matching requests.</div>}</div>
      : <div className="admin-overview-list">
        <div><span className="admin-overview-icon"><Users size={18}/></span><section><strong>Account directory</strong><p>Search accounts and view recorded balances.</p></section><button className="btn light" onClick={() => setSection("users")}>Open users</button></div>
        <div><span className="admin-overview-icon"><Wallet size={18}/></span><section><strong>Financial requests</strong><p>Review pending deposits and withdrawals. No automatic payments occur here.</p></section><button className="btn light" onClick={() => setSection("requests")}>Review requests</button></div>
        <div className="admin-safety-note"><ShieldCheck size={18}/><span>Admin actions are checked by the backend. User balances are not editable from this dashboard, and request review does not credit wallets or initiate bank transfers.</span></div>
      </div>}
    </div>
    <p className="admin-footnote">For large installations, this dashboard should use paginated queries and additional audit monitoring.</p>
  </div>;
}
