import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import filtersMixin from 'moleculer-knex-filters';
import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_FIELDS, COMMON_SCOPES } from '../types';
import { Event } from './events.service';

const qgisServerHost = process.env.QGIS_SERVER_HOST || 'https://gis.biip.lt';
const gisApiUrl = `${qgisServerHost}/qgisserver/uetk_public`;

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

export interface UETKHydro {
  properties: { kadastro_id: string; pavadinimas: string; he_galia: string };
  geometry: any;
}

export interface UETKHydrosResponse {
  features: UETKHydro[];
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

const setCommonParams = (param: URLSearchParams) => {
  param.append('SERVICE', 'WFS');
  param.append('REQUEST', 'GetFeature');
  param.append('TYPENAME', 'hidroelektrines');
  param.append('OUTPUTFORMAT', 'application/json');
  param.append('WITH_GEOMETRY', 'yes');
};

const getOneGisFullUrl = (id: string) => {
  const param = new URLSearchParams();
  setCommonParams(param);
  param.append('EXP_FILTER', `"kadastro_id"='${id}'`);
  return `${gisApiUrl}?${param}`;
};

const getAllGisFullUrl = (ids: string[]) => {
  const param = new URLSearchParams();
  setCommonParams(param);
  param.append('EXP_FILTER', `"kadastro_id" IN (${ids.toString()})`);
  return `${gisApiUrl}?${param}`;
};

const getHydroAdditionalInfo = (item: UETKHydro) => {
  if (!item) return {};

  const { properties, geometry } = item;
  const { pavadinimas, he_galia } = properties;

  const info = {
    name: pavadinimas,
    power: he_galia,
    geom: geometry,
  };

  return info;
};

const getUETKHydros = async (ids: string[]) => {
  const gisFullUrl = getAllGisFullUrl(ids);

  const UETKHydros: UETKHydrosResponse = await fetch(gisFullUrl).then((res) =>
    res.json()
  );

  const hydros = UETKHydros.features
    .filter((i) => i.properties.kadastro_id)
    .reduce(
      (acc: { [key: string]: string | any }, item) => ({
        ...acc,
        [item.properties.kadastro_id]: getHydroAdditionalInfo(item),
      }),
      {}
    );

  return hydros;
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
      apiId: {
        type: 'string',
        columnType: 'integer',
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

    const hydroIds = hydroPowerPlants.map(
      (hydro) => `'${hydro.hydrostaticId}'`
    );

    const hydrosFromUETK = await getUETKHydros(hydroIds);

    const mappedHydroPowerPlants = hydroPowerPlants.map((hydro) => {
      const UETKHydro = hydrosFromUETK?.[hydro.hydrostaticId];
      return {
        ...hydro,
        ...UETKHydro,
      };
    });

    const events: Event[] = await ctx.call('events.find', {
      query: {
        hydroPowerPlant: {
          $in: mappedHydroPowerPlants.map((hydro) => hydro.id),
        },
        time,
      },
      sort: 'time',
    });

    const hydroEventsMap = events.reduce(
      (acc: { [key: string]: Event[] }, event: Event) => {
        if (!acc[event.hydroPowerPlant]) {
          acc[event.hydroPowerPlant] = [];
        }
        acc[event.hydroPowerPlant].push(event);
        return acc;
      },
      {}
    );

    const hydrosWithEvents = mappedHydroPowerPlants.map((hydro) => {
      return {
        ...hydro,
        events: hydroEventsMap[hydro.id] || [],
      };
    });

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

    const gisFullUrl = getOneGisFullUrl(hydroPowerPlant.hydrostaticId);

    const UETKHydro: UETKHydrosResponse = await fetch(gisFullUrl).then((res) =>
      res.json()
    );

    return {
      ...hydroPowerPlant,
      ...getHydroAdditionalInfo(UETKHydro?.features?.[0]),
    };
  }

  @Action({
    rest: 'GET /table',
  })
  async getHydroPowerTable(
    ctx: Context<{ query: { dateFrom: string; dateTo: string } }>
  ) {
    const adapter = await this.getAdapter(ctx);
    const rawHydros: any = await adapter.client.raw(`
    SET TIME ZONE 'Europe/Vilnius';

      
      SELECT  
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
       AND ((e.upper_basin NOT BETWEEN hpp.upper_basin_min AND hpp.upper_basin_max)
       OR e.lower_basin < hpp.lower_basin_min)
    ) AS today,
    (
     SELECT COUNT(*)
     FROM events e
     WHERE e.hydro_power_plant_id = hpp.id
       AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '1 week' AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
       AND ((e.upper_basin NOT BETWEEN hpp.upper_basin_min AND hpp.upper_basin_max)
       OR e.lower_basin < hpp.lower_basin_min)
    ) AS week,
    (
     SELECT COUNT(*)
     FROM events e
     WHERE e.hydro_power_plant_id = hpp.id
       AND e.time BETWEEN DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '1 month' AND (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day' - INTERVAL '1 second')
       AND ((e.upper_basin NOT BETWEEN hpp.upper_basin_min AND hpp.upper_basin_max)
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

    const hydroIds = rawHydros?.[1]?.rows.map(
      (hydro: any) => `'${hydro.hydrostatic_id}'`
    );
    const hydrosFromUETK = await getUETKHydros(hydroIds);

    const mappedHydroPowerPlants = rawHydros?.[1]?.rows.map((hydro: any) => {
      const UETKHydro = hydrosFromUETK[hydro.hydrostatic_id];
      const {
        upper_basin,
        upper_basin_max,
        upper_basin_min,
        lower_basin,
        lower_basin_min,
        ...rest
      } = hydro;

      const { name } = UETKHydro;

      return {
        ...rest,
        upperBasin: upper_basin,
        upperBasinMin: upper_basin_min,
        lowerBasinMin: lower_basin_min,
        lowerBasin: lower_basin,
        upperBasinMax: upper_basin_max,
        name,
      };
    });

    return mappedHydroPowerPlants;
  }
}
