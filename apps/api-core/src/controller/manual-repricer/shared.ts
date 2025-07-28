import OwnVendorProductDetails from "../../model/user-models/custom-product";
import { ProductDetailsListItem } from "../../utility/mysql/mySql-mapper";

export function getContextCronId(productDetails: any): string {
  if (productDetails.tradentDetails)
    return productDetails.tradentDetails.cronId;
  if (productDetails.frontierDetails)
    return productDetails.frontierDetails.cronId;
  if (productDetails.mvpDetails) return productDetails.mvpDetails.cronId;
  if (productDetails.topDentDetails)
    return productDetails.topDentDetails.cronId;
  if (productDetails.firstDentDetails)
    return productDetails.firstDentDetails.cronId;
  return "";
}

export function proceedNext(
  prod: ProductDetailsListItem,
  key: string,
): boolean {
  if (!(prod as any)[key]) {
    throw new Error(`${key} not found in product`);
  }
  return (
    ((prod as any)[key] as OwnVendorProductDetails).scrapeOn === true &&
    ((prod as any)[key] as OwnVendorProductDetails).skipReprice === false
  );
}
