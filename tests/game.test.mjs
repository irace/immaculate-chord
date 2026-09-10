import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const temp = await mkdtemp(path.join(tmpdir(), 'chord-tests-'));
const files = {
  'app/api/account/route.ts': 'account',
  'app/api/leaderboards/route.ts': 'leaderboards',
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
export const sql=new DatabaseSync(':memory:');export const config={key:'test-only',model:'nvidia/nemotron-3-super-120b-a12b:free'};
export const getGradingConfig=()=>config;
export const getDb=()=>({prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);}}}}}});`,
);
const { sql, config } = await import(`${temp}/db.mjs`);
sql.exec(await readFile('drizzle/0000_abnormal_guardsmen.sql', 'utf8'));
sql.exec(await readFile('drizzle/0001_outgoing_dormammu.sql', 'utf8'));
sql.exec(await readFile('drizzle/0002_sudden_firebrand.sql', 'utf8'));
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
  release,
  lastRequest;
const { grade } = await import(`${temp}/grader.mjs`);
globalThis.fetch = async (_url, options) => {
  lastRequest = JSON.parse(options.body);
  calls++;
  if (mode === 'wait') await new Promise((r) => (release = r));
  if (mode === '429') return new Response('', { status: 429 });
  if (['classifier', 'null', 'array', 'empty', 'truncated'].includes(mode))
    return Response.json({
      model: 'test-model',
      choices: [
        {
          finish_reason: mode === 'truncated' ? 'length' : 'stop',
          message: {
            content: {
              classifier: 'User Safety: safe',
              null: 'null',
              array: '[]',
              empty: '',
              truncated: '{"title":"cut off',
            }[mode],
          },
        },
      ],
    });
  if (mode === 'fenced')
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content:
              '```json\n' +
              JSON.stringify({
                title: 'A song',
                artist: 'An artist',
                rowFit: 100,
                colFit: 90,
                obscurity: 50,
                explanation: 'A valid fenced test grade.',
              }) +
              '\n```',
          },
        },
      ],
    });
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
            rowFit: mode === 'wrong' ? 0 : 100,
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
  for (const m of [
    '429',
    'malformed',
    'classifier',
    'null',
    'array',
    'empty',
    'truncated',
  ]) {
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
await test('valid fenced JSON works and routing requires structured-output parameters', async () => {
  mode = 'fenced';
  const result = await grade(puzzles[0], 0, 'A song', 'An artist');
  assert.equal(result.score, 81);
  assert.equal(lastRequest.model, 'nvidia/nemotron-3-super-120b-a12b:free');
  assert.equal(lastRequest.provider.require_parameters, true);
  assert.equal(lastRequest.max_tokens, 4096);
  assert.equal(lastRequest.reasoning.effort, 'low');
  mode = 'valid';
});
await test('rejected guess leaves square open, retry fills it, nine attempts lock an incomplete grid', async () => {
  const b = await open('03');
  mode = 'wrong';
  let r = await post(b.id, 0, 'Wrong recording');
  assert.equal(r.status, 200);
  let state = await r.json();
  assert.equal(state.answers.length, 0);
  assert.equal(state.guessesLeft, 8);
  assert.equal(state.attempts[0].accepted, false);
  assert.equal(state.editable, true);
  mode = 'valid';
  r = await post(b.id, 0, 'Different recording');
  state = await r.json();
  assert.equal(state.answers.length, 1);
  assert.equal(state.guessesLeft, 7);
  for (let cell = 1; cell < 8; cell++)
    assert.equal((await post(b.id, cell)).status, 200);
  state = await (
    await read(req(), { params: Promise.resolve({ id: b.id }) })
  ).json();
  assert.equal(state.guessesUsed, 9);
  assert.equal(state.answers.length, 8);
  assert.equal(state.locked, true);
  assert.equal(state.editable, false);
  assert.equal((await post(b.id, 8)).status, 409);
});
await test('legacy answers retain guess count and false answers reopen without resetting progress', async () => {
  const b = await open('04');
  const answer = {
    cell: 0,
    title: 'Legacy',
    artist: 'Artist',
    canonicalKey: 'legacy|artist',
    rowFit: 100,
    colFit: 100,
    obscurity: 0,
    score: 80,
    explanation: 'Test',
    model: 'test',
  };
  sql
    .prepare('UPDATE boards SET answers=? WHERE id=?')
    .run(
      JSON.stringify([answer, { ...answer, cell: 1, rowFit: 0, score: 1 }]),
      b.id,
    );
  const state = await (
    await read(req(), { params: Promise.resolve({ id: b.id }) })
  ).json();
  assert.equal(state.guessesUsed, 2);
  assert.equal(state.guessesLeft, 7);
  assert.equal(state.answers.length, 1);
  assert.equal(state.attempts[1].accepted, false);
});

await test('accounts require identity, claim owned guests, isolate runs, and rank server scores', async () => {
  const { POST: save, GET: account } = await import(`${temp}/account.mjs`);
  const { GET: leaders } = await import(`${temp}/leaderboards.mjs`);
  const auth = (body, id = 'alice', token = owner) => {
    const r = req(body, token);
    r.headers.set('oai-authenticated-user-id', id);
    r.headers.set('oai-authenticated-user-email', id + '@test.invalid');
    return r;
  };
  assert.equal((await save(req({ username: 'Alice' }))).status, 401);
  assert.equal(
    (await create(auth({ puzzleId: '18', ownerToken: owner }, 'new_user')))
      .status,
    409,
  );
  const pendingGuest = await (
    await create(req({ puzzleId: '18', ownerToken: owner }))
  ).json();
  const pendingContext = { params: Promise.resolve({ id: pendingGuest.id }) };
  assert.equal(
    (await (await read(auth(undefined, 'new_user'), pendingContext)).json())
      .editable,
    false,
  );
  assert.equal(
    (
      await submit(
        auth({ cell: 0, title: 'Song', artist: 'Artist' }, 'new_user'),
        pendingContext,
      )
    ).status,
    403,
  );

  assert.equal((await save(auth({ username: 'Alice' }))).status, 200);
  assert.equal((await save(auth({ username: 'alice' }, 'bob'))).status, 409);
  assert.equal((await save(auth({ username: 'Bob' }, 'bob'))).status, 200);
  const guestToken = 'claimable_guest_abcdefghijklmnopqrstuvwxyz123456';
  const guest = await (
    await create(req({ puzzleId: '20', ownerToken: guestToken }, guestToken))
  ).json();
  const claimed = await (
    await create(
      auth({ puzzleId: '20', ownerToken: guestToken }, 'alice', guestToken),
    )
  ).json();
  assert.equal(claimed.id, guest.id);
  const signedGuest = await (
    await create(req({ puzzleId: '17', ownerToken: guestToken }, guestToken))
  ).json();
  const signedView = await (
    await read(auth(undefined, 'alice', guestToken), {
      params: Promise.resolve({ id: signedGuest.id }),
    })
  ).json();
  assert.equal(signedView.editable, false);
  assert.equal(signedView.resumeWithAccount, true);
  const sharedView = await (
    await read(
      auth(
        undefined,
        'alice',
        'unrelated_browser_abcdefghijklmnopqrstuvwxyz123456',
      ),
      { params: Promise.resolve({ id: signedGuest.id }) },
    )
  ).json();
  assert.equal(sharedView.resumeWithAccount, false);

  assert.equal(claimed.editable, true);
  const context = { params: Promise.resolve({ id: claimed.id }) };
  assert.equal(
    (await (await read(req(undefined, guestToken), context)).json()).editable,
    false,
  );
  assert.equal(
    (await (await read(auth(undefined, 'bob', guestToken), context)).json())
      .editable,
    false,
  );
  const otherToken = 'another_browser_abcdefghijklmnopqrstuvwxyz123456';
  const resumed = await (
    await create(
      auth({ puzzleId: '20', ownerToken: otherToken }, 'alice', otherToken),
    )
  ).json();
  assert.equal(resumed.id, claimed.id);
  const unowned = await (
    await create(req({ puzzleId: '19', ownerToken: guestToken }, guestToken))
  ).json();
  const own19 = await (
    await create(
      auth({ puzzleId: '19', ownerToken: otherToken }, 'bob', otherToken),
    )
  ).json();
  assert.notEqual(unowned.id, own19.id);
  const result = [
    { rowFit: 100, colFit: 100, score: 90, accepted: true },
    { rowFit: 0, colFit: 100, score: 99, accepted: false },
  ];
  sql
    .prepare('UPDATE boards SET locked=1, attempts=? WHERE id=?')
    .run(JSON.stringify(result), claimed.id);
  const ranked = await (
    await leaders(new Request('https://chord.test/api/leaderboards?puzzle=20'))
  ).json();
  assert.deepEqual(ranked.entries, [
    {
      username: 'Alice',
      score: 90,
      completed: 1,
      boardId: claimed.id,
      rank: 1,
    },
  ]);
  const overall = await (
    await leaders(new Request('https://chord.test/api/leaderboards'))
  ).json();
  assert.equal(overall.entries.find((e) => e.username === 'Alice').score, 90);
  const me = await (await account(auth(undefined))).json();
  assert.deepEqual(me, { signedIn: true, username: 'Alice' });
});

sql.close();
await rm(temp, { recursive: true, force: true });
