CREATE TABLE `outbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_items_idempotency_key_idx` ON `outbox_items` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `outbox_items_status_next_attempt_idx` ON `outbox_items` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `outbox_items_created_at_idx` ON `outbox_items` (`created_at`);--> statement-breakpoint
CREATE TABLE `swipes` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`outbox_item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
