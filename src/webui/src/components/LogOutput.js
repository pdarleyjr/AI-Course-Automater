import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

const LogContainer = styled.div`
  background-color: #0c0c0c;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  padding: 15px;
  height: 300px;
  overflow-y: auto;
  border: 1px solid #333;
  margin-top: 20px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const LogLine = styled.div`
  margin-bottom: 5px;
  line-height: 1.4;
  
  &.error {
    color: #ff5555;
  }
  
  &.warning {
    color: #ffff55;
  }
  
  &.success {
    color: #55ff55;
  }
  
  &.info {
    color: #5555ff;
  }
`;

const Timestamp = styled.span`
  color: #888;
  margin-right: 8px;
`;

const LogOutput = ({ logs = [] }) => {
  const logContainerRef = useRef(null);
  
  // Auto-scroll to the bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return `[${date.toLocaleTimeString()}]`;
  };
  
  return (
    <LogContainer ref={logContainerRef}>
      {logs.length === 0 ? (
        <LogLine>Waiting for automation to start...</LogLine>
      ) : (
        logs.map((log, index) => (
          <LogLine key={index} className={log.type || ''}>
            <Timestamp>{formatTimestamp(log.timestamp || new Date())}</Timestamp>
            {log.message}
          </LogLine>
        ))
      )}
    </LogContainer>
  );
};

export default LogOutput;