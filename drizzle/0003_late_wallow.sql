CREATE TABLE `api_rate_limits` (
	`owner_id` text NOT NULL,
	`scope` text NOT NULL,
	`window_start` integer NOT NULL,
	`requests` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `scope`)
);
