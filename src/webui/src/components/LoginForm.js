import React, { useState } from 'react';
import styled from 'styled-components';

const FormContainer = styled.div`
  font-family: 'Courier New', monospace;
  color: #00ff00;
  width: 100%;
  margin-top: 20px;
`;

const FormField = styled.div`
  margin-bottom: 10px;
`;

const Label = styled.div`
  margin-bottom: 5px;
  display: flex;
  align-items: center;
`;

const Prompt = styled.span`
  color: #00ff00;
  margin-right: 8px;
`;

const Input = styled.input`
  background-color: #0c0c0c;
  border: 1px solid #333;
  color: #00ff00;
  padding: 8px 12px;
  font-family: 'Courier New', monospace;
  width: 100%;
  margin-top: 5px;
  outline: none;
  
  &:focus {
    border-color: #00ff00;
  }
`;

const Button = styled.button`
  background-color: #0c0c0c;
  border: 1px solid #00ff00;
  color: #00ff00;
  padding: 8px 16px;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  margin-right: 10px;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: #00ff00;
    color: #0c0c0c;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  margin-top: 15px;
`;

const ErrorMessage = styled.div`
  color: #ff0000;
  margin-top: 15px;
  font-size: 14px;
`;

const LoginForm = ({ onSubmit, onCancel, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!username || !password || !apiKey) {
      setError('All fields are required');
      return;
    }
    
    onSubmit({ username, password, apiKey });
    
    // Clear sensitive data from state after submission
    // This is a security best practice
    if (!isLoading) {
      setPassword('');
      setApiKey('');
    }
  };

  return (
    <FormContainer>
      <form onSubmit={handleSubmit}>
        <FormField>
          <Label>
            <Prompt>$</Prompt> Enter TargetSolutions Username:
          </Label>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
        </FormField>
        
        <FormField>
          <Label>
            <Prompt>$</Prompt> Enter TargetSolutions Password:
          </Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
        </FormField>
        
        <FormField>
          <Label>
            <Prompt>$</Prompt> Enter OpenAI API Key:
          </Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            placeholder="sk-..."
          />
        </FormField>
        
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <ButtonContainer>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Start Automation'}
          </Button>
          <Button type="button" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </ButtonContainer>
      </form>
    </FormContainer>
  );
};

export default LoginForm;