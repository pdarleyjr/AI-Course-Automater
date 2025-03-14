import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Terminal from 'react-terminal-ui';

const TerminalContainer = styled.div`
  width: 100%;
  max-width: 900px;
  height: 250px;
  margin: 0 auto;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
`;

const TerminalHeader = styled.div`
  background-color: #333;
  color: #fff;
  padding: 10px 15px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderTitle = styled.div`
  font-weight: bold;
`;

const HeaderControls = styled.div`
  display: flex;
  gap: 8px;
`;

const HeaderButton = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.color};
  cursor: pointer;
`;

const TerminalUI = ({ 
  terminalLineData = [], 
  onInput, 
  showPrompt = true,
  promptLabel = '> '
}) => {
  const [terminalLineState, setTerminalLineState] = useState(terminalLineData);

  useEffect(() => {
    setTerminalLineState(terminalLineData);
  }, [terminalLineData]);

  const handleInput = (input) => {
    if (onInput) {
      onInput(input);
    }
  };

  return (
    <TerminalContainer>
      <TerminalHeader>
        <HeaderTitle>AI Course Automater</HeaderTitle>
        <HeaderControls>
          <HeaderButton color="#FF5F56" />
          <HeaderButton color="#FFBD2E" />
          <HeaderButton color="#27C93F" />
        </HeaderControls>
      </TerminalHeader>
      <Terminal
        name="AI Course Automater Terminal"
        prompt={promptLabel}
        colorMode="dark"
        lineData={terminalLineState}
        onInput={handleInput}
        showPrompt={showPrompt}
      />
    </TerminalContainer>
  );
};

export default TerminalUI;