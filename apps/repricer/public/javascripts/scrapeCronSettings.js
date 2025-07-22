function switchOffCron(cronId) {
  if (confirm("Are you sure you want to Switch Off the cron ?")) {
    $.ajax({
      type: "POST",
      url: "/scrape/toggle_cron_status",
      data: {
        id: cronId,
        status: 0,
      },
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
        alert("Oops unable to connect with server !!");
      },
    });
  }
}

function switchOnCron(cronId) {
  if (confirm("Are you sure you want to Switch On the cron ?")) {
    $.ajax({
      type: "POST",
      url: "/scrape/toggle_cron_status",
      data: {
        id: cronId,
        status: 1,
      },
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
        alert("Oops unable to connect with server!!");
      },
    });
  }
}

function edit() {
  $('[name="btnSave"]').removeClass("disabled");
  $('[name="btnSave"]').removeAttr("aria-disabled");
  $('[name="btnEdit"]').addClass("d-none");
  $('[name="btnCancel"]').removeClass("d-none");
  $('[name="proxy_provider_1"]').removeAttr("disabled");
  $('[name="proxy_provider_2"]').removeAttr("disabled");
  $('[name="proxy_provider_3"]').removeAttr("disabled");
  $('[name="proxy_provider_4"]').removeAttr("disabled");
  $('[name="proxy_provider_5"]').removeAttr("disabled");
  $('[name="proxy_provider_6"]').removeAttr("disabled");

  var cronTimeControls = $("input[name*='scr_cron_time']");
  removeAttributeDefined(cronTimeControls, "readonly");

  var offsetControls = $("input[name*='scr_offset']");
  removeAttributeDefined(offsetControls, "readonly");

  var cronNameControls = $("input[name*='scr_cron_name']");
  removeAttributeDefined(cronNameControls, "readonly");

  var cronTimeUnitControls = $("select[name*='scr_cron_time_unit']");
  removeAttributeDefined(cronTimeUnitControls, "disabled");

  var proxyProviderControls = $("select[name*='scr_proxy_provider']");
  removeAttributeDefined(proxyProviderControls, "disabled");
}

function removeAttributeDefined(controls, attributeName) {
  for (var i = 0; i < controls.length; i++) {
    controls[i].removeAttribute(attributeName);
  }
}

function cancel() {
  location.reload(true);
}

function saveScrapeCron() {
  let formData = $("#form_cron_scrape").serializeArray();
  if (confirm(`Are you sure you want to update the scrape crons ?`)) {
    $.ajax({
      type: "POST",
      url: "/scrape/update_scrape_cron",
      data: formData,
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data && data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong, Please try again");
      },
    });
  }
}
