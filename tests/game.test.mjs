import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const temp = await mkdtemp(path.join(tmpdir(), 'chord-tests-'));
const files = {
  'lib/catalog/facts.ts': 'catalog-facts',
  'lib/catalog/musicbrainz.ts': 'catalog-provider',
  'lib/players.ts': 'players',
  'app/api/puzzles/[id]/community/route.ts': 'comparisons',
  'app/api/boards/[id]/clear/route.ts': 'clear',
  'app/api/account/route.ts': 'account',
  'app/api/leaderboards/route.ts': 'leaderboards',
  'app/api/boards/[id]/regrade/route.ts': 'regrade',
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
    .replace(/from ['"]\.\/http['"]/g, "from './catalog-http-stub.mjs'")
    .replace(/from ['"]@\/lib\/catalog['"]/g, "from './catalog-stub.mjs'")
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
export const sql=new DatabaseSync(':memory:');export const config={key:'test-only',model:'nvidia/nemotron-3-ultra-550b-a55b:free'};
export const getGradingConfig=()=>config;
export const getDb=()=>({prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);}}}}}});`,
);
await writeFile(
  `${temp}/catalog-stub.mjs`,
  `export const state={error:null}; export async function prepareCatalog(){if(state.error) throw new Error(state.error);return undefined;} export const validSelection=()=>false;`,
);
await writeFile(
  `${temp}/catalog-http-stub.mjs`,
  `export const responses=new Map();export const requests=[];export async function catalogJson(_provider,url){requests.push(url);const u=new URL(url);const key=u.pathname+(u.searchParams.has('release-group')?'?group='+u.searchParams.get('release-group'):'');if(!responses.has(key))throw new Error('Unexpected catalog request '+url);return responses.get(key);}`,
);
const { sql, config } = await import(`${temp}/db.mjs`);
sql.exec(await readFile('drizzle/0000_abnormal_guardsmen.sql', 'utf8'));
sql.exec(await readFile('drizzle/0001_outgoing_dormammu.sql', 'utf8'));
sql.exec(await readFile('drizzle/0002_sudden_firebrand.sql', 'utf8'));
sql.exec(await readFile('drizzle/0003_breezy_rick_jones.sql', 'utf8'));
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
            explanation:
              mode === 'catalog_claim'
                ? 'A deep cut from the 2007 album Ga Ga Ga Ga Ga.'
                : 'Test-only mocked musical judgment.',
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
  assert.equal(scoreAnswer(100, 100, 0), 60);
  assert.equal(scoreAnswer(100, 100, 50), 80);
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
await test('Ultra uses prompt JSON and validates fenced output', async () => {
  mode = 'fenced';
  const result = await grade(puzzles[0], 0, 'A song', 'An artist');
  assert.equal(result.score, 72);
  assert.equal(lastRequest.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
  assert.equal(lastRequest.provider.require_parameters, true);
  assert.equal(lastRequest.max_tokens, 4096);
  assert.equal(lastRequest.reasoning.enabled, false);
  assert.equal(lastRequest.response_format, undefined);
  assert.ok(lastRequest.messages[0].content.includes('additionalProperties'));
  mode = 'valid';
});
await test('Super retains enforced JSON grading', async () => {
  const previous = config.model;
  config.model = 'nvidia/nemotron-3-super-120b-a12b:free';
  try {
    mode = 'valid';
    await grade(puzzles[0], 0, 'A song', 'An artist');
    assert.equal(lastRequest.model, config.model);
    assert.equal(lastRequest.response_format.type, 'json_schema');
    assert.equal(lastRequest.response_format.json_schema.strict, true);
    assert.equal(lastRequest.reasoning.effort, 'low');
  } finally {
    config.model = previous;
  }
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
  assert.equal(state.answers[0].score, 60);
  assert.equal(state.guessesLeft, 7);
  assert.equal(state.answers.length, 1);
  assert.equal(state.attempts[1].accepted, false);
});

await test('accounts require identity, claim owned guests, isolate runs, and rank server scores', async () => {
  const { GET: account } = await import(`${temp}/account.mjs`);
  const { GET: leaders } = await import(`${temp}/leaderboards.mjs`);
  const auth = (body, id = 'alice', token = owner) => {
    const r = req(body, token);
    r.headers.set('oai-authenticated-user-id', id);
    r.headers.set('oai-authenticated-user-email', id + '@test.invalid');
    r.headers.set(
      'oai-authenticated-user-full-name',
      id === 'alice' ? 'Alice' : 'Bob',
    );
    return r;
  };
  assert.deepEqual(await (await account(req())).json(), {
    signedIn: false,
    username: null,
  });
  const first = await (await account(auth(undefined))).json();
  assert.equal(first.username, 'Alice');
  const sameName = auth(undefined, 'bob');
  sameName.headers.set('oai-authenticated-user-full-name', 'Alice');
  assert.equal((await (await account(sameName)).json()).username, 'Alice');
  const encoded = auth(undefined, 'unicode');
  encoded.headers.set(
    'oai-authenticated-user-full-name',
    encodeURIComponent('Zoë García'),
  );
  encoded.headers.set(
    'oai-authenticated-user-full-name-encoding',
    'percent-encoded-utf-8',
  );
  assert.equal((await (await account(encoded)).json()).username, 'Zoë García');
  encoded.headers.delete('oai-authenticated-user-full-name');
  assert.equal((await (await account(encoded)).json()).username, 'Listener');
  const direct = await (
    await create(auth({ puzzleId: '18', ownerToken: owner }, 'new_user'))
  ).json();
  assert.equal(direct.editable, true);
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
    { rowFit: 100, colFit: 100, obscurity: 50, score: 90, accepted: true },
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
      profileId: sql
        .prepare('SELECT public_id FROM users WHERE username=?')
        .get('Alice').public_id,
      score: 80,
      completed: 1,
      boardId: claimed.id,
      rank: 1,
    },
  ]);
  const overall = await (
    await leaders(new Request('https://chord.test/api/leaderboards'))
  ).json();
  assert.equal(overall.entries.find((e) => e.username === 'Alice').score, 80);
  const me = await (await account(auth(undefined))).json();
  assert.deepEqual(me, { signedIn: true, username: 'Alice' });
});

await test('re-grade refreshes the same guess once, preserves attempts and protects completed boards', async () => {
  const { POST: regrade } = await import(`${temp}/regrade.mjs`);
  sql.exec('DELETE FROM quotas');
  const b = await open('15');
  mode = 'wrong';
  let state = await (await post(b.id, 0, 'Regrade fixture')).json();
  const original = state.attempts[0];
  const context = { params: Promise.resolve({ id: b.id }) };
  const retry = (index = 0, token = owner) =>
    regrade(req({ attemptIndex: index }, token), context);
  assert.equal((await retry(0, 'unrelated')).status, 403);
  assert.equal((await retry(99)).status, 400);
  const cross = req({ attemptIndex: 0 });
  cross.headers.set('Origin', 'https://elsewhere.test');
  assert.equal((await regrade(cross, context)).status, 403);
  mode = 'malformed';
  assert.equal((await retry()).status, 503);
  state = await (await read(req(), context)).json();
  assert.deepEqual(state.attempts[0], original);
  mode = 'wait';
  const inFlight = retry();
  while (!release) await new Promise((r) => setTimeout(r, 1));
  assert.equal((await retry()).status, 409);
  assert.equal((await post(b.id, 1, 'Concurrent input')).status, 409);
  release();
  release = undefined;
  assert.equal((await inFlight).status, 200);
  state = await (await read(req(), context)).json();
  assert.equal(state.guessesUsed, 1);
  assert.equal(state.answers.length, 1);
  assert.equal(state.attempts[0].regraded, true);
  assert.equal(
    JSON.parse(lastRequest.messages[1].content).song.title,
    original.title,
  );
  assert.equal((await retry()).status, 409);
  // A finished board may correct its latest rejection, without gaining guesses.
  const finalBoard = await open('14');
  const misses = Array.from({ length: 9 }, (_, i) => ({
    ...original,
    cell: i,
    accepted: false,
  }));
  sql
    .prepare('UPDATE boards SET answers=?,attempts=?,locked=1 WHERE id=?')
    .run('[]', JSON.stringify(misses), finalBoard.id);
  mode = 'valid';
  const corrected = await regrade(req({ attemptIndex: 8 }), {
    params: Promise.resolve({ id: finalBoard.id }),
  });
  assert.equal(corrected.status, 200);
  state = await corrected.json();
  assert.equal(state.locked, true);
  assert.equal(state.guessesLeft, 0);
  assert.equal(state.guessesUsed, 9);
  assert.equal(state.answers.length, 1);
  mode = 'wrong';
  const stillWrong = await regrade(req({ attemptIndex: 7 }), {
    params: Promise.resolve({ id: finalBoard.id }),
  });
  assert.equal(stillWrong.status, 200);
  state = await stillWrong.json();
  assert.equal(state.attempts[7].accepted, false);
  assert.equal(state.attempts[7].regraded, true);
  assert.equal(state.guessesUsed, 9);
  assert.equal(
    (
      await regrade(req({ attemptIndex: 7 }), {
        params: Promise.resolve({ id: finalBoard.id }),
      })
    ).status,
    409,
  );
  mode = 'valid';
});

await test('local clear resets owned finished boards and rejects production, foreign origins and active grading', async () => {
  const { POST: clear } = await import(`${temp}/clear.mjs`);
  const previousEnv = process.env.NODE_ENV;
  const b = await (
    await create(
      req(
        {
          puzzleId: '01',
          ownerToken: 'clear_test_owner_abcdefghijklmnopqrstuvwxyz0123456789',
        },
        'clear_test_owner_abcdefghijklmnopqrstuvwxyz0123456789',
      ),
    )
  ).json();
  assert.ok(b.id);
  await post(
    b.id,
    0,
    'Reset fixture',
    'clear_test_owner_abcdefghijklmnopqrstuvwxyz0123456789',
  );
  const params = { params: Promise.resolve({ id: b.id }) };
  const local = (
    token = 'clear_test_owner_abcdefghijklmnopqrstuvwxyz0123456789',
    host = 'localhost',
    origin,
  ) =>
    new Request(`http://${host}/api/boards/${b.id}/clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(origin ? { Origin: origin } : {}),
      },
    });
  try {
    process.env.NODE_ENV = 'production';
    assert.equal((await clear(local(), params)).status, 404);
    process.env.NODE_ENV = 'development';
    assert.equal(
      (
        await clear(
          local(
            'clear_test_owner_abcdefghijklmnopqrstuvwxyz0123456789',
            'chord.irace.dev',
          ),
          params,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await clear(
          local(
            'clear_test_owner_abcdefghijklmnopqrstuvwxyz0123456789',
            'localhost',
            'https://evil.test',
          ),
          params,
        )
      ).status,
      403,
    );
    assert.equal((await clear(local('someone-else'), params)).status, 403);
    sql
      .prepare('UPDATE boards SET locked=1, lease_until=? WHERE id=?')
      .run(Date.now() + 10000, b.id);
    assert.equal((await clear(local(), params)).status, 409);
    sql.prepare('UPDATE boards SET lease_until=0 WHERE id=?').run(b.id);
    const response = await clear(local(), params);
    assert.equal(response.status, 200);
    const reset = await response.json();
    assert.equal(reset.id, b.id);
    assert.equal(reset.locked, false);
    assert.equal(reset.editable, true);
    assert.equal(reset.guessesLeft, 9);
    assert.deepEqual(reset.attempts, []);
    assert.deepEqual(reset.answers, []);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

await test('completed set list follows the viewer account or guest credential', async () => {
  const { GET: list } = await import(`${temp}/create.mjs`);
  const guestToken = 'completion_guest_abcdefghijklmnopqrstuvwxyz0123456789';
  const guest = await (
    await create(req({ puzzleId: '02', ownerToken: guestToken }, guestToken))
  ).json();
  assert.deepEqual(
    (await (await list(req(undefined, guestToken))).json()).completedPuzzleIds,
    [],
  );
  assert.deepEqual(
    (await (await list(req(undefined, guestToken))).json()).startedPuzzleIds,
    [],
  );
  sql.prepare('UPDATE boards SET attempts=? WHERE id=?').run(
    JSON.stringify([
      {
        cell: 0,
        title: 'Miss',
        artist: 'Test',
        rowFit: 0,
        colFit: 100,
        obscurity: 0,
      },
    ]),
    guest.id,
  );
  assert.deepEqual(
    (await (await list(req(undefined, guestToken))).json()).startedPuzzleIds,
    ['02'],
  );
  sql.prepare('UPDATE boards SET locked=1 WHERE id=?').run(guest.id);
  const mine = await (await list(req(undefined, guestToken))).json();
  assert.deepEqual(mine.startedPuzzleIds, []);
  assert.equal(mine.otherCompletionCounts['02'] || 0, 0);
  const outsider = await (
    await list(
      req(undefined, 'other_guest_abcdefghijklmnopqrstuvwxyz0123456789'),
    )
  ).json();
  assert.equal(outsider.otherCompletionCounts['02'], 1);
  assert.deepEqual(outsider.startedPuzzleIds, []);
  assert.deepEqual(
    (await (await list(req(undefined, guestToken))).json()).completedPuzzleIds,
    ['02'],
  );
  assert.deepEqual(
    (
      await (
        await list(
          req(undefined, 'other_guest_abcdefghijklmnopqrstuvwxyz0123456789'),
        )
      ).json()
    ).completedPuzzleIds,
    [],
  );
  const accountReq = req(
    { puzzleId: '03', ownerToken: guestToken },
    guestToken,
  );
  accountReq.headers.set('oai-authenticated-user-id', 'completion-user');
  accountReq.headers.set(
    'oai-authenticated-user-email',
    'completion@example.test',
  );
  const accountBoard = await (await create(accountReq)).json();
  sql.prepare('UPDATE boards SET locked=1 WHERE id=?').run(accountBoard.id);
  // The same browser credential must not mix guest results into account results.
  assert.deepEqual((await (await list(accountReq)).json()).completedPuzzleIds, [
    '03',
  ]);
  assert.deepEqual(
    (await (await list(req(undefined, guestToken))).json()).completedPuzzleIds,
    ['02'],
  );
  sql.prepare('UPDATE boards SET locked=0 WHERE id=?').run(accountBoard.id);
  assert.deepEqual(
    (await (await list(accountReq)).json()).completedPuzzleIds,
    [],
  );
});

await test('community lists paginate finished boards, scope picks, and omit private data', async () => {
  const { GET: comparisons } = await import(`${temp}/comparisons.mjs`);
  const fixture = {
    cell: 4,
    title: 'Public song',
    artist: 'Artist',
    canonicalKey: 'public',
    rowFit: 100,
    colFit: 100,
    obscurity: 50,
    score: 1,
    explanation: 'Both prompts match.',
    model: 'test',
    accepted: true,
  };
  sql
    .prepare('INSERT INTO users (id,username,username_key) VALUES (?,?,?)')
    .run('social-user', 'Social listener', 'social-key');
  for (let i = 0; i < 32; i++) {
    sql
      .prepare(
        'INSERT INTO boards (id,puzzle_id,owner_hash,answers,attempts,locked,created_at,account_id) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        (9000 + i).toString(16).padStart(32, '0'),
        '16',
        'PRIVATE',
        JSON.stringify([fixture]),
        JSON.stringify([fixture]),
        1,
        0,
        i === 0 ? 'social-user' : null,
      );
  }
  const unfinished = 'f'.repeat(32);
  sql
    .prepare(
      'INSERT INTO boards (id,puzzle_id,owner_hash,answers,attempts,locked,created_at) VALUES (?,?,?,?,?,?,?)',
    )
    .run(
      unfinished,
      '16',
      'SECRET',
      JSON.stringify([fixture]),
      JSON.stringify([fixture]),
      0,
      0,
    );
  const call = (query = '', id = '16') =>
    comparisons(
      new Request(`https://chord.test/api/puzzles/${id}/community?${query}`),
      { params: Promise.resolve({ id }) },
    );
  const page = await (await call()).json();
  assert.equal(page.entries.length, 30);
  assert.ok(page.next);
  assert.equal(page.entries[0].username, 'Social listener');
  assert.equal(page.entries[0].score, 80);
  assert.ok(!JSON.stringify(page).includes('PRIVATE'));
  assert.ok(!JSON.stringify(page).includes('account_id'));
  const last = await (await call(`after=${page.next}`)).json();
  assert.equal(last.entries.length, 2);
  assert.equal(last.next, null);
  assert.ok(!last.entries.some((e) => e.boardId === unfinished));
  const picks = await (
    await call(`cell=4&exclude=${page.entries[0].boardId}`)
  ).json();
  assert.equal(picks.entries[0].username, 'Guest');
  assert.equal(picks.entries[0].pick.score, 80);
  assert.equal(picks.entries[0].pick.explanation, fixture.explanation);
  assert.ok(!picks.entries.some((e) => e.boardId === page.entries[0].boardId));
  assert.deepEqual((await (await call('cell=0')).json()).entries, []);
  assert.equal((await call('cell=9')).status, 400);
  assert.equal((await call('after=bad')).status, 400);
  assert.equal((await call('', 'missing')).status, 404);
});

await test('public profiles have stable IDs, scoped finished grids and no private fields', async () => {
  const { getPlayerProfile } = await import(`${temp}/players.mjs`);
  const { profile, publicBoard, readBoard } = await import(
    `${temp}/server.mjs`
  );
  const r = req();
  r.headers.set('oai-authenticated-user-id', 'profile-test');
  r.headers.set('oai-authenticated-user-email', 'PRIVATE@example.test');
  r.headers.set('oai-authenticated-user-full-name', 'Profile Person');
  await profile(r);
  const publicId = sql
    .prepare('SELECT public_id FROM users WHERE id=?')
    .get('profile-test').public_id;
  assert.match(publicId, /^[a-f0-9]{32}$/);
  await profile(r);
  assert.equal(
    sql.prepare('SELECT public_id FROM users WHERE id=?').get('profile-test')
      .public_id,
    publicId,
  );
  for (let i = 0; i < 2; i++)
    sql
      .prepare(
        'INSERT INTO boards (id,puzzle_id,account_id,owner_hash,locked,created_at) VALUES (?,?,?,?,?,?)',
      )
      .run(
        String(800 + i).padStart(32, '0'),
        String(i + 1).padStart(2, '0'),
        'profile-test',
        'SECRET',
        i,
        0,
      );
  const p = await getPlayerProfile(publicId);
  assert.equal(p.username, 'Profile Person');
  assert.equal(p.boards.length, 1);
  assert.equal(p.boards[0].puzzleId, '02');
  assert.ok(!JSON.stringify(p).includes('SECRET'));
  assert.ok(!JSON.stringify(p).includes('PRIVATE'));
  const b = await publicBoard(
    req(),
    await readBoard(String(801).padStart(32, '0')),
  );
  assert.deepEqual(
    { ...b.player },
    {
      username: 'Profile Person',
      profileId: publicId,
    },
  );
  assert.equal(await getPlayerProfile('invalid'), null);
  assert.equal(await getPlayerProfile('a'.repeat(32)), null);
});

await test('shared daily quota allows request 500 and blocks submissions and regrades afterward', async () => {
  const { POST: regrade } = await import(`${temp}/regrade.mjs`);
  const token = 'quota_boundary_abcdefghijklmnopqrstuvwxyz0123456789';
  const b = await (
    await create(req({ puzzleId: '15', ownerToken: token }, token))
  ).json();
  mode = 'wrong';
  await post(b.id, 0, 'Quota rejected fixture', token);
  mode = 'valid';
  const quotaId = `grading:${new Date().toISOString().slice(0, 10)}`;
  sql.prepare('UPDATE quotas SET used=499 WHERE id=?').run(quotaId);
  assert.equal(
    (await post(b.id, 1, 'Quota final allowed fixture', token)).status,
    200,
  );
  assert.equal(
    sql.prepare('SELECT used FROM quotas WHERE id=?').get(quotaId).used,
    500,
  );
  const denied = await post(b.id, 2, 'Quota over limit fixture', token);
  assert.equal(denied.status, 429);
  assert.match(
    (await denied.json()).error,
    /keep costs down during this beta period/,
  );
  const retry = await regrade(req({ attemptIndex: 0 }, token), {
    params: Promise.resolve({ id: b.id }),
  });
  assert.equal(retry.status, 429);
  assert.match(
    (await retry.json()).error,
    /Please come back to play some more tomorrow/,
  );
  assert.equal(
    sql.prepare('SELECT used FROM quotas WHERE id=?').get(quotaId).used,
    500,
  );
  assert.equal(
    JSON.parse(
      sql.prepare('SELECT attempts FROM boards WHERE id=?').get(b.id).attempts,
    ).length,
    2,
  );
});

await test('catalog facts use recording dates, exact durations and any qualifying original album', async () => {
  const { verifyFact } = await import(`${temp}/catalog-facts.mjs`);
  const fact = (label) => ({ kind: 'fact', label, rule: label });
  const r = {
    provider: 'fixture',
    id: 'recording',
    title: 'EP song',
    artist: 'Artist',
    firstReleaseDate: '1999-12-01',
    durationMs: 180000,
    source: 'https://example.test/recording',
    albums: [
      {
        title: 'Later LP',
        date: '2001-01-01',
        position: 1,
        trackCount: 10,
        source: 'https://example.test/album',
      },
    ],
  };
  assert.equal(verifyFact(fact('Released in the 1990s'), r).fit, 100);
  assert.equal(verifyFact(fact('Released in the 2000s'), r).fit, 0);
  assert.equal(verifyFact(fact('Album opener'), r).fit, 100);
  assert.equal(verifyFact(fact('Under 3 minutes'), r).fit, 0);
  assert.equal(verifyFact(fact('3 to 5 minutes'), r).fit, 100);
  assert.equal(
    verifyFact(fact('Over 5 minutes'), { ...r, durationMs: 300001 }).fit,
    100,
  );
  assert.equal(
    verifyFact(fact('Over 6 minutes'), { ...r, durationMs: 360000 }).fit,
    0,
  );
  assert.throws(() => verifyFact(fact('Album closer'), r), /No guess was used/);
  assert.equal(
    verifyFact(fact('Album closer'), { ...r, albumCoverageComplete: true }).fit,
    0,
  );
  assert.throws(
    () =>
      verifyFact(fact('Released in the 1990s'), {
        ...r,
        firstReleaseDate: undefined,
      }),
    /No guess was used/,
  );
  assert.equal(verifyFact(fact('Includes piano'), r), undefined);
});
await test('catalog facts override model contradictions and preserve canonical identity', async () => {
  mode = 'valid';
  const recording = {
    provider: 'fixture',
    id: 'abc',
    title: 'Verified song',
    artist: 'Verified artist',
    albums: [],
    source: 'https://example.test/recording',
  };
  const result = await grade(puzzles[0], 0, 'Spoofed title', 'Spoofed artist', {
    recording,
    row: { fit: 0, explanation: 'Released in 1968.', source: recording.source },
  });
  assert.equal(result.rowFit, 0);
  assert.equal(result.title, 'Verified song');
  assert.equal(result.artist, 'Verified artist');
  assert.equal(result.catalog.id, 'abc');
  assert.match(result.explanation, /^Released in 1968\./);
  assert.equal(JSON.parse(lastRequest.messages[1].content).verifiedFits.row, 0);
  mode = 'catalog_claim';
  const protectedResult = await grade(puzzles[0], 0, 'Song', 'Artist', {
    recording,
    row: {
      fit: 100,
      explanation: 'Verified release date: 1975.',
      source: recording.source,
    },
  });
  assert.doesNotMatch(protectedResult.explanation, /Ga Ga|2007/);
  assert.match(protectedResult.explanation, /1975/);
  assert.match(protectedResult.explanation, /obscurity/);
  mode = 'valid';
});
await test('catalog uncertainty leaves attempts, quota and lease unchanged', async () => {
  const { state } = await import(`${temp}/catalog-stub.mjs`);
  const token = 'catalog_failure_abcdefghijklmnopqrstuvwxyz0123456789';
  const b = await (
    await create(req({ puzzleId: '16', ownerToken: token }, token))
  ).json();
  const before = sql
    .prepare('SELECT SUM(used) AS total FROM quotas')
    .get().total;
  const requestCount = calls;
  state.error =
    'Catalog data could not verify this recording. No guess was used.';
  try {
    const response = await post(b.id, 0, 'Unknown recording', token);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /No guess was used/);
    const row = sql.prepare('SELECT * FROM boards WHERE id=?').get(b.id);
    assert.equal(row.lease, null);
    assert.equal(row.answers, '[]');
    assert.equal(calls, requestCount);
    assert.equal(
      sql.prepare('SELECT SUM(used) AS total FROM quotas').get().total,
      before,
    );
  } finally {
    state.error = null;
  }
});

await test('catalog search scopes all terms to titles and ranks exact matches before unrelated artists', async () => {
  const { musicbrainz } = await import(`${temp}/catalog-provider.mjs`);
  const { responses, requests } = await import(`${temp}/catalog-http-stub.mjs`);
  const recording = (id, title, artist, date, score = 100) => ({
    id,
    title,
    'artist-credit': [{ name: artist }],
    'first-release-date': date,
    score,
  });
  responses.set('/ws/2/recording/', {
    recordings: [
      recording('unrelated', 'ROBOT', 'Stop', '1980'),
      recording('prefix', 'Robot Stopping', 'Other', '1970'),
      recording('actual', 'Robot Stop', 'King Gizzard', '2016', 80),
      recording('duplicate', 'Robot Stop', 'King Gizzard', '2022'),
    ],
  });
  const hits = await musicbrainz.search('Robot Stop');
  assert.equal(hits[0].id, 'actual');
  assert.deepEqual(
    hits.map((x) => x.id),
    ['actual', 'prefix'],
  );
  assert.equal(
    new URL(requests.at(-1)).searchParams.get('query'),
    'recording:"Robot" AND recording:Stop*',
  );
  responses.set('/ws/2/recording/', {
    recordings: [
      recording('song', 'Hey Jude', 'The Beatles', '1968'),
      recording('title', 'The Beatles', 'Daniel Johnston', '1983'),
    ],
  });
  assert.deepEqual(
    (await musicbrainz.search('The Beatles')).map((x) => x.id),
    ['title'],
  );
});

await test('MusicBrainz adapter excludes deluxe editions and combines original album discs', async () => {
  const { musicbrainz } = await import(`${temp}/catalog-provider.mjs`);
  const { responses } = await import(`${temp}/catalog-http-stub.mjs`);
  const id = '00000000-0000-0000-0000-000000000001';
  responses.set('/ws/2/recording/' + id, {
    id,
    title: 'Fixture',
    length: 123000,
    'first-release-date': '1999-01-01',
    'artist-credit': [{ name: 'Artist' }],
    releases: [
      {
        'release-group': { id: 'group', title: 'LP', 'primary-type': 'Album' },
      },
    ],
  });
  responses.set('/ws/2/release/?group=group', {
    'release-count': 2,
    releases: [
      {
        id: 'deluxe',
        title: 'LP',
        date: '2001-01-01',
        status: 'Official',
        disambiguation: 'deluxe bonus edition',
        media: [{ position: 1 }],
      },
      {
        id: 'standard',
        title: 'LP',
        date: '2001-01-02',
        status: 'Official',
        media: [{ position: 1 }, { position: 2 }],
      },
    ],
  });
  responses.set('/ws/2/release/standard', {
    title: 'LP',
    media: [
      {
        position: 2,
        'track-count': 1,
        tracks: [{ position: 1, title: 'Fixture', recording: { id } }],
      },
      {
        position: 1,
        'track-count': 1,
        tracks: [
          { position: 1, title: 'Opening', recording: { id: 'different' } },
        ],
      },
    ],
  });
  const result = await musicbrainz.resolve(id, { albums: true });
  assert.equal(result.firstReleaseDate, '1999-01-01');
  assert.equal(result.albums[0].position, 2);
  assert.equal(result.albums[0].trackCount, 2);
  assert.match(result.albums[0].source, /standard$/);
  responses.set('/ws/2/release/standard', {
    title: 'LP',
    media: [
      {
        position: 1,
        'track-count': 1,
        tracks: [
          { position: 1, title: 'Other song', recording: { id: 'different' } },
        ],
      },
    ],
  });
  assert.equal(
    (await musicbrainz.resolve(id, { albums: true })).albums.length,
    0,
  );
  assert.equal(
    (await musicbrainz.resolve(id, { albums: false })).durationMs,
    123000,
  );
});

sql.close();
await rm(temp, { recursive: true, force: true });
