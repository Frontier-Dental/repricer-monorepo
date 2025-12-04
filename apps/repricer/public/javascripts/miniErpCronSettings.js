function editMiniErpCron() {
  $('[name="btnSaveMiniErp"]').removeClass("disabled");
  $('[name="btnSaveMiniErp"]').removeAttr("aria-disabled");
  $('[name="btnEditMiniErp"]').addClass("d-none");
  $('[name="btnCancelMiniErp"]').removeClass("d-none");

  var cronTimeControls = $("input[name*='me_cron_time_']");
  removeAttributeDefined(cronTimeControls, "readonly");

  var offsetControls = $("input[name*='me_offset_']");
  removeAttributeDefined(offsetControls, "readonly");

  var cronNameControls = $("input[name*='me_cron_name_']");
  removeAttributeDefined(cronNameControls, "readonly");

  var cronTimeUnitControls = $("select[name*='me_cron_time_unit_']");
  removeAttributeDefined(cronTimeUnitControls, "disabled");
}

function removeAttributeDefined(controls, attributeName) {
  for (var i = 0; i < controls.length; i++) {
    controls[i].removeAttribute(attributeName);
  }
}

function cancelMiniErpCron() {
  location.reload(true);
}

function saveMiniErpCron() {
  let formData = $("#form_cron_filter").serializeArray();
  if (confirm(`Are you sure you want to update the Mini ERP crons ?`)) {
    $.ajax({
      type: "POST",
      url: "/mini-erp/update_mini_erp_cron",
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

function switchOffMiniErpCron(cronId) {
  if (confirm("Are you sure you want to Switch Off the cron ?")) {
    $.ajax({
      type: "POST",
      url: "/mini-erp/toggle_cron_status",
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
        showErrorToast("Oops unable to connect with server !!");
      },
    });
  }
}

function switchOnMiniErpCron(cronId) {
  if (confirm("Are you sure you want to Switch On the cron ?")) {
    $.ajax({
      type: "POST",
      url: "/mini-erp/toggle_cron_status",
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
        showErrorToast("Oops unable to connect with server!!");
      },
    });
  }
}

