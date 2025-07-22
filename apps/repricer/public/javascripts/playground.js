//use strict
function scrape_details() {
  var mpidIdentifier = `play_product`;
  $("#play_scrape_request").val("");
  $("#play_scrape_result").val("");
  $("#timeTknSpn").text("");
  $("#responseSizeSpn").text("");
  var selectedProduct = $(`[name=${mpidIdentifier}]`).val();
  var selectedProxyProvider = $(`[name=play_proxy_provider]`).val();
  if (selectedProduct && selectedProxyProvider) {
    $.ajax({
      type: "GET",
      url: `/play/scrape_data/${selectedProduct}/${selectedProxyProvider}`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Processing...");
      },
      success: function (response) {
        showSuccessToast(`Success while fetching the data`);
        $("#play_scrape_request").val(
          JSON.stringify(response.scrapeResult.request, undefined, 4),
        );
        $("#play_scrape_result").val(
          JSON.stringify(response.scrapeResult.data, undefined, 4),
        );
        $("#timeTknSpn").text(response.timeSpent);
        $("#responseSizeSpn").text(response.dataSize);
      },
      error: function () {
        alert("Oops unable to connect with server!!");
      },
    });
  }
}
