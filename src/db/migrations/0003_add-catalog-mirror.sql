CREATE TABLE `catalog_profile_interests` (
	`profile_id` text NOT NULL,
	`tag` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `tag`),
	FOREIGN KEY (`profile_id`) REFERENCES `catalog_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `catalog_profile_interests_profile_id_idx` ON `catalog_profile_interests` (`profile_id`);--> statement-breakpoint
CREATE TABLE `catalog_profile_photos` (
	`profile_id` text NOT NULL,
	`uri` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `uri`),
	FOREIGN KEY (`profile_id`) REFERENCES `catalog_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `catalog_profile_photos_profile_id_idx` ON `catalog_profile_photos` (`profile_id`);--> statement-breakpoint
CREATE TABLE `catalog_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`age` integer NOT NULL,
	`city` text NOT NULL,
	`distance_km` integer NOT NULL,
	`verified` integer NOT NULL,
	`occupation` text NOT NULL,
	`bio` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_profiles_age_idx` ON `catalog_profiles` (`age`);--> statement-breakpoint
CREATE INDEX `catalog_profiles_distance_km_idx` ON `catalog_profiles` (`distance_km`);--> statement-breakpoint
CREATE INDEX `catalog_profiles_verified_idx` ON `catalog_profiles` (`verified`);