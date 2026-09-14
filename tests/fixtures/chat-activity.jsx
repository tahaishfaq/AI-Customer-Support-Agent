import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicWebchat } from '../../components/embed/PublicWebchat';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace';
import { AgentTestStudio } from '../../components/studio/AgentTestStudio';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={client}>
    {location.pathname === '/studio' ? <AgentTestStudio agent={window.__agent} /> : location.pathname === '/workspace' ? <ChatWorkspace /> : <PublicWebchat agent={window.__agent} />}
  </QueryClientProvider>
);
