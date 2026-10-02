CREATE TABLE `matches` (
	`owner_id` text NOT NULL,
	`game_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`ended_at` text NOT NULL,
	`record_json` text NOT NULL,
	PRIMARY KEY(`owner_id`, `game_id`)
);
