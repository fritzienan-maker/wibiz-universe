import { Router } from "express";
import { z }      from "zod";
import { requireAuth, requireStaff } from "../_core/auth";
import {
  listResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  listTutorialVideos,
  getTutorialVideoById,
  createTutorialVideo,
  updateTutorialVideo,
  deleteTutorialVideo,
} from "../db";

// ─── Public (client-facing) — authenticated reads ─────────────────────────────
export const resourcesPublicRouter = Router();
resourcesPublicRouter.use(requireAuth);

// GET /api/resources — list active resources for clients
resourcesPublicRouter.get("/", async (_req, res): Promise<void> => {
  const items = await listResources(true);
  res.json({ resources: items });
});

// GET /api/resources/tutorials — list active tutorial videos for clients
resourcesPublicRouter.get("/tutorials", async (_req, res): Promise<void> => {
  const items = await listTutorialVideos(true);
  res.json({ tutorials: items });
});

// ─── Staff CRUD (wibiz_admin + operator) ──────────────────────────────────────
export const staffRouter = Router();
staffRouter.use(requireAuth, requireStaff);

// ── Resource schemas ──────────────────────────────────────────────────────────
const resourceSchema = z.object({
  title:       z.string().min(1, "Title is required").max(255),
  description: z.string().optional().nullable(),
  category:    z.string().max(100).optional().nullable(),
  url:         z.string().optional().nullable(),
  icon:        z.string().max(10).optional().nullable(),
  orderIndex:  z.number().int().min(0).default(0),
  isActive:    z.boolean().default(true),
});

// GET /api/staff/resources — all resources (including inactive, for admin view)
staffRouter.get("/resources", async (_req, res): Promise<void> => {
  const items = await listResources();
  res.json({ resources: items });
});

// POST /api/staff/resources
staffRouter.post("/resources", async (req, res): Promise<void> => {
  const parsed = resourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = await createResource(parsed.data);
  res.status(201).json({ resource: item });
});

// PUT /api/staff/resources/:id
staffRouter.put("/resources/:id", async (req, res): Promise<void> => {
  const existing = await getResourceById(req.params.id!);
  if (!existing) { res.status(404).json({ error: "Resource not found" }); return; }
  const parsed = resourceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = await updateResource(req.params.id!, parsed.data);
  res.json({ resource: item });
});

// DELETE /api/staff/resources/:id
staffRouter.delete("/resources/:id", async (req, res): Promise<void> => {
  const existing = await getResourceById(req.params.id!);
  if (!existing) { res.status(404).json({ error: "Resource not found" }); return; }
  await deleteResource(req.params.id!);
  res.json({ message: "deleted" });
});

// ── Tutorial video schemas ─────────────────────────────────────────────────────
const tutorialSchema = z.object({
  title:      z.string().min(1, "Title is required").max(255),
  duration:   z.string().max(20).optional().nullable(),
  videoUrl:   z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).default(0),
  isActive:   z.boolean().default(true),
});

// GET /api/staff/tutorials — all tutorials (including inactive)
staffRouter.get("/tutorials", async (_req, res): Promise<void> => {
  const items = await listTutorialVideos();
  res.json({ tutorials: items });
});

// POST /api/staff/tutorials
staffRouter.post("/tutorials", async (req, res): Promise<void> => {
  const parsed = tutorialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = await createTutorialVideo(parsed.data);
  res.status(201).json({ tutorial: item });
});

// PUT /api/staff/tutorials/:id
staffRouter.put("/tutorials/:id", async (req, res): Promise<void> => {
  const existing = await getTutorialVideoById(req.params.id!);
  if (!existing) { res.status(404).json({ error: "Tutorial not found" }); return; }
  const parsed = tutorialSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = await updateTutorialVideo(req.params.id!, parsed.data);
  res.json({ tutorial: item });
});

// DELETE /api/staff/tutorials/:id
staffRouter.delete("/tutorials/:id", async (req, res): Promise<void> => {
  const existing = await getTutorialVideoById(req.params.id!);
  if (!existing) { res.status(404).json({ error: "Tutorial not found" }); return; }
  await deleteTutorialVideo(req.params.id!);
  res.json({ message: "deleted" });
});
