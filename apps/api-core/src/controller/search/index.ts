import express from "express";
import { repriceProductToMax } from "./reprice-product-to-max";

export const searchController = express.Router();

searchController.post("/search/RepriceProductToMax/:id", repriceProductToMax);
