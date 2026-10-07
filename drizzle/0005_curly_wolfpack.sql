CREATE TABLE `patients` (
	`patient_id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`name` text NOT NULL,
	`dob` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_identity` ON `patients` (`workspace`,`name`,`dob`);