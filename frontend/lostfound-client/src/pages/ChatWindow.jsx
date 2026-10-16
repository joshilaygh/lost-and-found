// src/pages/ChatWindow.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchConversationHistory, sendMessage, markMessageRead, deleteConversation, fetchUser } from '../services/messageApi';
import signalR from '../services/signalr';
import { apiUrl } from '../services/apiUrl';

export default function ChatWindow() {
  const { otherUserId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [sessionUser, setSessionUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lf_user') || 'null');
    } catch {
      return null;
    }
  });
  const scrollRef = useRef();
  const currentUserId = Number(sessionUser?.id ?? currentUser?.id);
  const otherUserIdNumber = Number(otherUserId);

  useEffect(() => {
    function syncSessionUser() {
      try {
        setSessionUser(JSON.parse(localStorage.getItem('lf_user') || 'null'));
      } catch {
        setSessionUser(null);
      }
    }

    window.addEventListener('lf:authChanged', syncSessionUser);
    window.addEventListener('storage', syncSessionUser);
    return () => {
      window.removeEventListener('lf:authChanged', syncSessionUser);
      window.removeEventListener('storage', syncSessionUser);
    };
  }, []);

  function normalizeMessage(message) {
    return {
      ...message,
      id: message.id ?? message.Id,
      senderId: message.senderId ?? message.SenderId,
      receiverId: message.receiverId ?? message.ReceiverId,
      content: message.content ?? message.Content ?? '',
      createdAt: message.createdAt ?? message.CreatedAt,
      isRead: message.isRead ?? message.IsRead,
    };
  }

  function messageBelongsToConversation(message) {
    const normalized = normalizeMessage(message);
    const senderId = Number(normalized.senderId);
    const receiverId = Number(normalized.receiverId);
    return (
      (senderId === otherUserIdNumber && receiverId === currentUserId) ||
      (senderId === currentUserId && receiverId === otherUserIdNumber)
    );
  }

  function addMessage(message) {
    if (!message) return;
    const normalizedMessage = normalizeMessage(message);
    setMessages(previous => {
      const messageId = normalizedMessage.id;
      const existingIndex = previous.findIndex(item => {
        const itemId = normalizeMessage(item).id;
        return messageId != null && itemId != null && String(itemId) === String(messageId);
      });

      if (existingIndex >= 0) {
        const updated = [...previous];
        updated[existingIndex] = { ...updated[existingIndex], ...normalizedMessage, id: messageId };
        return updated;
      }

      const pendingIndex = previous.findIndex(item =>
        item.pending &&
        Number(normalizeMessage(item).senderId) === currentUserId &&
        Number(normalizeMessage(item).receiverId) === otherUserIdNumber &&
        normalizeMessage(item).content === normalizedMessage.content
      );
      if (pendingIndex >= 0) {
        const updated = [...previous];
        updated[pendingIndex] = { ...normalizedMessage, pending: false, id: messageId };
        return updated;
      }

      return [...previous, normalizedMessage];
    });
  }

  useEffect(() => {
    let mounted = true;
    setMessages([]);

    async function init() {
      // ensure SignalR connection started; App.jsx or AuthContext may already start it
      try {
        await signalR.start(localStorage.getItem('app_jwt'));
      } catch (err) {
        console.warn('SignalR start error:', err);
      }

      // load history
      try {
        const history = await fetchConversationHistory(otherUserId);
        if (mounted) setMessages((history || []).map(normalizeMessage));
        // load other user info for header
        try {
          const u = await fetchUser(otherUserId);
          if (mounted) setOtherUser(u);
        } catch (e) {
          // ignore; user may have been deleted
          console.warn('Failed to load other user', e);
        }
        // mark unread messages as read (optional)
        history
          .map(normalizeMessage)
          .filter(m => !m.isRead && Number(m.receiverId) === currentUserId)
          .forEach(m => markMessageRead(m.id).catch(() => {}));
      } catch (err) {
        console.error('Failed to load history', err);
      }
    }

    init();

  const unsubReceive = signalR.on('ReceiveMessage', (msg) => {
      // add only messages that belong to this conversation
      if (messageBelongsToConversation(msg)) addMessage(msg);
    });

  const unsubSent = signalR.on('MessageSent', (msg) => {
      // server-side ack for messages sent by this client
      if (messageBelongsToConversation(msg)) {
        addMessage(msg);
      }
    });

    return () => {
      mounted = false;
      unsubReceive();
      unsubSent();
    };
  }, [otherUserId, currentUserId]);

  useEffect(() => {
    // If other party deleted conversation, clear messages and update UI
    const unsubConv = signalR.on('ConversationDeleted', (payload) => {
      const otherIdNum = Number(otherUserId);
      if (payload?.OtherUserId && Number(payload.OtherUserId) === otherIdNum) {
        setMessages([]);
      }
    });
    return () => unsubConv && unsubConv();
  }, [otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function handleSend() {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    const pendingMessage = {
      id: `pending-${Date.now()}`,
      senderId: currentUserId,
      receiverId: otherUserIdNumber,
      content,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    addMessage(pendingMessage);
    try {
      // Persist via API; server will notify via SignalR
      const savedMessage = await sendMessage(otherUserIdNumber, content);
      addMessage(savedMessage);
    } catch (err) {
      console.error('Send failed, trying hub fallback', err);
      try {
        const sentMessage = await signalR.sendViaHub(otherUserIdNumber, content);
        if (sentMessage) addMessage(sentMessage);
      } catch (err2) {
        console.error('Hub fallback failed', err2);
        setMessages(previous => previous.filter(message => message.id !== pendingMessage.id));
      }
    }
  }

  return (
    <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '760px', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 900, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #eef2f7', background: '#f7fbff' }}>
          <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>◀</button>
          <img
            src={otherUser?.avatarUrl
              ? apiUrl(otherUser.avatarUrl)
              : (otherUser?.id ? apiUrl(`/api/users/${otherUser.id}/avatar`) : null)}
            alt="avatar"
            style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#f0f3f7' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}><Link to={`/users/${otherUser?.id}`}>{otherUser?.firstName || otherUser?.name || otherUser?.username || 'Conversation'}</Link></div>
            <div style={{ fontSize: 12, color: '#667085' }}>{/* optional status or subtitle */}</div>
          </div>
        </div>

        {/* Messages pane */}
        <div style={{ flex: 1, minHeight: 260, maxHeight: 520, overflow: 'auto', padding: 16, background: '#f6f8fb' }}>
        {messages.map(m => (
          <div key={m.id ?? `${m.createdAt}-${m.senderId}`} style={{ display: 'flex', flexDirection: 'column', alignItems: Number(m.senderId) === currentUserId ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
            <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: 14, background: Number(m.senderId) === currentUserId ? '#d6f0ff' : '#ffffff', boxShadow: Number(m.senderId) === currentUserId ? 'none' : '0 1px 2px rgba(16,24,40,0.04)', color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: m.pending ? 0.7 : 1 }}>
              {m.content}
            </div>
            <div style={{ fontSize: 11, color: '#8b9aa6', marginTop: 6 }}>{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
        <div ref={scrollRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: 12, borderTop: '1px solid #eef2f7', display: 'flex', gap: 8, alignItems: 'center', background: '#fff' }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={`Message ${otherUser?.firstName || otherUser?.name || 'user'}...`} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e6eef3', outline: 'none', fontSize: 14 }} />
          <button onClick={handleSend} style={{ padding: '8px 12px', borderRadius: 8, background: '#0b76ef', color: '#fff', border: 'none', cursor: 'pointer' }}>Send</button>
          <button className="btn ghost" onClick={async () => {
            if (!window.confirm('Delete this conversation for you? This will remove messages from your view.')) return;
            try {
              await deleteConversation(Number(otherUserId));
              setMessages([]);
              // optionally navigate away
              navigate('/dashboard');
            } catch (err) {
              console.error('Failed to delete conversation', err);
              window.alert('Failed to delete conversation: ' + (err.message || err));
            }
          }} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e6eef3', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}