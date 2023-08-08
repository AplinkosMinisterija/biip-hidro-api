import pick from 'lodash/pick';
import moleculer, { Context, Errors } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import ApiGateway from 'moleculer-web';
import { RequestMessage } from '../types';

export interface UserAuthMeta {
  user: any;
  app: any;
  authToken: string;
  authUser: any;
}

@Service({
  name: 'api',
  mixins: [ApiGateway],
  // More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
  // TODO: helmet
  settings: {
    port: process.env.PORT || 3000,
    path: '/hidro',

    routes: [
      {
        path: '/api',
        whitelist: [
          // Access to any actions in all services under "/api" URL
          '**',
        ],

        // Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
        use: [],

        // Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
        mergeParams: true,

        // Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
        authentication: false,

        // Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
        authorization: false,

        // The auto-alias feature allows you to declare your route alias directly in your services.
        // The gateway will dynamically build the full routes from service schema.
        autoAliases: true,

        /**
			* Before call hook. You can check the request.
			* @param {Context} ctx
			* @param {Object} route
			* @param {IncomingMessage} req
			* @param {ServerResponse} res
			* @param {Object} data
			onBeforeCall(ctx: Context<any,{userAgent: string}>,
			route: object, req: IncomingMessage, res: ServerResponse) {
			Set request headers to context meta
			ctx.meta.userAgent = req.headers["user-agent"];
			},
		*/

        /**
			* After call hook. You can modify the data.
			* @param {Context} ctx
			* @param {Object} route
			* @param {IncomingMessage} req
			* @param {ServerResponse} res
			* @param {Object} data
			*
			onAfterCall(ctx: Context, route: object, req: IncomingMessage, res: ServerResponse, data: object) {
			// Async function which return with Promise
			return doSomething(ctx, res, data);
			},
		*/

        // Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
        callingOptions: {},

        bodyParsers: {
          json: {
            strict: false,
            limit: '1MB',
          },
          urlencoded: {
            extended: true,
            limit: '1MB',
          },
        },

        aliases: {
          'GET /ping': 'api.ping',
        },

        // Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
        mappingPolicy: 'all', // Available values: "all", "restrict"

        // Enable/disable logging
        logging: true,
      },
    ],
    // Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
    log4XXResponses: false,
    // Logging the request parameters. Set to any log level to enable it. E.g. "info"
    logRequestParams: null,
    // Logging the response data. Set to any log level to enable it. E.g. "info"
    logResponseData: null,
    // Serve assets from "public" folder
    assets: {
      folder: 'public',
      // Options to `server-static` module
      options: {},
    },
  },
})
export default class ApiService extends moleculer.Service {
  /**
		* Authenticate the request. It checks the `Authorization` token value in the request header.
		* Check the token value & resolve the user by the token.
		* The resolved user will be available in `ctx.meta.user`
		*
		* PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		*
		* @param {Context} ctx
		* @param {any} route
		* @param {IncomingMessage} req
		* @returns {Promise}

	async authenticate (ctx: Context, route: any, req: IncomingMessage): Promise < any >  => {
		// Read the token from header
		const auth = req.headers.authorization;

		if (auth && auth.startsWith("Bearer")) {
			const token = auth.slice(7);

			// Check the token. Tip: call a service which verify the token. E.g. `accounts.resolveToken`
			if (token === "123456") {
				// Returns the resolved user. It will be set to the `ctx.meta.user`
				return {
					id: 1,
					name: "John Doe",
				};

			} else {
				// Invalid token
				throw new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_INVALID_TOKEN, {
					error: "Invalid Token",
				});
			}

		} else {
			// No token. Throw an error or do nothing if anonymous access is allowed.
			// Throw new E.UnAuthorizedError(E.ERR_NO_TOKEN);
			return null;
		}
	},
		*/
  /**
		* Authorize the request. Check that the authenticated user has right to access the resource.
		*
		* PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		*
		* @param {Context} ctx
		* @param {Object} route
		* @param {IncomingMessage} req
		* @returns {Promise}

	async authorize (ctx: Context < any, {
		user: string;
	} > , route: Record<string, undefined>, req: IncomingMessage): Promise < any > => {
		// Get the authenticated user.
		const user = ctx.meta.user;

		// It check the `auth` property in action schema.
		// @ts-ignore
		if (req.$action.auth === "required" && !user) {
			throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS", {
				error: "Unauthorized",
			});
		}
	},
		*/
  @Method
  async rejectAuth(
    ctx: Context<Record<string, unknown>, UserAuthMeta>,
    error: Errors.MoleculerError
  ): Promise<unknown> {
    if (ctx.meta.user) {
      const context = pick(
        ctx,
        'nodeID',
        'id',
        'event',
        'eventName',
        'eventType',
        'eventGroups',
        'parentID',
        'requestID',
        'caller',
        'params',
        'meta',
        'locals'
      );
      const action = pick(ctx.action, 'rawName', 'name', 'params', 'rest');
      const logInfo = {
        action: 'AUTH_FAILURE',
        details: {
          error,
          context,
          action,
          meta: ctx.meta,
        },
      };
      this.logger.error(logInfo);
    }
    return Promise.reject(error);
  }

  @Method
  async authenticate(
    ctx: Context<Record<string, unknown>, UserAuthMeta>,
    route: any,
    req: RequestMessage
  ): Promise<unknown> {
    const auth = req.headers.authorization;

    if (auth) {
      const type = auth.split(' ')[0];
      let token: string | undefined;
      if (type === 'Token' || type === 'Bearer') {
        token = auth.split(' ')[1];
      }

      if (token) {
        try {
          let authUser, user, app;

          const cacheKey = `authenticate:${token}`;
          const cached = await this.broker.cacher.get(cacheKey);
          if (cached) {
            authUser = cached.authUser;
            user = cached.user;
            app = cached.app;
          }

          if (!authUser || !user || !app) {
            authUser = await ctx.call('auth.users.resolveToken', null, {
              meta: { authToken: token },
            });

            user = await ctx.call(
              'users.findOrCreate',
              { authUser: authUser },
              { meta: { authToken: token } }
            );
            app = await ctx.call('auth.apps.resolveToken');

            this.broker.cacher.set(cacheKey, { authUser, user, app }, 60 * 30);
          }

          if (user && user.id) {
            ctx.meta.authUser = authUser;
            ctx.meta.authToken = token;
            ctx.meta.app = app;

            return Promise.resolve(user);
          }
        } catch (e) {
          return this.rejectAuth(
            ctx,
            new ApiGateway.Errors.UnAuthorizedError(
              ApiGateway.Errors.ERR_INVALID_TOKEN,
              null
            )
          );
        }
      }

      return this.rejectAuth(
        ctx,
        new ApiGateway.Errors.UnAuthorizedError(
          ApiGateway.Errors.ERR_INVALID_TOKEN,
          null
        )
      );
    }
    return this.rejectAuth(
      ctx,
      new ApiGateway.Errors.UnAuthorizedError(
        ApiGateway.Errors.ERR_NO_TOKEN,
        null
      )
    );
  }

  /**
   * Authorize the request.
   *
   * @param {Context} ctx
   * @param {any} route
   * @param {RequestMessage} req
   * @returns {Promise}
   */
  @Method
  async authorize(
    ctx: Context<Record<string, unknown>, UserAuthMeta>,
    route: any,
    req: RequestMessage
  ): Promise<unknown> {
    const user = ctx.meta.user;

    if (req.$action.auth === false) {
      return Promise.resolve(null);
    }

    if (!user) {
      return this.rejectAuth(
        ctx,
        new ApiGateway.Errors.UnAuthorizedError(
          ApiGateway.Errors.ERR_NO_TOKEN,
          null
        )
      );
    }

    // const atypes = Array.isArray(req.$action.types)
    //   ? req.$action.types
    //   : [req.$action.types];
    // const otypes = Array.isArray(req.$route.opts.types)
    //   ? req.$route.opts.types
    //   : [req.$route.opts.types];

    // const alltypes = [...atypes, ...otypes].filter(Boolean);
    // const types = [...new Set(alltypes)];
    // const valid = await ctx.call<boolean, { types: UserType[] }>(
    //   'users.validateType',
    //   { types }
    // );

    // if (!valid) {
    //   return this.rejectAuth(
    //     ctx,
    //     new ApiGateway.Errors.UnAuthorizedError(
    //       ApiGateway.Errors.ERR_INVALID_TOKEN,
    //       null
    //     )
    //   );
    // }

    return Promise.resolve(ctx);
  }

  @Action()
  ping() {
    return {
      timestamp: Date.now(),
    };
  }
}
