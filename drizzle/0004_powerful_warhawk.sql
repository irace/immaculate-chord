CREATE TABLE `catalog_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_rate` (
	`id` text PRIMARY KEY NOT NULL,
	`next_at` integer NOT NULL
);
