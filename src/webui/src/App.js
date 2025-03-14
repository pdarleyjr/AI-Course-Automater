import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import TerminalUI from './components/TerminalUI';
import LoginForm from './components/LoginForm';
import LogOutput from './components/LogOutput';
import { startAutomation, stopAutomation } from './services/api';
import websocketService from './services/websocket';
import './App.css';

const AppContainer = styled.div`
  background-color: #0c0c0c;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  padding: 10px;
`;

const AppHeader = styled.header`
  width: 100%;
  max-width: 900px;
  text-align: center;
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Title = styled.h1`
  color: #00ff00;
  font-family: 'Courier New', monospace;
  margin-bottom: 10px;
`;

const Subtitle = styled.p`
  color: #00cc00;
  font-size: 16px;
`;

const MainContent = styled.main`
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const TerminalSection = styled.section`
  width: 100%;
  margin-bottom: 10px;
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;
  font-size: 14px;
`;

const StatusIndicator = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: ${props => props.connected ? '#55ff55' : '#ff5555'};
`;

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [terminalLines, setTerminalLines] = useState([
    { text: 'Welcome to AI Course Automater', color: '#00ff00' },
    { text: 'Please enter your credentials to begin.', color: '#00ff00' },
  ]);

  // Connect to WebSocket on component mount
  useEffect(() => {
    // Connect to WebSocket server
    websocketService.connect()
      .then(() => {
        setIsConnected(true);
        addLog('Connected to server', 'info');
        addTerminalLine('Connected to server', '#55ff55');
      })
      .catch(error => {
        console.error('WebSocket connection error:', error);
        addLog('Failed to connect to server. Please try again.', 'error');
        addTerminalLine('Failed to connect to server. Please try again.', '#ff5555');
      });
    
    // Register message handler
    const unsubscribe = websocketService.onMessage(handleWebSocketMessage);
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      websocketService.disconnect();
    };
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    addLog(data.message, data.type);
    
    // Add to terminal with appropriate color
    let color = '#00ff00';
    if (data.type === 'error') color = '#ff5555';
    if (data.type === 'warning') color = '#ffff55';
    if (data.type === 'success') color = '#55ff55';
    
    addTerminalLine(data.message, color);
  };

  // Add a log message
  const addLog = (message, type = '') => {
    setLogs(prevLogs => [
      ...prevLogs,
      {
        message,
        type,
        timestamp: new Date()
      }
    ]);
  };

  // Add a terminal line
  const addTerminalLine = (text, color = '#00ff00') => {
    setTerminalLines(prevLines => [
      ...prevLines,
      { text, color }
    ]);
  };

  // Handle form submission
  const handleSubmit = async (credentials) => {
    try {
      if (!isConnected) {
        // Try to reconnect if not connected
        try {
          await websocketService.connect();
          setIsConnected(true);
          addLog('Connected to server', 'info');
          addTerminalLine('Connected to server', '#55ff55');
        } catch (error) {
          addLog('Failed to connect to server. Please try again.', 'error');
          addTerminalLine('Failed to connect to server. Please try again.', '#ff5555');
          return;
        }
      }
      
      setIsLoading(true);
      addLog('Authenticating with TargetSolutions...', 'info');
      addTerminalLine('Authenticating with TargetSolutions...');
      
      // Call API to start automation
      const response = await startAutomation(credentials);
      setSessionId(response.sessionId);
      
      addLog(`Authentication successful! Session ID: ${response.sessionId}`, 'success');
      addTerminalLine(`Authentication successful! Session ID: ${response.sessionId}`, '#55ff55');
      
      setIsAuthenticated(true);
    } catch (error) {
      setIsLoading(false);
      addLog(`Authentication failed: ${error.response?.data?.message || error.message}`, 'error');
      addTerminalLine(`Authentication failed: ${error.response?.data?.message || error.message}`, '#ff5555');
    }
  };

  // Handle cancel button
  const handleCancel = () => {
    if (isLoading && sessionId) {
      stopAutomation({ sessionId })
        .then(() => {
          addLog('Automation stopped by user', 'warning');
          addTerminalLine('Automation stopped by user', '#ffff55');
          setIsLoading(false);
        })
        .catch(error => {
          addLog(`Error stopping automation: ${error.message}`, 'error');
          addTerminalLine(`Error stopping automation: ${error.message}`, '#ff5555');
        });
    }
  };

  // Handle terminal input
  const handleTerminalInput = (input) => {
    addTerminalLine(`$ ${input}`);
    
    // Process commands
    if (input.toLowerCase() === 'help') {
      addTerminalLine('Available commands:');
      addTerminalLine('  help - Show this help message');
      addTerminalLine('  status - Check automation status');
      addTerminalLine('  stop - Stop the automation');
      addTerminalLine('  clear - Clear the terminal');
      addTerminalLine('  reconnect - Reconnect to WebSocket server');
    } else if (input.toLowerCase() === 'status') {
      if (isLoading) {
        addTerminalLine(`Automation is currently running (Session ID: ${sessionId})`, '#55ff55');
      } else {
        addTerminalLine('No automation is currently running', '#ffff55');
      }
      addTerminalLine(`WebSocket connection: ${isConnected ? 'Connected' : 'Disconnected'}`, isConnected ? '#55ff55' : '#ff5555');
    } else if (input.toLowerCase() === 'stop') {
      handleCancel();
    } else if (input.toLowerCase() === 'clear') {
      setTerminalLines([
        { text: 'Terminal cleared', color: '#00ff00' },
      ]);
    } else if (input.toLowerCase() === 'reconnect') {
      websocketService.connect()
        .then(() => {
          setIsConnected(true);
          addTerminalLine('Reconnected to server', '#55ff55');
        })
        .catch(error => {
          addTerminalLine(`Failed to reconnect: ${error.message}`, '#ff5555');
        });
    } else {
      addTerminalLine(`Command not found: ${input}`, '#ff5555');
    }
  };

  return (
    <AppContainer>
      <AppHeader>
        <Title>AI Course Automater</Title>
        <Subtitle>Automate your TargetSolutions courses with AI</Subtitle>
        <ConnectionStatus>
          <StatusIndicator connected={isConnected} />
          {isConnected ? 'Connected to server' : 'Disconnected from server'}
        </ConnectionStatus>
      </AppHeader>
      
      <MainContent>
        <TerminalSection>
          <TerminalUI 
            terminalLineData={terminalLines}
            onInput={handleTerminalInput}
          />
        </TerminalSection>
        
        {!isAuthenticated ? (
          <LoginForm 
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        ) : (
          <LogOutput logs={logs} />
        )}
      </MainContent>
    </AppContainer>
  );
}

export default App;
