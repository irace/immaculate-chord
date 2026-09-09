CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`puzzle_id` text NOT NULL,
	`owner_hash` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotas` (
	`id` text PRIMARY KEY NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
