export enum RepriceMessagesV2 {
  NOT_WINNING_AND_OUT_OF_STOCK = "We are not winning the buy box but we are out of stock",
  REPRICED_DOWN_TO_BEAT_COMPETITOR = "We are not winning the buy box but we've repriced to beat the cheapest competitor.",
  FLOOR_REACHED_REPRICING_DOWN_TO_BEAT_COMPETITOR = "We are not winning the buy box and we tried to beat the cheapest competitor but we hit the floor.",
  REPRICED_DOWN_TO_WIN_BUY_BOX = "We were not winning the buy box but we've repriced to win it.",
  IGNORE_SISTER_OR_US_ALREADY_CHEAPEST = "We are not winning the buy box, but we have a sister or us already the cheapest, so we can't do anything",
  QUANTITY_BREAK_REMOVED_THERE_WERE_NO_COMPETITORS = "We were winning the buy box but we removed the quantity break because there were no competitors.",
  REPRICED_TO_MAX_THERE_WERE_NO_COMPETITORS = "We were winning the buy box but we repriced to the max price because there were no competitors.",
  IGNORE_ALREADY_MAXED_NO_COMPETITORS = "We were winning the buy box but we are already at the max price and there were no competitors.",
  REPRICED_UP_TO_UNDERCUT_COMPETITOR = "We were winning the buy box but we repriced to undercut the next most expensive competitor.",
  IGNORE_ALREADY_MAXED_WITH_COMPETITORS = "We were winning the buy box but we are already at the max price and there were competitors. We could not adjust higher. ",
  IGNORE_SISTER_ALREADY_WINNING_BUY_BOX = "We have a sister winning the buy box, so we can't do anything",
}
