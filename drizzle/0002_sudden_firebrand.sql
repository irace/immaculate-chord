CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_key_unique` ON `users` (`username_key`);--> statement-breakpoint
ALTER TABLE `boards` ADD `account_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `account_puzzle` ON `boards` (`account_id`,`puzzle_id`);