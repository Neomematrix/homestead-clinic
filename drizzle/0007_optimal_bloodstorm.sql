CREATE TABLE `accuracy_expected` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`record_id` text NOT NULL,
	`original` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accuracy_workspace_event` ON `accuracy_expected` (`workspace`,`id`);--> statement-breakpoint
CREATE TABLE `accuracy_imports` (
	`workspace` text PRIMARY KEY NOT NULL
);
