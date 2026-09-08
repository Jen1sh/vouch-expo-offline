CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shortlisted_profiles` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`outbox_item_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `catalog_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shortlisted_profiles_created_at_idx` ON `shortlisted_profiles` (`created_at`);