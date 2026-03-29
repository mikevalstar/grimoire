import { z } from "zod";

// --- Shared enums ---

export const featureStatusSchema = z.enum(["proposed", "in-progress", "complete", "deprecated"]);
export const requirementStatusSchema = z.enum([
  "draft",
  "approved",
  "in-progress",
  "done",
  "rejected",
]);
export const taskStatusSchema = z.enum(["todo", "in-progress", "done", "blocked", "cancelled"]);
export const decisionStatusSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "superseded",
  "deprecated",
]);
export const prioritySchema = z.enum(["critical", "high", "medium", "low"]);
export const documentTypeSchema = z.enum([
  "overview",
  "feature",
  "requirement",
  "task",
  "decision",
]);

// --- Document frontmatter schemas ---

export const overviewFrontmatterSchema = z.object({
  id: z.string().default("overview"),
  title: z.string().default(""),
  description: z.string().default(""),
  type: z.literal("overview").default("overview"),
  version: z.number().default(1),
  created: z.coerce.string().default(""),
  updated: z.coerce.string().default(""),
  tags: z.array(z.string()).default([]),
});

export const featureFrontmatterSchema = z.object({
  id: z.string(),
  uid: z.string(),
  title: z.string(),
  type: z.literal("feature").default("feature"),
  status: featureStatusSchema.default("proposed"),
  priority: prioritySchema.default("medium"),
  created: z.coerce.string().default(""),
  updated: z.coerce.string().default(""),
  tags: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
});

export const requirementFrontmatterSchema = z.object({
  id: z.string(),
  uid: z.string(),
  title: z.string(),
  type: z.literal("requirement").default("requirement"),
  status: requirementStatusSchema.default("draft"),
  priority: prioritySchema.default("medium"),
  feature: z.string().default(""),
  created: z.coerce.string().default(""),
  updated: z.coerce.string().default(""),
  tags: z.array(z.string()).default([]),
  tasks: z.array(z.string()).default([]),
  depends_on: z.array(z.string()).default([]),
});

export const taskFrontmatterSchema = z.object({
  id: z.string(),
  uid: z.string(),
  title: z.string(),
  type: z.literal("task").default("task"),
  status: taskStatusSchema.default("todo"),
  priority: prioritySchema.default("medium"),
  requirement: z.string().default(""),
  feature: z.string().default(""),
  assignee: z.string().default(""),
  created: z.coerce.string().default(""),
  updated: z.coerce.string().default(""),
  tags: z.array(z.string()).default([]),
  depends_on: z.array(z.string()).default([]),
});

export const decisionFrontmatterSchema = z.object({
  id: z.string(),
  uid: z.string(),
  title: z.string(),
  type: z.literal("decision").default("decision"),
  status: decisionStatusSchema.default("proposed"),
  date: z.coerce.string().default(""),
  created: z.coerce.string().default(""),
  updated: z.coerce.string().default(""),
  tags: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  supersedes: z.string().default(""),
  superseded_by: z.string().default(""),
});

// --- Shared types ---

export const documentTypes = ["feature", "requirement", "task", "decision"] as const;
export type DocumentType = (typeof documentTypes)[number];

// --- CLI option schemas ---

export const initOptionsSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  cwd: z.string().optional(),
});

export const overviewOptionsSchema = z.object({
  compact: z.boolean().default(false),
  cwd: z.string().optional(),
});

export const updateOverviewOptionsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  addTag: z.array(z.string()).default([]),
  removeTag: z.array(z.string()).default([]),
  body: z.string().optional(),
  append: z.string().optional(),
  cwd: z.string().optional(),
});

export const createDocumentOptionsSchema = z.object({
  type: z.enum(["feature", "requirement", "task", "decision"]),
  title: z.string(),
  id: z.string().optional(),
  status: z.string().optional(),
  priority: prioritySchema.optional(),
  tags: z.array(z.string()).default([]),
  feature: z.string().optional(),
  requirement: z.string().optional(),
  body: z.string().default(""),
  cwd: z.string().optional(),
});

export const getDocumentOptionsSchema = z.object({
  type: z.enum(["feature", "requirement", "task", "decision"]),
  id: z.string(),
  metadataOnly: z.boolean().default(false),
  noChangelog: z.boolean().default(false),
  cwd: z.string().optional(),
});

export const listDocumentsOptionsSchema = z.object({
  type: z.enum(["feature", "requirement", "task", "decision"]),
  status: z.string().optional(),
  priority: z.string().optional(),
  tag: z.string().optional(),
  feature: z.string().optional(),
  limit: z.number().optional(),
  sort: z.string().default("updated"),
  cwd: z.string().optional(),
});

export const updateDocumentOptionsSchema = z.object({
  type: z.enum(["feature", "requirement", "task", "decision"]),
  id: z.string(),
  title: z.string().optional(),
  status: z.string().optional(),
  priority: prioritySchema.optional(),
  addTag: z.array(z.string()).default([]),
  removeTag: z.array(z.string()).default([]),
  body: z.string().optional(),
  append: z.string().optional(),
  feature: z.string().optional(),
  requirement: z.string().optional(),
  cwd: z.string().optional(),
});

export const deleteDocumentOptionsSchema = z.object({
  type: z.enum(["feature", "requirement", "task", "decision"]),
  id: z.string(),
  hard: z.boolean().default(false),
  cwd: z.string().optional(),
});

export const appendLogOptionsSchema = z.object({
  id: z.string(),
  message: z.string().min(1),
  author: z.string().optional().default("agent"),
  cwd: z.string().optional(),
});

export const appendCommentOptionsSchema = z.object({
  id: z.string(),
  message: z.string().min(1),
  author: z.string().optional().default("agent"),
  cwd: z.string().optional(),
});

export const validateOptionsSchema = z.object({
  cwd: z.string().optional(),
});

// --- Inferred types ---

export type OverviewFrontmatter = z.infer<typeof overviewFrontmatterSchema>;
export type FeatureFrontmatter = z.infer<typeof featureFrontmatterSchema>;
export type RequirementFrontmatter = z.infer<typeof requirementFrontmatterSchema>;
export type TaskFrontmatter = z.infer<typeof taskFrontmatterSchema>;
export type DecisionFrontmatter = z.infer<typeof decisionFrontmatterSchema>;
export type InitOptions = z.infer<typeof initOptionsSchema>;
export type OverviewOptions = z.infer<typeof overviewOptionsSchema>;
export type UpdateOverviewOptions = z.infer<typeof updateOverviewOptionsSchema>;
export type CreateDocumentOptions = z.infer<typeof createDocumentOptionsSchema>;
export type GetDocumentOptions = z.infer<typeof getDocumentOptionsSchema>;
export type ListDocumentsOptions = z.infer<typeof listDocumentsOptionsSchema>;
export type UpdateDocumentOptions = z.infer<typeof updateDocumentOptionsSchema>;
export type DeleteDocumentOptions = z.infer<typeof deleteDocumentOptionsSchema>;
export type AppendLogOptions = z.infer<typeof appendLogOptionsSchema>;
export type AppendCommentOptions = z.infer<typeof appendCommentOptionsSchema>;
export type ValidateOptions = z.infer<typeof validateOptionsSchema>;
