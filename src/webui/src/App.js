import React, { useState } from 'react';
import styled from 'styled-components';
import TerminalUI from './components/TerminalUI';
import LoginForm from './components/LoginForm';
import LogOutput from './components/LogOutput';
import { startAutomation, stopAutomation } from './services/api';
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

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState([]);
  const [terminalLines, setTerminalLines] = useState([
    { text: 'Welcome to AI Course Automater', color: '#00ff00' },
    { text: 'Please enter your credentials to begin.', color: '#00ff00' },
  ]);

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
    setIsLoading(true);
    addLog('Authenticating with TargetSolutions...', 'info');
    addTerminalLine('Authenticating with TargetSolutions...');
    
    try {
      await startAutomation(credentials);
      
      addLog('Authentication successful!', 'success');
      addTerminalLine('Authentication successful!', '#55ff55');
      addTerminalLine('Starting course automation...', '#55ff55');
      addLog('Starting course automation...', 'info');
      
      setIsAuthenticated(true);
      
      // Simulate receiving logs from the backend
      // In a real implementation, this would be replaced with WebSocket or polling
      const simulateBackendLogs = () => {
        const messages = [
          { message: 'Connecting to TargetSolutions...', type: 'info' },
          { message: 'Connected successfully!', type: 'success' },
          { message: 'Retrieving available courses...', type: 'info' },
          { message: 'Found 5 courses to complete', type: 'info' },
          { message: 'Starting course 1 of 5: "Workplace Safety"', type: 'info' },
          { message: 'Analyzing course content...', type: 'info' },
          { message: 'Generating responses using OpenAI...', type: 'info' },
          { message: 'Submitting answers...', type: 'info' },
          { message: 'Course 1 completed successfully!', type: 'success' },
        ];
        
        let index = 0;
        const interval = setInterval(() => {
          if (index < messages.length) {
            addLog(messages[index].message, messages[index].type);
            addTerminalLine(messages[index].message, messages[index].type === 'success' ? '#55ff55' : '#00ff00');
            index++;
          } else {
            clearInterval(interval);
            setIsLoading(false);
          }
        }, 2000);
        
        return () => clearInterval(interval);
      };
      
      simulateBackendLogs();
      
    } catch (error) {
      setIsLoading(false);
      addLog(`Authentication failed: ${error.response?.data?.message || error.message}`, 'error');
      addTerminalLine(`Authentication failed: ${error.response?.data?.message || error.message}`, '#ff5555');
    }
  };

  // Handle cancel button
  const handleCancel = () => {
    if (isLoading) {
      stopAutomation()
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
    } else if (input.toLowerCase() === 'status') {
      if (isLoading) {
        addTerminalLine('Automation is currently running', '#55ff55');
      } else {
        addTerminalLine('No automation is currently running', '#ffff55');
      }
    } else if (input.toLowerCase() === 'stop') {
      handleCancel();
    } else if (input.toLowerCase() === 'clear') {
      setTerminalLines([
        { text: 'Terminal cleared', color: '#00ff00' },
      ]);
    } else {
      addTerminalLine(`Command not found: ${input}`, '#ff5555');
    }
  };

  return (
    <AppContainer>
      <AppHeader>
        <Title>AI Course Automater</Title>
        <Subtitle>Automate your TargetSolutions courses with AI</Subtitle>
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
