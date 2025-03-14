/**
 * WebSocket service for real-time communication with the backend
 */
import { v4 as uuidv4 } from 'uuid';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.messageHandlers = [];
    this.clientId = localStorage.getItem('clientId') || uuidv4();
    
    // Save clientId to localStorage for persistence
    localStorage.setItem('clientId', this.clientId);
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise} - Resolves when connected, rejects on error
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        resolve(this.socket);
        return;
      }

      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.REACT_APP_WS_HOST || window.location.host;
      const wsUrl = `${protocol}//${host}`;

      console.log(`Connecting to WebSocket at ${wsUrl}`);
      this.socket = new WebSocket(wsUrl);

      // Connection opened
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(this.socket);
      };

      // Connection error
      this.socket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
        reject(error);
      };

      // Connection closed
      this.socket.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        this.isConnected = false;
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          this.attemptReconnect();
        }
      };

      // Listen for messages
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Notify all registered handlers
          this.messageHandlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    });
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect()
        .catch(() => {
          // Connection failed, will try again automatically
        });
    }, delay);
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
      this.isConnected = false;
      clearTimeout(this.reconnectTimeout);
    }
  }

  /**
   * Send a message to the WebSocket server
   * @param {Object} data - Data to send
   * @returns {boolean} - Success status
   */
  send(data) {
    if (!this.socket || !this.isConnected) {
      console.error('Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  /**
   * Register a handler for incoming messages
   * @param {Function} handler - Message handler function
   * @returns {Function} - Function to unregister the handler
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
    
    // Return function to remove this handler
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Get the client ID
   * @returns {string} - Client ID
   */
  getClientId() {
    return this.clientId;
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;