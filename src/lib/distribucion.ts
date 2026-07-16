export const JUNIOR_VALUE = 50000;
export const EJECUTIVO_DEFAULT_VALUE = 100000;

export type AgentType = "junior" | "ejecutivo";

export interface Agent {
  id: string;
  office_id: string;
  name: string;
  type: AgentType;
  custom_value: number | null;
  position: number;
}

export interface Office {
  id: string;
  name: string;
  admin_amount: number;
  position: number;
  agents: Agent[];
}

export function agentValue(agent: Pick<Agent, "type" | "custom_value">): number {
  if (agent.type === "junior") return JUNIOR_VALUE;
  return agent.custom_value ?? EJECUTIVO_DEFAULT_VALUE;
}

export function officeTotal(office: Pick<Office, "agents">): number {
  return office.agents.reduce((sum, a) => sum + agentValue(a), 0);
}
