CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`dob` text NOT NULL,
	`needs` text NOT NULL,
	`vaccine` text NOT NULL,
	`date` text NOT NULL,
	`dose` text NOT NULL,
	`provider` text NOT NULL,
	`description` text NOT NULL,
	`sku` text NOT NULL,
	`location` text NOT NULL,
	`cost` integer NOT NULL,
	`insurance` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_event` ON `records` (`workspace`,`patient_id`,`vaccine`,`date`,`dose`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`created` text NOT NULL,
	`report` text NOT NULL
);
