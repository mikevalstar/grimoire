import { z } from "zod";

export const documentSearchSchema = z.object({
  status: z.string().optional().catch(undefined),
  priority: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  desc: z.boolean().optional().catch(undefined),
});

export type DocumentSearch = z.infer<typeof documentSearchSchema>;
