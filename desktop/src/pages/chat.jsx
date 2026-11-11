import React, { useEffect, useRef, useState } from 'react';
import { createAuthenticatedSocket } from '../../../shared/auth.js';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('gat');
    if (!token) {
      setConnectionError('Pair this device before opening chat.');
      return undefined;
    }

    const socket = createAuthenticatedSocket({
      transports: ['websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError('');
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (error) => {
      setIsConnected(false);
      setConnectionError(`Connection failed: ${error.message}`);
    });
    socket.on('receive_message', (message) => {
      setMessages((current) => [...current, message]);
    });
    socket.on('stream_error', ({ message }) => setConnectionError(message));

    socket.connect();

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (event) => {
    event.preventDefault();
    const text = inputMessage.trim();
    if (!text || !socketRef.current?.connected) return;

    socketRef.current.emit('send_message', { text });
    setMessages((current) => [
      ...current,
      {
        text,
        sender: 'Me',
        timestamp: new Date().toISOString(),
        isSelf: true
      }
    ]);
    setInputMessage('');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h3 style={{ margin: 0 }}>VEDA device chat</h3>
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </header>
      {connectionError && <p role="alert" style={styles.error}>{connectionError}</p>}
      <div style={styles.messages}>
        {messages.map((message, index) => (
          <div
            key={`${message.timestamp}-${index}`}
            style={{
              ...styles.bubble,
              alignSelf: message.isSelf ? 'flex-end' : 'flex-start',
              background: message.isSelf ? '#4f46e5' : '#fff',
              color: message.isSelf ? '#fff' : '#1e293b'
            }}
          >
            {!message.isSelf && <small>{message.sender}</small>}
            <p style={{ margin: '4px 0' }}>{message.text}</p>
            <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} style={styles.form}>
        <input
          value={inputMessage}
          onChange={(event) => setInputMessage(event.target.value)}
          placeholder="Type a message..."
          maxLength={4000}
          style={styles.input}
        />
        <button type="submit" disabled={!isConnected || !inputMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 550,
    maxWidth: 420,
    margin: '20px auto',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#e2e8f0',
    fontFamily: 'Inter, sans-serif'
  },
  header: {
    padding: 16,
    background: '#0f172a',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between'
  },
  error: { margin: 0, padding: 8, color: '#b91c1c', background: '#fee2e2' },
  messages: {
    flex: 1,
    padding: 16,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  bubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    overflowWrap: 'anywhere'
  },
  form: {
    display: 'flex',
    padding: 12,
    gap: 8,
    background: '#fff',
    borderTop: '1px solid #cbd5e1'
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '10px 14px',
    borderRadius: 24,
    border: '1px solid #cbd5e1'
  }
};
