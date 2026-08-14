import { create } from "zustand";

export const useBreadcrumbStore = create((set) => ({
  agentName: null,
  setAgentName: (agentName) => set({ agentName }),
}));
