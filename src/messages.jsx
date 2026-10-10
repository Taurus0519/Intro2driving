import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth';
import './Messages.css';

const ATTACHMENT_BUCKET = 'message-attachments';
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function MessageComposer({ onSend, sending, submitLabel, recipientSelect }) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!body.trim() && files.length === 0) return;
    const form = event.currentTarget;
    const sent = await onSend(body.trim(), files);
    if (sent) {
      setBody('');
      setFiles([]);
      setFileError('');
      form.reset();
    }
  }

  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > MAX_ATTACHMENTS) {
      event.target.value = '';
      setFiles([]);
      setFileError(`Choose no more than ${MAX_ATTACHMENTS} attachments.`);
      return;
    }
    setFileError('');
    setFiles(selected);
  }

  const hasOversizedFile = files.some((file) => file.size > MAX_FILE_SIZE);

  return (
    <form className="message-composer" onSubmit={submit}>
      {recipientSelect}
      <label>
        Message
        <textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a message"
        />
      </label>
      <label>
        Attach images, videos, or files (up to 5 files, 50 MB each)
        <input
          type="file"
          multiple
          onChange={selectFiles}
          aria-describedby="attachment-help"
        />
      </label>
      <p id="attachment-help" className="attachment-help">
        {files.length > 0
          ? files.map((file) => file.name).join(', ')
          : 'You can send a message with attachments only.'}
      </p>
      {fileError && <p className="error">{fileError}</p>}
      {hasOversizedFile && (
        <p className="error">Each attachment must be 50 MB or smaller.</p>
      )}
      <button
        type="submit"
        className="button primary"
        disabled={sending || files.length > MAX_ATTACHMENTS || hasOversizedFile || (!body.trim() && files.length === 0)}
      >
        {sending ? 'Sending...' : submitLabel}
      </button>
    </form>
  );
}

function Attachment({ attachment }) {
  if (attachment.content_type?.startsWith('image/')) {
    return (
      <a className="message-attachment" href={attachment.url} target="_blank" rel="noreferrer">
        <img src={attachment.url} alt={attachment.file_name} loading="lazy" />
        <span>{attachment.file_name}</span>
      </a>
    );
  }

  if (attachment.content_type?.startsWith('video/')) {
    return (
      <div className="message-attachment message-video">
        <video controls preload="metadata" src={attachment.url}>
          Your browser does not support video playback.
        </video>
        <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.file_name}</a>
      </div>
    );
  }

  return (
    <a className="message-file" href={attachment.url} target="_blank" rel="noreferrer">
      <span aria-hidden="true">📎</span>
      <span>{attachment.file_name}</span>
    </a>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) void load();
  }, [user?.id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: messageRows, error: messagesError } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(name), recipient:profiles!messages_recipient_id_fkey(name), parent:messages!messages_parent_message_id_fkey(body,sender_id,recipient_id)')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('sent_at', { ascending: false });

      if (messagesError) {
        setError(`Messages could not be loaded: ${messagesError.message}`);
        setMessages([]);
        return;
      }

      const rows = messageRows || [];
      let attachmentRows = [];
      if (rows.length > 0) {
        const { data, error: attachmentsError } = await supabase
          .from('message_attachments')
          .select('id,message_id,file_name,content_type,storage_path')
          .in('message_id', rows.map((message) => message.id));
        if (attachmentsError) {
          setError(`Message attachments could not be loaded: ${attachmentsError.message}`);
        } else {
          attachmentRows = data || [];
        }
      }

      const attachmentsByMessage = new Map();
      for (const attachment of attachmentRows) {
        const { data, error: urlError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrl(attachment.storage_path, 3600);
        if (urlError) {
          setError(`An attachment could not be opened: ${urlError.message}`);
          continue;
        }
        const existing = attachmentsByMessage.get(attachment.message_id) || [];
        existing.push({ ...attachment, url: data.signedUrl });
        attachmentsByMessage.set(attachment.message_id, existing);
      }

      setMessages(rows.map((message) => ({
        ...message,
        attachments: attachmentsByMessage.get(message.id) || [],
      })));

      const { data: recipientRows, error: recipientsError } = await supabase
        .from('profiles')
        .select('id, name')
        .neq('id', user.id)
        .order('name');
      if (recipientsError) {
        setError((current) => current || `Recipients could not be loaded: ${recipientsError.message}`);
      } else {
        setRecipients(recipientRows || []);
      }
    } catch (loadError) {
      setError(`Messages could not be loaded: ${loadError instanceof Error ? loadError.message : 'Please try again.'}`);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function deliverMessage({ recipient, body, files, parentMessageId = null }) {
    setSending(true);
    setError('');
    try {
      const { data: message, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipient,
          body,
          parent_message_id: parentMessageId,
        })
        .select('id')
        .single();

      if (insertError) {
        setError(`Message could not be sent: ${insertError.message}`);
        return false;
      }

      if (files.length > 0) {
        const uploadedPaths = [];
        let attachmentError = '';
        for (const file of files) {
          const safeName = file.name.replace(/[\\/]/g, '_');
          const storagePath = `${user.id}/${message.id}/${crypto.randomUUID()}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
          if (uploadError) {
            attachmentError = uploadError.message;
            break;
          }
          uploadedPaths.push(storagePath);
        }

        if (!attachmentError) {
          const attachmentRecords = files.map((file, index) => ({
            message_id: message.id,
            uploaded_by: user.id,
            storage_path: uploadedPaths[index],
            file_name: file.name,
            content_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
          }));
          const { error: metadataError } = await supabase.from('message_attachments').insert(attachmentRecords);
          if (metadataError) attachmentError = metadataError.message;
        }

        if (attachmentError) {
          const failureMessage = `The message was sent, but its attachments could not be saved: ${attachmentError}.`;
          const { error: cleanupError } = uploadedPaths.length
            ? await supabase.storage.from(ATTACHMENT_BUCKET).remove(uploadedPaths)
            : { error: null };
          const cleanupNote = cleanupError ? ` Uploaded files may need cleanup: ${cleanupError.message}` : '';
          await load();
          setError(`${failureMessage}${cleanupNote}`);
          return true;
        }
      }

      await load();
      return true;
    } catch (sendError) {
      setError(`Message could not be sent: ${sendError instanceof Error ? sendError.message : 'Please try again.'}`);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function sendNewMessage(body, files) {
    if (!recipientId) {
      setError('Choose a recipient before sending.');
      return false;
    }
    const sent = await deliverMessage({ recipient: recipientId, body, files });
    if (sent) {
      setRecipientId('');
      setShowForm(false);
    }
    return sent;
  }

  async function sendReply(message, body, files) {
    const recipient = message.sender_id === user.id ? message.recipient_id : message.sender_id;
    const sent = await deliverMessage({
      recipient,
      body,
      files,
      parentMessageId: message.id,
    });
    if (sent) setReplyToId(null);
    return sent;
  }

  return (
    <section className="messages-page">
      <div className="toolbar">
        <div><h3>Messages</h3><p>Your conversations.</p></div>
        <button
          type="button"
          className="button primary small-button"
          onClick={() => { setShowForm((visible) => !visible); setError(''); }}
        >
          {showForm ? 'Cancel' : '+ New message'}
        </button>
      </div>

      {error && <p className="error message-error" role="alert">{error}</p>}

      {showForm && (
        <div className="panel new-message-panel">
          <MessageComposer
            onSend={sendNewMessage}
            sending={sending}
            submitLabel="Send message"
            recipientSelect={(
              <label>
                Recipient
                <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required>
                  <option value="">Select recipient</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                  ))}
                </select>
              </label>
            )}
          />
        </div>
      )}

      <div className="panel message-list">
        {loading && <p className="empty">Loading messages...</p>}
        {!loading && messages.length === 0 && <p className="empty">No messages yet.</p>}
        {messages.map((message) => {
          const isOwn = message.sender_id === user.id;
          return (
            <article key={message.id} className={`message-row ${isOwn ? 'message-own' : ''}`}>
              <div className="message-heading">
                <strong>{isOwn ? `To ${message.recipient?.name}` : `From ${message.sender?.name}`}</strong>
                {message.sent_at && (
                  <time dateTime={message.sent_at}>{new Date(message.sent_at).toLocaleString()}</time>
                )}
              </div>
              {message.parent && (
                <p className="message-reply-context">
                  Replying to {message.parent.sender_id === user.id ? 'your' : 'their'} message: {message.parent.body}
                </p>
              )}
              {message.body && <p className="message-body">{message.body}</p>}
              {message.attachments.length > 0 && (
                <div className="message-attachments">
                  {message.attachments.map((attachment) => (
                    <Attachment key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}
              <button
                type="button"
                className="text-button message-reply-button"
                onClick={() => { setReplyToId(replyToId === message.id ? null : message.id); setError(''); }}
              >
                {replyToId === message.id ? 'Cancel reply' : 'Reply'}
              </button>
              {replyToId === message.id && (
                <MessageComposer
                  onSend={(body, files) => sendReply(message, body, files)}
                  sending={sending}
                  submitLabel="Send reply"
                />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
