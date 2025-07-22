const httpMiddleware = require("../middleware/httpMiddleware");
module.exports.CreateUpdatePriceCron = async (listOfRequests) => {
  try {
    for (const _rq of listOfRequests) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const response = await httpMiddleware.updatePrice(_rq);
      console.log(`Price updated for product ${_rq.mpid} at  ${new Date()}`);
    }
  } catch (exception) {
    console.log(exception);
  }
};
