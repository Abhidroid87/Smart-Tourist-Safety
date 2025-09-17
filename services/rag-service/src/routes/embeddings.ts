import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    // TODO: Generate embeddings using OpenAI or other service
    res.json({ success: true, embeddings: [/* mock data */] });
  } catch (err) {
    console.error("Embeddings error:", err);
    res.status(500).json({ error: "Failed to generate embeddings" });
  }
});

export default router;
