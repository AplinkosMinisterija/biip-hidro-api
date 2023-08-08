const commonFields = (table) => {
  table.timestamp('createdAt');
  table.timestamp('updatedAt');
  table.timestamp('deletedAt');
};

exports.commonFields = commonFields;

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema
    .createTableIfNotExists('hydroPowerPlants', (table) => {
      table.increments('id');
      table.string('name', 255);
      table.string('hydrostaticId', 255);
      table.double('upperBasinMax').nullable();
      table.double('upperBasinMin').nullable();
      table.double('lowerBasinMin').nullable();
      table.integer('apiId').nullable();
      commonFields(table);
    })
    .createTableIfNotExists('events', (table) => {
      table.increments('id');
      table.integer('hydroPowerPlantId').unsigned();
      table.timestamp('time');
      table.double('upperBasin').nullable();
      table.double('lowerBasin').nullable();
      commonFields(table);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('hydroPowerPlants').dropTable('events');
};
