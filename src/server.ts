import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCampusLocations, loadDirectoryCache } from "./data.js";
import { handleUserSearch, resolvePersonById } from "./resolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const app = express();
const port = Number(process.env.PORT ?? 3042);

app.use(express.json());
app.use(express.static(publicDir));

app.get("/api/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "");
    const [directory, locations] = await Promise.all([
      loadDirectoryCache(),
      loadCampusLocations()
    ]);

    const result = await handleUserSearch(query, directory, locations);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/person/:id", async (req, res, next) => {
  try {
    const [directory, locations] = await Promise.all([
      loadDirectoryCache(),
      loadCampusLocations()
    ]);

    const result = await resolvePersonById(req.params.id, directory, locations);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({
    type: "error",
    message: err instanceof Error ? err.message : "Unknown server error"
  });
});

app.listen(port, () => {
  console.log(`JJC Campus Pathfinder MVP running at http://localhost:${port}`);
});
