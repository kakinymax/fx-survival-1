CREATE TABLE `trips` (
	`owner_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`name` text NOT NULL,
	`started_at` text,
	`boundary_game_id` text,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`last_request_id` text NOT NULL,
	`last_request_json` text NOT NULL,
	PRIMARY KEY(`owner_id`, `trip_id`)
);
