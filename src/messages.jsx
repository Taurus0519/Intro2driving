import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth';

export default function Messages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [form, setForm] = useState({ recipient_id: '', body: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(name), recipient:profiles!messages_recipient_id_fkey(name)')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('sent_at', { ascending: false });
    setMessages(data || []);

    const { data: r } = await supabase.from('profiles').select('id, name').neq('id', user.id);
    setRecipients(r || []);
  }

  async function send(e) {
    e.preventDefault();
    await supabase.from('messages').insert({ sender_id: user.id, ...form });
    setForm({ recipient_id: '', body: '' });
    setShowForm(false);
    await load();
  }

  return (
    <>
      <div className="toolbar">
        <div><h3>Messages</h3><p>Your conversations.</p></div>
        <button type="button" className="button primary small-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New message'}
        </button>
      </div>

      {showForm && (
        <form className="panel" onSubmit={send} style={{ marginBottom: 20 }}>
          <label>
            Recipient
            <select value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })} required>
              <option value="">Select recipient</option>
              {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label>
            Message
            <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          </label>
          <button type="submit" className="button primary">Send</button>
        </form>
      )}

      <div className="panel">
        {messages.length === 0 && <p className="empty">No messages yet.</p>}
        {messages.map((m) => (
          <article key={m.id} className="message-row">
            <strong>{m.sender_id === user.id ? `To ${m.recipient?.name}` : `From ${m.sender?.name}`}</strong>
            <p>{m.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}