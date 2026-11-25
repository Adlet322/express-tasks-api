const express = require('express');
const { randomUUID } = require('node:crypto');

const app = express();
const router = express.Router();
const tasks = new Map();

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => console.log(req.method, req.originalUrl, res.statusCode, Date.now() - started + 'ms'));
  next();
});
app.use(express.json({ limit: '16kb' }));

router.param('id', (req, res, next, id) => {
  req.task = tasks.get(id);
  if (!req.task) return res.status(404).json({ error: 'Task not found' });
  next();
});

function validateTask(req, res, next) {
  const { body } = req;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected a JSON object' });
  }
  const { title, done } = body;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120 ||
      (done !== undefined && typeof done !== 'boolean')) {
    return res.status(400).json({ error: 'Expected a title of 1–120 characters and an optional boolean done' });
  }
  req.taskFields = { title: title.trim(), done: done ?? false };
  next();
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.get('/', (_req, res) => res.json([...tasks.values()]));
router.post('/', validateTask, (req, res) => {
  const task = { id: randomUUID(), ...req.taskFields };
  tasks.set(task.id, task);
  res.location('/api/tasks/' + task.id).status(201).json(task);
});
router.get('/:id', (req, res) => res.json(req.task));
router.put('/:id', validateTask, (req, res) => {
  const task = { id: req.task.id, ...req.taskFields };
  tasks.set(task.id, task);
  res.json(task);
});
router.delete('/:id', (req, res) => {
  tasks.delete(req.task.id);
  res.status(204).end();
});
app.use('/api/tasks', router);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Body too large' });
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3002);
app.listen(port, '127.0.0.1', () => console.log('Express API: http://127.0.0.1:' + port));

