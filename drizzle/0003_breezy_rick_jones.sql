ALTER TABLE `users` ADD `public_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);
--> statement-breakpoint
UPDATE users SET public_id = lower(hex(randomblob(16))) WHERE public_id IS NULL;
