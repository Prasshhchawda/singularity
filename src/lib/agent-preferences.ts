const agentPreferenceStorageKey = (userId: string) => `singularity-agent-preference:${userId}`;

export function getPreferredAgent(userId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(agentPreferenceStorageKey(userId));
}

export function setPreferredAgent(userId: string, agentName: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(agentPreferenceStorageKey(userId), agentName);
}
