import type { Knex } from 'knex';
import { knexSnakeCaseMappers } from 'objection';

// Update with your config settings.

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DB_CONNECTION,
  migrations: {
    tableName: 'migrations',
    directory: './database/migrations',
  },
  ...knexSnakeCaseMappers(),
};

export default config;
module.exports = config;
