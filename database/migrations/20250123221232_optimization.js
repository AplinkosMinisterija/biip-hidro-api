/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema
    .alterTable('events', function (table) {
      table.index('time');
      table.index('hydroPowerPlantId');
      table.index(['time', 'hydroPowerPlantId']);
    })
    .createView('hydro_power_plant_statistics', (view) => {
      view.as(
        knex
          .select(
            'hpp.id',
            'hpp.hydrostatic_id',
            'hpp.name',
            'hpp.upper_basin_max',
            'hpp.upper_basin_min',
            'hpp.lower_basin_min',
            knex.raw(`
              (
                SELECT COUNT(*)
                FROM events e
                WHERE e.hydro_power_plant_id = hpp.id
                  AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
                  AND (
                    (e.upper_basin NOT BETWEEN hpp.upper_basin_min AND hpp.upper_basin_max)
                    OR e.lower_basin < hpp.lower_basin_min
                  )
              ) AS today
            `),
            knex.raw(`
              (
                SELECT COUNT(*)
                FROM events e
                WHERE e.hydro_power_plant_id = hpp.id
                  AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '1 week' AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
                  AND (
                    (e.upper_basin NOT BETWEEN hpp.upper_basin_min AND hpp.upper_basin_max)
                    OR e.lower_basin < hpp.lower_basin_min
                  )
              ) AS week
            `),
            knex.raw(`
              (
                SELECT COUNT(*)
                FROM events e
                WHERE e.hydro_power_plant_id = hpp.id
                  AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '1 month' AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
                  AND (
                    (e.upper_basin NOT BETWEEN hpp.upper_basin_min AND hpp.upper_basin_max)
                    OR e.lower_basin < hpp.lower_basin_min
                  )
              ) AS month
            `),
            knex.raw(`
              (
                SELECT e.upper_basin
                FROM events e
                WHERE e.hydro_power_plant_id = hpp.id
                ORDER BY e.id DESC
                LIMIT 1
              ) AS last_upper_basin
            `),
            knex.raw(`
              (
                SELECT e.lower_basin
                FROM events e
                WHERE e.hydro_power_plant_id = hpp.id
                ORDER BY e.id DESC
                LIMIT 1
              ) AS last_lower_basin
            `)
          )
          .from('hydro_power_plants as hpp')
          .leftJoin('events as e', 'hpp.id', 'e.hydro_power_plant_id')
          .groupBy(
            'hpp.id',
            'hpp.hydrostatic_id',
            'hpp.name',
            'hpp.upper_basin_max',
            'hpp.upper_basin_min',
            'hpp.lower_basin_min'
          )
          .orderBy('hpp.name')
      );
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema
    .alterTable('events', function (table) {
      table.dropIndex('time');
      table.dropIndex('hydroPowerPlantId');
      table.dropIndex(['time', 'hydroPowerPlantId']);
    })
    .dropViewIfExists('hydro_power_plant_statistics');
};
