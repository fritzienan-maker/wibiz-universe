// ─── DocuSeal API client ──────────────────────────────────────────────────────
// Sends e-signature requests via the DocuSeal v1 API.
// Docs: https://www.docuseal.com/docs/api

import { ENV } from "../_core/env";

const BASE = "https://api.docuseal.com";

// Template IDs per plan tier — Client Success Manual
export const CSM_TEMPLATE_IDS = {
  lite:     3353578,
  standard: 3353589,
  pro:      3353585,
} as const;

export type PlanTier = keyof typeof CSM_TEMPLATE_IDS;

// ─── Send a document submission ───────────────────────────────────────────────
export async function sendDocusealSubmission(params: {
  templateId: number;
  email:      string;
  name:       string;
}): Promise<{ submissionId: number }> {
  if (!ENV.docusealApiToken) throw new Error("DOCUSEAL_API_TOKEN is not configured");

  const res = await fetch(`${BASE}/submissions`, {
    method: "POST",
    headers: {
      "X-Auth-Token": ENV.docusealApiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: params.templateId,
      send_email:  true,
      submitters: [
        {
          role:  ENV.docusealSignerRole,
          email: params.email,
          name:  params.name,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DocuSeal API ${res.status}: ${body}`);
  }

  // DocuSeal returns an array of submitter objects; each has submission_id
  const data = await res.json();
  const submitter = Array.isArray(data) ? data[0] : data;
  const submissionId: number = submitter?.submission_id ?? submitter?.id;

  if (!submissionId) throw new Error("DocuSeal did not return a submission ID");
  return { submissionId };
}

// ─── Send Client Success Manual ───────────────────────────────────────────────
export async function sendCsmDocument(user: {
  email:     string;
  firstName: string | null;
  lastName:  string | null;
  planTier:  string | null;
}): Promise<{ submissionId: number; templateId: number }> {
  const tier = (user.planTier ?? "lite") as PlanTier;
  const templateId = CSM_TEMPLATE_IDS[tier] ?? CSM_TEMPLATE_IDS.lite;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  const { submissionId } = await sendDocusealSubmission({
    templateId,
    email: user.email,
    name,
  });

  return { submissionId, templateId };
}
