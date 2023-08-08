'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_FIELDS, COMMON_SCOPES } from '../types';
import { Hydro } from './hydroPowerPlants.service';
const Cron = require('@r2d2bzh/moleculer-cron');

const api = 'https://hidro.lt/api/elektrines/';

const MAX_RETRIES = 5;

export interface Event {
  id?: string;
  time: Date;
  hydroPowerPlant: any;
  upperBasin: number;
  lowerBasin: number;
  lowerBasinMin: number;
}

@Service({
  name: 'events',
  mixins: [
    DbConnection({
      collection: 'events',
    }),
    Cron,
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
  crons: [
    {
      name: 'setEvents',
      cronTime: '*/59 * * * *',
      async onTick() {
        return await this.call('events.setEvents');
      },
      timeZone: 'Europe/Vilnius',
    },
  ],

  settings: {
    fields: {
      id: {
        type: 'string',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },
      time: {
        type: 'date',
        columnType: 'datetime',
      },
      hydroPowerPlant: {
        type: 'number',
        columnType: 'integer',
        columnName: 'hydroPowerPlantId',
        populate: 'hydroPowerPlants.resolve',
      },
      upperBasin: {
        type: 'number',
        columnType: 'decimal',
        columnName: 'upperBasin',
      },

      lowerBasin: {
        type: 'number',
        columnType: 'decimal',
        columnName: 'lowerBasin',
      },

      ...COMMON_FIELDS,
    },

    scopes: {
      ...COMMON_SCOPES,
    },

    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
})
export default class eventsService extends moleculer.Service {
  @Action({
    timeout: 0,
  })
  async setEvents(ctx: Context) {
    const hydroPowerPlants: Hydro[] = await ctx.call('hydroPowerPlants.find', {
      query: {
        apiId: { $exists: true },
      },
    });

    await Promise.all(
      hydroPowerPlants.map(async (hydro) => {
        let retryCount = 0;
        let success = false;

        while (retryCount < MAX_RETRIES && !success) {
          try {
            const response = await fetch(`${api}${hydro.apiId}?format=json`);

            if (!response.ok) {
              throw new Error(`Fetch failed with status: ${response.status}`);
            }

            const event = (await response.json())?.['vandens_lygiai']?.[0];

            if (event?.['laikas']) {
              const existingEvent = await ctx.call('events.findOne', {
                query: {
                  hydroPowerPlant: { $eq: hydro.id },
                  time: { $eq: event?.['laikas'] },
                },
              });

              if (!existingEvent) {
                this.createEntity(ctx, {
                  hydroPowerPlant: hydro.id,
                  time: event['laikas'],
                  upperBasin: event['aukstutinis_vandens_lygis'],
                  lowerBasin: event['zemutinis_vandens_lygis'],
                });
              }
            }

            success = true;
          } catch (error) {
            console.error(`Fetch error (retry ${retryCount + 1}):`, error);
            retryCount++;
          }
        }
      })
    );

    return 'ok';
  }
}
