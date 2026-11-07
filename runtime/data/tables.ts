import { validateDatasets } from '@reportstudio/mini-reports';
import type { Dataset } from '@reportstudio/mini-reports';

/** Definitions, fields and records: replace this array with your API payload. */
export const TABLES: Dataset[] = [
  {
    id: 'addresses',
    name: 'Addresses',
    data: [
      {
        addressType: 'From:',
        name: 'ACME Solutions LLC',
        street1: '205 Barfield Lane',
        street2: '',
        city: 'Mountain View',
        state: 'CA',
        zipcode: '94043',
        country: 'USA',
      },
      {
        addressType: 'To:',
        name: 'Joe Client',
        street1: '198 New Montgomery St. Ste. 201',
        street2: '',
        city: 'San Francisco',
        state: 'CA',
        zipcode: '94105',
        country: 'USA',
      },
    ],
    schema: {
      fields: [
        {
          name: 'addressType',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'street1',
          type: 'text',
        },
        {
          name: 'street2',
          type: 'text',
        },
        {
          name: 'city',
          type: 'text',
        },
        {
          name: 'state',
          type: 'text',
        },
        {
          name: 'zipcode',
          type: 'text',
        },
        {
          name: 'country',
          type: 'text',
        },
      ],
    },
  },
  {
    id: 'invoice',
    name: 'Details',
    data: [
      {
        category: 'Professional services',
        description: 'Software development',
        unitLabel: 'Hours',
        quantity: 12,
        unitPrice: 150,
      },
      {
        category: 'Expenses',
        description: 'Office coffee',
        unitLabel: 'Qty.',
        quantity: 4,
        unitPrice: 4.5,
      },
      {
        category: 'Expenses',
        description: 'New keyboard',
        unitLabel: 'Qty.',
        quantity: 1,
        unitPrice: 32.99,
      },
    ],
    schema: {
      fields: [
        {
          name: 'category',
          type: 'text',
        },
        {
          name: 'description',
          type: 'text',
        },
        {
          name: 'unitLabel',
          type: 'text',
        },
        {
          name: 'quantity',
          type: 'number',
        },
        {
          name: 'unitPrice',
          type: 'number',
        },
      ],
    },
  },
];

export const addressFields = TABLES.find((table) => table.id === 'addresses')!.schema.fields.map(
  (field) => field.name,
);
export const invoiceFields = TABLES.find((table) => table.id === 'invoice')!.schema.fields.map(
  (field) => field.name,
);
export function createInitialTables(): Dataset[] {
  return validateDatasets(TABLES);
}

/** Compatibility adapter for the original invoice's separate record arrays. */
export function invoiceDatasets(
  addressData: Dataset['data'],
  invoiceData: Dataset['data'],
): Dataset[] {
  return createInitialTables().map((table) => ({
    ...table,
    data: structuredClone(table.id === 'addresses' ? addressData : invoiceData),
  }));
}
