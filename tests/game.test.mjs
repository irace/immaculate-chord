import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const temp = await mkdtemp(path.join(tmpdir(), 'chord-tests-'));
const files = {
  'lib/game.ts': 'game',
  'lib/puzzles.ts': 'puzzles',
  'lib/server.ts': 'server',
  'lib/grader.ts': 'grader',
  'app/api/boards/route.ts': 'create',
  'app/api/boards/[id]/route.ts': 'read',
  'app/api/boards/[id]/answers/route.ts': 'submit',
};
for (const [source, name] of Object.entries(files)) {
  let code = ts.transpileModule(await readFile(source, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  code = code
    .replace(/from ['"]@\/db['"]/g, "from './db.mjs'")
    .replace(
      /from ['"](?:@\/lib\/|\.\/)(game|puzzles|server|grader)['"]/g,
      "from './$1.mjs'",
    );
  await writeFile(`${temp}/${name}.mjs`, code);
}
await writeFile(
  `${temp}/db.mjs`,
  `import {DatabaseSync} from 'node:sqlite';
export const sql=new DatabaseSync(':memory:');export const config={key:'test-only',model:'openrouter/free'};
export const getGradingConfig=()=>config;
export const getDb=()=>({prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);}}}}}});`,
);
const { sql, config } = await import(`${temp}/db.mjs`);
sql.exec(await readFile('drizzle/0000_abnormal_guardsmen.sql', 'utf8'));
const { POST: create } = await import(`${temp}/create.mjs`),
  { GET: read } = await import(`${temp}/read.mjs`),
  { POST: submit } = await import(`${temp}/submit.mjs`);
const { scoreAnswer, normalizeSong } = await import(`${temp}/game.mjs`),
  { puzzles } = await import(`${temp}/puzzles.mjs`);
const owner = 'test_owner_abcdefghijklmnopqrstuvwxyz0123456789';
const req = (body, token = owner) =>
  new Request('https://chord.test/api/boards', {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
let mode = 'valid',
  calls = 0,
  release;
globalThis.fetch = async () => {
  calls++;
  if (mode === 'wait') await new Promise((r) => (release = r));
  if (mode === '429') return new Response('', { status: 429 });
  if (mode === 'malformed')
    return Response.json({ choices: [{ message: { content: 'not json' } }] });
  return Response.json({
    model: 'test-model',
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: `Song ${calls}`,
            artist: 'Test Artist',
            rowFit: 100,
            colFit: 90,
            obscurity: 80,
            explanation: 'Test-only mocked musical judgment.',
          }),
        },
      },
    ],
  });
};
const open = async (puzzleId = '01') => {
  const r = await create(req({ puzzleId, ownerToken: owner }));
  assert.equal(r.status, 201);
  return r.json();
};
const post = (id, cell, title = `Input ${cell}`, token = owner) =>
  submit(req({ cell, title, artist: 'Test Artist' }, token), {
    params: Promise.resolve({ id }),
  });
await test('20 complete unique puzzles and scoring boundaries', () => {
  assert.equal(puzzles.length, 20);
  assert.equal(new Set(puzzles.map((p) => p.id)).size, 20);
  for (const p of puzzles) {
    assert.equal(p.rows.length, 3);
    assert.equal(p.cols.length, 3);
  }
  assert.equal(scoreAnswer(100, 100, 100), 100);
  assert.equal(scoreAnswer(100, 100, 0), 80);
  assert.equal(scoreAnswer(0, 100, 100), 1);
  assert.equal(scoreAnswer(20, 100, 100), 20);
  assert.equal(normalizeSong('Héllo!', 'A B'), normalizeSong('hello', 'AB'));
});
await test('sessions resume, viewers cannot edit, missing key does not consume a square', async () => {
  const b = await open();
  assert.equal((await open()).id, b.id);
  const r = await read(req(null, 'someone_else'), {
    params: Promise.resolve({ id: b.id }),
  });
  assert.equal((await r.json()).editable, false);
  assert.equal((await post(b.id, 0, 'Any song', 'someone_else')).status, 403);
  config.key = '';
  assert.equal((await post(b.id, 0)).status, 503);
  assert.deepEqual(
    JSON.parse(
      sql.prepare('SELECT answers FROM boards WHERE id=?').get(b.id).answers,
    ),
    [],
  );
  config.key = 'test-only';
});
await test('upstream failure and malformed grade leave square open and release lease', async () => {
  const b = await open();
  for (const m of ['429', 'malformed']) {
    mode = m;
    assert.equal((await post(b.id, 0)).status, 503);
    const row = sql.prepare('SELECT * FROM boards WHERE id=?').get(b.id);
    assert.equal(row.answers, '[]');
    assert.equal(row.lease, null);
  }
  mode = 'valid';
});
await test('concurrent submission cannot overwrite or add a second answer', async () => {
  const b = await open();
  mode = 'wait';
  const pending = post(b.id, 0);
  while (!release) await new Promise((r) => setTimeout(r, 1));
  assert.equal((await post(b.id, 1)).status, 409);
  mode = 'valid';
  release();
  assert.equal((await pending).status, 200);
  const row = sql.prepare('SELECT * FROM boards WHERE id=?').get(b.id);
  assert.equal(JSON.parse(row.answers).length, 1);
  assert.equal(row.lease, null);
});
await test('locked squares, duplicate songs, completed board and read-only shared result', async () => {
  const b = await open();
  assert.equal((await post(b.id, 0)).status, 409);
  const first = JSON.parse(
    sql.prepare('SELECT answers FROM boards WHERE id=?').get(b.id).answers,
  )[0];
  assert.equal((await post(b.id, 1, first.title)).status, 409);
  for (let cell = 1; cell < 9; cell++)
    assert.equal((await post(b.id, cell)).status, 200);
  assert.equal((await post(b.id, 8)).status, 409);
  const r = await read(req(), { params: Promise.resolve({ id: b.id }) });
  const done = await r.json();
  assert.equal(done.answers.length, 9);
  assert.equal(done.locked, true);
  assert.equal(done.editable, false);
  assert.equal('owner_hash' in done, false);
});
await test('invalid cells and cross-origin writes are rejected', async () => {
  const b = await open('02');
  assert.equal((await post(b.id, 9)).status, 400);
  const foreign = req({ puzzleId: '02', ownerToken: owner });
  foreign.headers.set('Origin', 'https://other.test');
  assert.equal((await create(foreign)).status, 403);
});
sql.close();
await rm(temp, { recursive: true, force: true });
