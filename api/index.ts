import express, { type Express, type Request, type Response } from 'express';
import { createTeam, getTeamById } from './db/index.ts';
import 'dotenv/config';
import { parseNumberSafe, getDB } from './db/helpers.ts';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'))
app.use(express.json());

const DB_URL = './db.json' // new URL(`${process.env.DATABASE_URL}`); // db.json for development

app.get('/', async (req: Request, res: Response) => {
  res.json({"hello": "world!"});
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    const db = await getDB(DB_URL);
    res.json({
      "status": "ok",
      "db": "ok"
    })
  } catch {
    res.json({
      "status": "bad",
      "db": "failed"
    })
  }
});

app.get('/teams:id', async (req: Request, res: Response) => {
  try {
    const id = parseNumberSafe(req.params.id);

    if (id !== null) {
      res.json({error: "id was not valid"});
      return;
    }

    const team = await getTeamById(DB_URL, id ?? 0);

    res.json(team);
  } catch (error) {
    res.json({error: error});
 }
});

app.post('/teams', async (req: Request, res: Response) => {
  const team = await createTeam(DB_URL, req.body);

  res.json(team);
})

app.get('/me');

app.get('/admin/users');

app.listen(3000);
