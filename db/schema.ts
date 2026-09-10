import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const boards = sqliteTable(
  'boards',
  {
    id: text('id').primaryKey(),
    puzzleId: text('puzzle_id').notNull(),
    accountId: text('account_id'),
    ownerHash: text('owner_hash').notNull(),
    answers: text('answers').notNull().default('[]'),
    attempts: text('attempts'),
    locked: integer('locked').notNull().default(0),
    lease: text('lease'),
    leaseUntil: integer('lease_until').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('account_puzzle').on(table.accountId, table.puzzleId),
  ],
);
export const grades = sqliteTable('grades', {
  id: text('id').primaryKey(),
  result: text('result').notNull(),
});
export const quotas = sqliteTable('quotas', {
  id: text('id').primaryKey(),
  used: integer('used').notNull().default(0),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  usernameKey: text('username_key').notNull().unique(),
});
