function toggleDirectScrapeMonitor(status) {
  var action = status === 1 ? "enable" : "disable";
  if (confirm("Are you sure you want to " + action + " the Direct Scrape Monitor?")) {
    $.ajax({
      type: "POST",
      url: "/filter/toggle_direct_scrape_monitor",
      data: { status: status },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Processing...");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
          setTimeout(function () {
            location.reload();
          }, 1000);
        } else {
          showErrorToast(data.message);
        }
      },
      error: function () {
        showErrorToast("Oops unable to connect with server!!");
      },
    });
  }
}
