CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_read_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `catalog_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matches_profile_id_idx` ON `matches` (`profile_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`outbox_item_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_match_id_created_at_idx` ON `messages` (`match_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_match_id_status_idx` ON `messages` (`match_id`,`status`);