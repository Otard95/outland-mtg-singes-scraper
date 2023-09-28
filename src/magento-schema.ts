import { object, string, arrayOf, float, boolean } from 'checkeasy';

import { objectValues } from './validators/objectValues';
import { unknown } from './validators/unknown';

export const optionValidator = object({
  id: string(),
  label: string(),
  products: arrayOf(string()),
});

const priceDetailsValidator = object({
  amount: float(),
});

const productPricesValidator = object({
  baseOldPrice: priceDetailsValidator,
  oldPrice: priceDetailsValidator,
  basePrice: priceDetailsValidator,
  finalPrice: priceDetailsValidator,
  tierPrices: arrayOf(unknown()), // assuming tierPrices is an array of objects; you can extend this
  msrpPrice: priceDetailsValidator,
});

export const magentoAttributeSchema = object({
  id: string(),
  code: string(),
  label: string(),
  options: arrayOf(optionValidator),
  position: string(),
});

export const magentoSpConfigSchema = object({
  attributes: objectValues(magentoAttributeSchema),
  template: string(),
  currencyFormat: string(),
  optionPrices: objectValues(productPricesValidator),
  priceFormat: unknown(),
  prices: object({
    baseOldPrice: priceDetailsValidator,
    oldPrice: priceDetailsValidator,
    basePrice: priceDetailsValidator,
    finalPrice: priceDetailsValidator,
  }),
  productId: string(),
  chooseText: string(),
  images: arrayOf(unknown()), // assuming images is an array of objects; you can extend this
  index: objectValues(objectValues(string()), string()),
  salable: objectValues(objectValues(arrayOf(string()))),
  canDisplayShowOutOfStockStatus: boolean(),
  magictoolbox: object({
    useOriginalGallery: boolean(),
    galleryData: objectValues(string()),
    standaloneMode: boolean(),
    overrideUseAjaxOption: boolean(),
  }),
  channel: string(),
  salesChannelCode: string(),
  sku: objectValues(string()),
});

export const magentoInitJSONSchema = object(
  {
    '#product_addtocart_form': object(
      {
        configurable: object(
          {
            spConfig: magentoSpConfigSchema,
          },
          { ignoreUnknown: true }
        ),
      },
      { ignoreUnknown: true }
    ),
  },
  { ignoreUnknown: true }
);
