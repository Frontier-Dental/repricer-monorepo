# V2 Algorithm

This is the new implementation of the previous logic in a cleaner design.

## Board Rank

Board Rank is defined as how close the vendor is to the buy box position, from the perspective of that vendor. Why "perspective"? Because that particular vendor might be set to only compete with certain vendors. Rank 0 is the top position, usually meaning that vendor is winning the buy box (but may not be, in the case of a tie). Rank 1 is right after, and so on. If two vendors have the same price and shipping parameters, they have the same total price, and hence are given the same rank. Simple example:

```json
[
  {
    "vendorId": 5,
    "vendorName": "Carolina Dental Supply",
    "priceBreaks": [
      {
        "pmId": 0,
        "minQty": 1,
        "unitPrice": 150.43,
        "promoAddlDescr": null
      }
    ],
    "badgeId": 1
  },
  {
    "vendorId": 130,
    "vendorName": "PA Dental",
    "priceBreaks": [
      {
        "pmId": 0,
        "minQty": 1,
        "unitPrice": 150.42,
        "promoAddlDescr": null
      }
    ],
    "badgeId": 1
  }
]
```

Assuming both vendors have the same shipping, Carolina Dental Supply has a rank of 1, and PA Dental has a rank of 0 because 150.42 is less than 150.43

### Computing Board Rank

Price is not the only factor in computing the rank. There are two other variables that change the rules of the board which are badge and shipping time. Consider two vendors A and B. Here are the rules:

- If neither A nor B has a badge and shipping times are the same, A must be at least $0.01 cheaper to beat B. The same applies if both A and B have a badge.
- If neither A nor B has a badge and the cheaper vendor has slower shipping, the cheaper vendor has to be at least 0.5% cheaper than the other. The same applies if both A and B have a badge.
- If A has a badge and B doesn't, B has to be at least 10% cheaper to beat A

In the case of tie, it is unknown how net32 handles who wins the position. If one of our vendors is tied with another, we consider it to be a loss.

## Algo steps

The algorithm has several steps, executed sequentially, once per "own vendor" which is defined as a vendor we control. Example Tradent, MVP, Frontier, etc. A sister vendor from the perspective of an "own vendor" is defined as any other vendor we control. Frontier is a sister of Tradent, for example.

### Filter on competitors & quantities

We first filter the vendor's "view" of the board using several settings

1. Badge indicator - indicates which vendors to compete with. Either "ALL" or "only badge"
2. Compete with all vendors - if set, we compete with all vendors, including any sister vendor
3. Exclude vendor(s) - if set, we don't consider this vendor to be on the board
4. Inactive vendor ID - if set, we compete with these vendors even if their quantity is zero. By default, we don't compete with a vendor if their quantity is zero.
5. Handling time group - if set, we only compete with this handling time group or better. The groups are defined as follows:

```typescript
if (shippingTimeDays <= 2) return 1;
if (shippingTimeDays <= 5) return 2;
return 3;
```

This set to 2 for example means we only compete with vendors with 5 day shipping or faster.

6. Inventory competition threshold - if set, we only compete with vendors with this amount of inventory or higher.

Now that the board is filtered, we collect the unique and valid quantity breaks of competitors from the perspective of this vendor, excluding sisters. A quantity break will be considered if 

1. There is at least one competitor for this quantity break that has inventory greater or equal to the quantity break. Example if the competitor only has 3 in stock but has a quantity break on 4, then it is invalid. 
2. There is at least one competitor that has a LOWER quantity break with a strictly higher price. For example Q1 = 2, Q2 = 4 is invalid because Q1 price is lower. Q1 = 2, Q2 = 2 is also invalid because it is not strictly lower.

Now we have quantities, filter further

1. If Suppress Price Break is set, then we only compete on quantity 1
2. If Compete on Price Breaks Only is set, then we only compete on quantity > 1

### Compete theoretical best price for each quantity
Now we remove all of our vendors from the page and consider if we just had this vendor, what would be the best price to beat the most amount of competitors at the highest price, for each quantity, given our floor and max price. There are two details here:

1. If "NC / not cheapest" is set to true, then we ignore our shipping cost when computing the best unit price. It is called not cheapest because it produces a strictly higher price if it is set. For example if a competitor has a $10 total and we have $3 shipping, then without NC set, we would price at $6.99 as $6.99 + $3.00 = $9.99. If NC is set, then we price at $9.99 because we ignore our shipping cost
2. If "compare Q2 with Q1" is set, then for quantity 2 only, we use Q1 prices when finding the price to use

The resulting best price might not exist because it could not undercut any competitors as the floor was too low. 

If there are no competitors, then the theoretical best price is the max price. Then compute the board rank. 

### Discard or modify solutions
Now that we may have a best price and board rank for each quantity for the vendor, we filter and modify further

1. If the board rank is Infinity, i.e., it cannot beat any competitor, we discard the solution
2. If reprice direction (aka up_down) is set, that is a restriction on which direction the price can go. If the old price (if it exists), is $5 for example and the new proposed price is $5.50 then if reprice direction is "DOWN ONLY", it is discarded. "UP DOWN" allows for both directions
3. Up / Down % modifies the proposed price. If no existing price exists, then this setting does nothing. If it does, it forces the proposed price to go up or down a minimum defined by the setting. If up % pushes the price above the max, it is set to the max instead. If down % pushes below the floor, the setting is not applied.
4. Floor compete with next defines if effectively anything other than board rank === 0 is valid. If it is not set, then any solution with rank > 0 is discarded
5. If the price is the same as the previous price, discard
6. Now add the sisters back to the board. If any sister has a rank of 0, discard, as we know we are gaining nothing. If "sister vendor ID" setting is set, then consider those vendors as "artificial" sisters as well. Meaning if these vendors are in the buy box position, also discard the solution


### Further discard quantity breaks
Now we might have a new proposed price. Given this new proposed price, some of the quantity breaks might be no longer relevant. There are two basic ways to discard these "unnecessary" breaks

1. Similar to how we filtered on competitors for invalid quantity breaks, we can remove any quantity break for which a lower break exists with an equal or lower price.
2. We can remove a quantity break if there is a price on a lower quantity break that is already beating all competitors on this break. This might not be necessary and 1 might already accomplish this

### Apply changes
Now we might have changes for given quantity and vendor. We can only make one change every cron run, so we sort by execution priority for each vendor, and make changes on the vendor with the lowest (best) execution priority. 


