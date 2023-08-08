export type Table<
  Fields = {},
  Populates = {},
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields
> = Pick<
  Omit<Fields, P> & Pick<Populates, P>,
  Extract<P | Exclude<keyof Fields, P>, F>
>;

export interface CommonFields {
  createdAt: Date;
  updatedAt: Date;
  detetedAt: Date;
}

export const COMMON_FIELDS = {
  createdAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onCreate: () => new Date(),
  },

  updatedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onUpdate: () => new Date(),
  },

  deletedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    hidden: 'byDefault',
    onRemove: () => new Date(),
  },
};

export const COMMON_SCOPES = {
  notDeleted: {
    deletedAt: { $exists: false },
  },
};

export const COMMON_DEFAULT_SCOPES = ['notDeleted'];
