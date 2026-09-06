CREATE TABLE `profile_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`uri` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_photos_profile_id_idx` ON `profile_photos` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profile_preferences` (
	`profile_id` text NOT NULL,
	`preference` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `preference`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_preferences_profile_id_idx` ON `profile_preferences` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`date_of_birth` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`looking_for` text DEFAULT '' NOT NULL,
	`family_involved` text DEFAULT '' NOT NULL,
	`wali_contact` text DEFAULT '' NOT NULL,
	`family_relationship` text DEFAULT '' NOT NULL,
	`onboarding_step` integer DEFAULT 0 NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
