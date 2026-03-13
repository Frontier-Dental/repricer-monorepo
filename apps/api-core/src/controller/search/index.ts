import express from "express";
import { asyncHandler } from "../../utility/async-handler";
import { repriceProductToMax } from "./reprice-product-to-max";

export const searchController = express.Router();

searchController.post("/search/RepriceProductToMax/:id", asyncHandler(repriceProductToMax));
