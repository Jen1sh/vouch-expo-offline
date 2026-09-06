CREATE TABLE `verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`issued_at` integer NOT NULL
);
