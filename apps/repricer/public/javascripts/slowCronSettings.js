function edit() {
  $('[name="btnSave"]').removeClass("disabled");
  $('[name="btnSave"]').removeAttr("aria-disabled");
  $('[name="btnEdit"]').addClass("d-none");
  $('[name="btnCancel"]').removeClass("d-none");
  $('[name^="proxy_provider_"]').removeAttr("disabled");

  var cronTimeControls = $("input[name*='s_cron_time_']");
  removeAttributeDefined(cronTimeControls, "readonly");

  var offsetControls = $("input[name*='s_offset_']");
  removeAttributeDefined(offsetControls, "readonly");

  var cronNameControls = $("input[name*='s_cron_name_']");
  removeAttributeDefined(cronNameControls, "readonly");

  var secretKeyControls = $("input[name*='s_secret_key_']");
  removeAttributeDefined(secretKeyControls, "readonly");

  var cronTimeUnitControls = $("select[name*='s_cron_time_unit_']");
  removeAttributeDefined(cronTimeUnitControls, "disabled");

  var proxyProviderControls = $("select[name*='s_proxy_provider_']");
  removeAttributeDefined(proxyProviderControls, "disabled");

  var ipTypeControls = $("select[name*='s_ip_type_']");
  removeAttributeDefined(ipTypeControls, "disabled");

  var fixedIpControls = $("input[name*='s_fixed_ip_']");
  removeAttributeDefined(fixedIpControls, "readonly");
}

function removeAttributeDefined(controls, attributeName) {
  for (var i = 0; i < controls.length; i++) {
    controls[i].removeAttribute(attributeName);
  }
}

function cancel() {
  location.reload(true);
}

function saveSlowCron() {
  let formData = $("#form_cron_filter").serializeArray();
  if (confirm(`Are you sure you want to update the slow crons ?`)) {
    $.ajax({
      type: "POST",
      url: "/filter/update_slow_cron",
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
