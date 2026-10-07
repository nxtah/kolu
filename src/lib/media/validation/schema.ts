import { z } from "zod";

// Input boundary for media URL submission (docs/API.md POST /api/media/validate).
// Validates shape only — provider detection, scheme/host allowlisting, and ID
// extraction happen downstream via lib/security/url.ts and the provider
// adapters, never a raw network fetch of the submitted URL.
export const mediaUrlSubmissionSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

export type MediaUrlSubmission = z.infer<typeof mediaUrlSubmissionSchema>;
