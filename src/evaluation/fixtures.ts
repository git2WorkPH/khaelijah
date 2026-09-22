export interface EvaluationFixture { readonly id: string; readonly prompt: string; readonly expectedDocumentId?: string; readonly expectsInsufficiency?: boolean; }

export const technologyFixtures: readonly EvaluationFixture[] = [
  { id: "validation", prompt: "Plan a TypeScript REST endpoint that validates request input and returns consistent errors.", expectedDocumentId: "validation" },
  { id: "payments", prompt: "Propose a test strategy for a service that calls an external payment provider.", expectedDocumentId: "payments" },
  { id: "dependency-injection", prompt: "Outline dependency injection boundaries for repositories and services.", expectedDocumentId: "dependency-injection" },
  { id: "observability", prompt: "Give a deployment readiness plan for a TypeScript API including observability.", expectedDocumentId: "observability" },
  { id: "incomplete-auth", prompt: "Recommend an authentication approach for an undocumented protocol.", expectsInsufficiency: true },
];
