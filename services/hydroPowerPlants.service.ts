import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import filtersMixin from 'moleculer-knex-filters';
import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_FIELDS, COMMON_SCOPES } from '../types';
import { Event } from './events.service';

const qgisServerHost = process.env.QGIS_SERVER_HOST || 'https://gis.biip.lt';
const hydroApiUrl = `${qgisServerHost}/qgisserver/uetk_public?SERVICE=WFS&REQUEST=GetFeature&TYPENAME=hidroelektrines&OUTPUTFORMAT=application/json&WITH_GEOMETRY=yes&EXP_FILTER=%22kadastro_id%22`;
export interface Hydro {
  id?: string;
  hydrostaticId: string;
  name: string;
  power: string;
  apiId?: number;
  upperBasinMax: number;
  upperBasinMin: number;
  lowerBasinMin: number;
}

export interface UETKHydros {
  features: {
    properties: { kadastro_id: string; pavadinimas: string };
  }[];
}

export interface RawPHydroProps {
  id?: string;
  name: string;
  upper_basin_max: number;
  upper_basin_min: number;
  lower_basin_min: number;
  hydrostatic_id: string;
  events: Event[];
  upper_basin: number;
  lower_basin: number;
  today: number;
  week: number;
  month: number;
}
export interface Range {
  time: {
    $gte: string;
    $lt: string;
  };
}

const getUETKHydros = async (ids: any[]) => {
  const hydrosFromUETK: UETKHydros = await (
    await fetch(`${hydroApiUrl}%20IN%20(${ids.toString()})`)
  ).json();

  const hash: any = {};

  hydrosFromUETK.features.forEach((item) => {
    if (!item?.properties?.kadastro_id) return;

    hash[item?.properties?.kadastro_id] = item;
  });

  return hash;
};

@Service({
  name: 'hydroPowerPlants',

  mixins: [
    DbConnection({
      collection: 'hydroPowerPlants',
    }),
    filtersMixin(),
  ],
  actions: {
    remove: {
      rest: null,
    },
    update: {
      rest: null,
    },
    create: {
      rest: null,
    },
    replace: {
      rest: null,
    },
  },

  settings: {
    fields: {
      id: {
        type: 'string',
        primaryKey: true,
        secure: true,
      },

      hydrostaticId: {
        type: 'string',
        required: true,
      },

      name: {
        type: 'string',
        required: true,
      },

      apiId: {
        type: 'string',
        columnType: 'integer',
      },

      geom: {
        type: 'object',
        raw: true,
        required: false,
      },

      upperBasinMax: {
        type: 'string',
        columnType: 'integer',
      },

      upperBasinMin: {
        type: 'string',
        columnType: 'integer',
      },

      lowerBasinMin: {
        type: 'string',
        columnType: 'integer',
      },

      ...COMMON_FIELDS,
    },

    scopes: {
      ...COMMON_SCOPES,
    },

    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
})
export default class hydroPowerPlantsService extends moleculer.Service {
  @Action({
    rest: 'GET /map',
  })
  async getHydroPowerPlants(ctx: Context<{ query: Range }>) {
    const { time } = ctx.params.query;

    const hydroPowerPlants: Hydro[] = await ctx.call('hydroPowerPlants.find', {
      sort: 'name',
    });

    const hydrosFromUETK = await getUETKHydros(
      hydroPowerPlants.map((hydro) => `'${hydro.hydrostaticId}'`)
    );

    const mappedHydroPowerPlants = hydroPowerPlants.map((hydro) => {
      const hydroFromUETK = hydrosFromUETK?.[hydro.hydrostaticId];

      const { pavadinimas, he_galia } = hydroFromUETK?.properties || {};

      return {
        ...hydro,
        name: pavadinimas,
        power: he_galia,
        geom: hydroFromUETK?.geometry,
      };
    });

    const hydrosWithEvents = await Promise.all(
      mappedHydroPowerPlants.map(async (hydro) => {
        const events: Event[] = await ctx.call('events.find', {
          query: {
            hydroPowerPlant: {
              $eq: hydro.id,
            },
            time,
          },
          sort: 'time',
        });

        return { ...hydro, events };
      })
    );

    return hydrosWithEvents;
  }

  @Action({
    rest: 'GET uetk/:id',
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
  })
  async getHydroPowerPlant(ctx: Context<any>) {
    const hydroPowerPlant: Hydro = await ctx.call('hydroPowerPlants.findOne', {
      query: {
        id: {
          $eq: ctx?.params?.id,
        },
      },
    });

    const hydroFromUETK = (
      await getUETKHydros([`'${hydroPowerPlant.hydrostaticId}'`])
    )[hydroPowerPlant.hydrostaticId];

    const { pavadinimas, he_galia } = hydroFromUETK?.properties || {};

    return {
      ...hydroPowerPlant,
      name: pavadinimas,
      power: he_galia,
    };
  }

  @Action({
    rest: 'GET /table',
  })
  async getHydroPowerTable(
    ctx: Context<{ query: { dateFrom: string; dateTo: string } }>
  ) {
    const adapter = await this.getAdapter(ctx);
    const rawHydros: { rows: RawPHydroProps[] } = await adapter.client
      .raw(`SELECT  
    hpp.id,
    hpp.hydrostatic_id,
    hpp."name",
    hpp.upper_basin_max,
    hpp.upper_basin_min,
    hpp.lower_basin_min,
    (
     SELECT COUNT(*)
     FROM events e
     WHERE e.hydro_power_plant_id = hpp.id
       AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
       AND ((e.upper_basin > hpp.upper_basin_max OR e.upper_basin < hpp.lower_basin_min)
         OR e.lower_basin < hpp.lower_basin_min)
    ) AS today,
    (
     SELECT COUNT(*)
     FROM events e
     WHERE e.hydro_power_plant_id = hpp.id
       AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '1 week' AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
       AND ((e.upper_basin > hpp.upper_basin_max OR e.upper_basin < hpp.lower_basin_min)
         OR e.lower_basin < hpp.lower_basin_min)
    ) AS week,
    (
     SELECT COUNT(*)
     FROM events e
     WHERE e.hydro_power_plant_id = hpp.id
       AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '1 month' AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
       AND ((e.upper_basin > hpp.upper_basin_max OR e.upper_basin < hpp.lower_basin_min)
         OR e.lower_basin < hpp.lower_basin_min)
    ) AS month,
    (
  SELECT e.upper_basin 
  FROM events e 
  WHERE e.hydro_power_plant_id = hpp.id
  ORDER BY id DESC 
  limit 1
 ),
  (
  SELECT e.lower_basin 
  FROM events e 
  WHERE e.hydro_power_plant_id = hpp.id
  ORDER BY id DESC 
  limit 1
    )
   FROM hydro_power_plants hpp
   LEFT JOIN events e ON hpp.id = e.hydro_power_plant_id
   GROUP BY hpp.id, hpp."name", hpp.upper_basin_max, hpp.upper_basin_min, hpp.lower_basin_min
   ORDER BY name;
     `);

    const hydrosFromUETK = await getUETKHydros(
      rawHydros.rows.map((hydro) => `'${hydro.hydrostatic_id}'`)
    );

    const mappedHydroPowerPlants = rawHydros.rows.map((hydro) => {
      const hydroFromUETK = hydrosFromUETK[hydro.hydrostatic_id];
      const {
        upper_basin,
        upper_basin_max,
        upper_basin_min,
        lower_basin,
        lower_basin_min,
        ...rest
      } = hydro;

      const { pavadinimas } = hydroFromUETK.properties || {};

      return {
        ...rest,
        upperBasin: upper_basin,
        upperBasinMin: upper_basin_min,
        lowerBasinMin: lower_basin_min,
        lowerBasin: lower_basin,
        upperBasinMax: upper_basin_max,
        name: pavadinimas,
      };
    });

    return mappedHydroPowerPlants;
  }
}
