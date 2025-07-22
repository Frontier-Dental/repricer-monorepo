import express from "express";
import { repriceProductToMax } from "./reprice_product_to_max";

export const searchController = express.Router();

searchController.post("/search/RepriceProductToMax/:id", repriceProductToMax);
