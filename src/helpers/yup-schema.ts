import * as yup from "yup";

export const schemaInventory = yup.object().shape({
  name: yup.string().required(),
  price: yup.number().required(),
  supplier: yup.object().required(),
  category: yup.string().required(),
  current_stock: yup.number().required(),
});
