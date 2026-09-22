import type { GroundedResponse } from "../core/contracts.js";
import { GroundedPlanner } from "../rag/grounded-planner.js";

export interface AgentLog { readonly requestId: string; readonly task: string; readonly status: GroundedResponse["status"]; readonly passageIds: readonly string[]; }

/** Read-only orchestration: it has no filesystem, shell, network, git, credential, or deployment capability. */
export class ReadOnlyPlanningAgent {
  readonly logs: AgentLog[] = [];
  constructor(private readonly planner: GroundedPlanner) {}
  async plan(task: string, requestId: string, at: string): Promise<GroundedResponse> {
    if (!task.trim() || task.length > 8000) throw new Error("Provide an application-planning request between 1 and 8000 characters.");
    const response = await this.planner.plan(task, requestId, at);
    this.logs.push({ requestId, task, status: response.status, passageIds: response.evidence.passages.map((passage) => passage.chunk.id) });
    return response;
  }
}
