function getCurrentProxyPriorities() {
  const table = document.getElementById("configSetUp");
  const tbody = table.getElementsByTagName("tbody")[0];
  const rows = tbody.getElementsByTagName("tr");
  const selectValues = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const select = row.querySelector(".proxyPriority");
    const selectId = select ? select.id : 0;
    const selectedValue = select ? select.value : 0;
    selectValues.push({
      id: selectId,
      value: selectedValue,
    });
  }
  return selectValues;
}

function changeProxyPriority(selectedProxy, selectedProxyValue) {
  if (selectedProxyValue == 0) {
    selectedProxy.value = selectedProxyValue;
  } else {
    let previousValue = document.getElementById(
      "proxyPriorityPreviousValue",
    ).value;
    document.getElementById(selectedProxy).value = previousValue;

    let currentProxyPriorities = getCurrentProxyPriorities();
    let currentProxyPrioritiesValues = currentProxyPriorities.map(
      (obj) => obj.value,
    );
    let currentProxyPrioritiesKeys = currentProxyPriorities.map(
      (obj) => obj.id,
    );

    let findIndex = currentProxyPrioritiesValues.indexOf(selectedProxyValue);
    if (findIndex != -1) {
      let findProxyId = currentProxyPrioritiesKeys[findIndex];
      document.getElementById(findProxyId).value = previousValue;
    }
    document.getElementById(selectedProxy).value = selectedProxyValue;
  }
}

function savePreviousProxyPriority(previousValue) {
  document.getElementById("proxyPriorityPreviousValue").value = previousValue;
}

function showSuccessToast(msg) {
  $.toast().reset("all");
  $.toast({
    text: msg,
    allowToastClose: true,
    hideAfter: 3000,
    showHideTransition: "fade",
    icon: "success",
    textAlign: "left",
    position: "top-right",
  });
}

function showLoadingToast(msg) {
  $.toast().reset("all");
  $.toast({
    text: msg,
    allowToastClose: true,
    hideAfter: 30000000,
    showHideTransition: "fade",
    icon: "info",
    textAlign: "left",
    position: "top-right",
  });
}

function showErrorToast(msg) {
  $.toast().reset("all");
  $.toast({
    text: msg,
    allowToastClose: true,
    hideAfter: 3000,
    showHideTransition: "fade",
    icon: "error",
    textAlign: "left",
    position: "top-right",
  });
}
function showSuccessToastWithCustomTimeout(msg, timeOut) {
  $.toast().reset("all");
  $.toast({
    text: msg,
    allowToastClose: true,
    hideAfter: timeOut,
    showHideTransition: "fade",
    icon: "success",
    textAlign: "left",
    position: "top-right",
  });
}

$(".minDatePicker").datepicker({
  dateFormat: "dd/mm/yy",
  changeYear: true,
  maxDate: 0,
  yearRange: "-100:+0",
});

$(".endDatePicker").datepicker({
  dateFormat: "dd/mm/yy",
  changeYear: true,
});

function updateAllPrice(index) {
  if (confirm("Are you sure you want to update all the prices in the list?")) {
    $.ajax({
      type: "GET",
      url: `/dashboard/update_all/${index}`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast('Success');
        setTimeout(function () {
          location.reload();
        }, 3000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  }
}

function updatePriceForProduct(mpid, index) {
  if (
    confirm(
      `Are you sure you want to update all the price for the product ${mpid} ?`,
    )
  ) {
    $.ajax({
      type: "GET",
      url: `/dashboard/update_price/${mpid}/${index}`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  }
}

function editAll() {
  $('[name="cron_time"]').removeAttr("readonly");
  $('[name="offset"]').removeAttr("readonly");
  $('[name="cron_name"]').removeAttr("readonly");
  $('[name="secret_key"]').removeAttr("readonly");
  $('[name="cron_time_unit"]').removeAttr("disabled");
  $('[name="btnSave"]').removeClass("disabled");
  $('[name="btnSave"]').removeAttr("aria-disabled");
  $('[name="btnEdit"]').addClass("d-none");
  $('[name="btnCancel"]').removeClass("d-none");
  $('[name="proxy_provider"]').removeAttr("disabled");
  $('[name="proxy_provider_422"]').removeAttr("disabled");
  $('[name="offset_422"]').removeAttr("readonly");
  $('[name="cron_time_422"]').removeAttr("readonly");
  $('[name="cron_time_unit_422"]').removeAttr("disabled");
  $('[name^="proxy_provider_"]').removeAttr("disabled");
  $('[name^="proxy_provider_422_alternate_"]').removeAttr("disabled");

  var fixedIpControls = $("input[name*='fixed_ip_']");
  for (var i = 0; i < fixedIpControls.length; i++) {
    fixedIpControls[i].removeAttribute("readonly");
  }
  var ipTypeControls = $("select[name*='ip_type_']");
  for (var i = 0; i < ipTypeControls.length; i++) {
    ipTypeControls[i].removeAttribute("disabled");
  }
}

function cancel() {
  // $('[name="cron_time"]').attr("readonly");
  // $('[name="offset"]').attr("readonly");
  // $('[name="cron_name"]').attr("readonly");
  // $('[name="secret_key"]').attr("readonly");
  // $('[name="cron_time_unit"]').attr("disabled");
  // $('[name="btnSave"]').addClass("disabled");
  // $('[name="btnSave"]').attr("aria-disabled");
  // $('[name="btnEdit"]').removeClass("d-none");
  // $('[name="btnCancel"]').addClass("d-none");
  location.reload(true);
}

function saveAll() {
  let formData = $("#form_cron_settings").serializeArray();
  const extraInfo = `. Please re-save the cron with correct values for the cron to restart`;
  if (confirm(`Are you sure you want to update the cron settings?`)) {
    $.ajax({
      type: "POST",
      url: "/cronSettings/update_cron_settings",
      data: formData,
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message + extraInfo);
        }
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function startAllCron() {
  if (confirm(`Are you sure you want to start all the cron ?`)) {
    $.ajax({
      type: "GET",
      url: `/masteritem/runAllCron`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data && data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast("data.message");
        }
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function stopAllCron(params) {
  if (confirm(`Are you sure you want to stop all the cron ?`)) {
    $.ajax({
      type: "GET",
      url: `/masteritem/stop_all_cron`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function switchOffCron(cronId) {
  if (confirm(`Are you sure you want to update the cron settings?`)) {
    $.ajax({
      type: "POST",
      url: "/cronSettings/toggle_cron_status",
      data: { CronId: cronId, Action: false },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        location.reload();
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function switchOnCron(cronId) {
  if (confirm(`Are you sure you want to update the cron settings?`)) {
    $.ajax({
      type: "POST",
      url: "/cronSettings/toggle_cron_status",
      data: { CronId: cronId, Action: true },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        location.reload();
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function selectionChanged(item) {
  if (item.value == "-1") {
    $('[name="criteria_date_time"]').addClass("d-none");
    $('[name="criteria_cron_name"]').addClass("d-none");
    $('[name="paramLbl"]').addClass("d-none");
    showErrorToast("Please select a criteria for purging logs.");
    return;
  } else if (item.value.toUpperCase() == "CRONNAME") {
    $('[name="paramLbl"]').removeClass("d-none");
    $('[name="criteria_cron_name"]').removeClass("d-none");
    $('[name="criteria_date_time"]').addClass("d-none");
  } else if (item.value.toUpperCase() == "TIMESTAMP") {
    $('[name="paramLbl"]').removeClass("d-none");
    $('[name="criteria_cron_name"]').addClass("d-none");
    $('[name="criteria_date_time"]').removeClass("d-none");
  }
}

function cancelPurge() {
  location.reload();
}

function submitPurge() {
  const cronScenario = $("#purge_criteria_ddl").val();
  if (cronScenario == "-1") {
    showErrorToast("Please select a criteria for purging logs.");
    return;
  } else if (cronScenario.toUpperCase() == "CRONNAME") {
    const cronId = $("#purge_cron_id").val();
    if (confirm(`Are you sure you want to purge all the logs for the cron?`)) {
      $.ajax({
        type: "POST",
        url: "/admin/purge_cron_id",
        data: { cronId: cronId },
        dataType: "json",
        cache: false,
        beforeSend: function () {
          showLoadingToast("Please Wait");
        },
        success: function (data) {
          showSuccessToast(data.message);
          location.reload();
        },
        error: function () {
          showErrorToast("Something went wrong. Please try again");
        },
      });
    } else {
      location.reload();
    }
  } else {
    const dateString = $("#startDate").val();
    if (
      confirm(
        `Are you sure you want to purge all logs before date : ${dateString}?`,
      )
    ) {
      $.ajax({
        type: "POST",
        url: "/admin/purge_cron_time",
        data: { date: dateString },
        dataType: "json",
        cache: false,
        beforeSend: function () {
          showLoadingToast("Please Wait");
        },
        success: function (data) {
          showSuccessToast(data.message);
          location.reload();
        },
        error: function () {
          showErrorToast("Something went wrong. Please try again");
        },
      });
    } else {
      location.reload();
    }
  }
}

function stop422Cron(cronName) {
  if (confirm(`Are you sure you want to stop the cron?`)) {
    $.ajax({
      type: "POST",
      url: "/cronSettings/toggle_cron_status",
      data: { CronName: cronName, Action: false },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        location.reload();
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function start422Cron(cronName) {
  if (confirm(`Are you sure you want to update the cron settings?`)) {
    $.ajax({
      type: "POST",
      url: "/cronSettings/toggle_cron_status",
      data: { CronName: cronName, Action: true },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        location.reload();
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function updateIpView(control, cronId) {
  const controlName = "[name=ip_type_" + cronId + "]";
  var proxyProviderValue = parseInt(control.value);
  if (proxyProviderValue == 1) {
    //$(controlName).removeAttr("disabled");
  } else {
    //$(controlName).attr("disabled", "disabled");
    $(controlName)[0].value = "1";
  }
}

function enableIp(control, cronId) {
  const controlName = "[name=fixed_ip_" + cronId + "]";
  var ipType = parseInt(control.value);
  if (ipType == 0) {
    //$(controlName).removeAttr("readonly");
  } else {
    // $(controlName).attr("readonly", "readonly");
    //$(controlName)[0].value = null;
  }
}

function saveConfiguration() {
  const element = document.getElementById("proxyPriorityPreviousValue");
  element.remove();
  let formData = $("#form_configuration_settings").serializeArray();
  if (confirm(`Are you sure you want to update the configuration settings?`)) {
    $.ajax({
      type: "POST",
      url: "/config/update",
      data: formData,
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        //location.reload();
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function enablePercentageData(control) {
  if (control.value == "ALL_PERCENTAGE") {
    $("[name=badgePercentage]").removeAttr("readonly");
  } else {
    $("[name=badgePercentage]").attr("readonly", "readonly");
  }
}

function radChanged(item) {
  if (item.value == "srchMpId") {
    $("#trMpId").removeClass("d-none");
    $("#trStartDate").removeClass("d-none");
    $("#trEndDate").removeClass("d-none");
    //$('#trCounter').addClass("d-none");
  } else if (item.value == "srchDate") {
    $("#trStartDate").removeClass("d-none");
    $("#trEndDate").removeClass("d-none");
    $("#trMpId").addClass("d-none");
    //$('#trCounter').removeClass("d-none");
  }
}

function exportHistory(maxCount) {
  const searchVal = $("input[name='searchVal']:checked").val();
  if (searchVal) {
    let param1,
      param2,
      param3 = null;
    let counterVal = 1;
    if (searchVal == "srchMpId") {
      param1 = $("#txtMpId").val();
      param2 = $("#dateFrom").val();
      param3 = $("#dateEnd").val();
    } else if (searchVal == "srchDate") {
      param1 = $("#dateFrom").val();
      param2 = $("#dateEnd").val();
      counterVal = $("#counterVal").val();
    }
    if (parseInt(counterVal) > parseInt(maxCount)) {
      alert(
        `Invalid Batch Number ${counterVal}. Allowed Values : 1 to ${maxCount}`,
      );
      return;
    }
    if (searchVal == "srchMpId") {
      // const url = "/history/exportHistory?searchBy=" + searchVal + "&param1=" + param1 + "&param2=" + param2 + "&param3=" + param3 + "&counter=" + counterVal;
      // window.open(url, '_blank');
      $.ajax({
        type: "POST",
        url: "/history/exportHistoryById",
        data: { param1: param1, param2: param2, param3: param3 },
        dataType: "json",
        cache: false,
        beforeSend: function () {
          showLoadingToast("Please Wait");
        },
        success: function (data) {
          showSuccessToast(data.message);
        },
        error: function () {
          showErrorToast("Something went wrong. Please try again");
        },
      });
    } else {
      $.ajax({
        type: "POST",
        url: "/history/get_all",
        data: { param1: param1, param2: param2 },
        dataType: "json",
        cache: false,
        beforeSend: function () {
          showLoadingToast("Please Wait");
        },
        success: function (data) {
          showSuccessToast(data.message);
        },
        error: function () {
          showErrorToast("Something went wrong. Please try again");
        },
      });
    }
  }
}

function saveEnvConfigurations() {
  const globalDelay = $("#txtGlobalDelay").val();
  const sourceType = $("#ddl_source_type_repricer").val();
  const overrideValue = $("#ddl_override_all_repricer").val();
  const executionPriorityOverride = $(
    "#ddl_override_exec_priority_repricer",
  ).val();
  const tradentPriority = $("#ddl_exec_priority_tradent").val();
  const frontierPriority = $("#ddl_exec_priority_frontier").val();
  const mvpPriority = $("#ddl_exec_priority_mvp").val();
  const topDentPriority = $("#ddl_exec_priority_top").val();
  const firstDentPriority = $("#ddl_exec_priority_fir").val();
  const triadPriority = $("#ddl_exec_priority_tri").val();
  const expressCronOverlapThreshold = $("#txtOverlapThreshold").val();
  const expressCronBatchSize = $("#txtCronBatchSize").val();
  const expressCronInstanceLimit = $("#txtExpressInstanceCount").val();
  const execPriorityObj = {
    override_priority: executionPriorityOverride,
    priority_settings: {
      tradent_priority: tradentPriority,
      frontier_priority: frontierPriority,
      mvp_priority: mvpPriority,
      firstDent_priority: firstDentPriority,
      topDent_priority: topDentPriority,
      triad_priority: triadPriority
    },
  };
  if (
    confirm(
      `Are you sure you want to update the  global configuration settings?`,
    )
  ) {
    $.ajax({
      type: "POST",
      url: "/config/envUpdate",
      data: {
        globalDelay: globalDelay,
        sourceType: sourceType,
        overrideValue: overrideValue,
        execPriorityObj: execPriorityObj,
        cronOverlapThreshold: expressCronOverlapThreshold,
        cronBatchSize: expressCronBatchSize,
        cronInstanceLimit: expressCronInstanceLimit,
      },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function purgeAllCache() {
  if (confirm(`Are you sure you want to purge the entire Cache?`)) {
    $.ajax({
      type: "GET",
      url: "/cache/flush_all_cache",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function deleteCacheItem() {
  const cacheKey = $("#purge_cache_key_ddl").val();
  if (
    confirm(
      `Are you sure you want to remove the Cache for the key : ${cacheKey}?`,
    )
  ) {
    $.ajax({
      type: "GET",
      url: `/cache/delete_cache_item/${cacheKey}`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast(data.message);
        setTimeout(function () {
          location.reload();
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    location.reload();
  }
}

function showCacheValue() {
  const cacheKey = $("#purge_cache_key_ddl").val();
  $.ajax({
    type: "GET",
    url: `/cache/get_cache_item/${cacheKey}`,
    cache: false,
    beforeSend: function () {
      //showLoadingToast("Please Wait");
    },
    success: function (data) {
      alert(
        `Cache Value for '${cacheKey}' : \n ${JSON.stringify(data.message)}`,
      );
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function show422Error(param) {
  window.open(`/cronSettings/show_details/${param}`, "_blank");
}

function searchDetails() {
  var input, filter, table, tr, td, i, txtValue;
  input = document.getElementById("myInput");
  filter = input.value.toUpperCase();
  table = document.getElementById("product_view");
  tr = table.getElementsByTagName("tr");

  // Loop through all table rows, and hide those who don't match the search query
  for (i = 0; i < tr.length; i++) {
    td = tr[i].getElementsByTagName("td")[0];
    if (td) {
      txtValue = td.textContent || td.innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        tr[i].style.display = "";
      } else {
        tr[i].style.display = "none";
      }
    }
  }
}

function pingIpAndTest() {
  var ipInput = $("#ip_test_txt").val();
  $("#pingResponseDiv").addClass("d-none");
  $("#response_tbl").html("");
  let listOfTest = ipInput.indexOf(";") > -1 ? ipInput.split(";") : [ipInput];
  $.ajax({
    type: "POST",
    url: "/help/check_ip_status_v2",
    data: { listOfIps: listOfTest },
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast("Ping is successful");
      togglePingResponse(data);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function pingIpAndTestAll() {
  var ipInput = $("#ip_all_hdn").val();
  $("#pingResponseDiv").addClass("d-none");
  $("#response_tbl").html("");
  let listOfTest = ipInput.indexOf(";") > -1 ? ipInput.split(";") : [ipInput];
  $.ajax({
    type: "POST",
    url: "/help/check_ip_status_v2",
    data: { listOfIps: listOfTest },
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast("Ping is successful");
      togglePingResponse(data);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function togglePingResponse(data) {
  $("#pingResponseDiv").removeClass("d-none");
  let str =
    '<thead><tr><th scope="col">#</th><th scope="col">Cron Name</th><th scope="col">IP</th><th scope="col">Port</th><th scope="col">Status</th><th scope="col">Ping Response</th></tr></thead><tbody>';
  if (data && data.healthInfo && data.healthInfo.length > 0) {
    let counter = 1;
    data.healthInfo.forEach((info) => {
      str += '<tr><th scope="row">' + counter + "</th><td>";
      str += info.cronName + "</td><td>";
      str += info.ip + "</td><td>";
      str += info.port + "</td><td>";
      if (info.ipStatus == "GREEN") {
        str +=
          '<button type="button" class="btn btn-success" style="width:100px">GREEN</button></td><td>';
      } else {
        str +=
          '<button type="button" class="btn btn-danger" style="width:100px">RED</button></td><td>';
      }
      str += info.pingResponse + "</td></tr>";
      counter++;
    });
  }
  str += "</tbody></table>";
  $("#response_tbl").html(str);
}

function cancelProductEdit() {
  location.reload();
}

function activateProductForAll(mpid) {
  $.ajax({
    type: "POST",
    url: "/productV2/activate_all",
    data: { mpid: mpid },
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(data.message);
      setTimeout(function () {
        location.reload();
      }, 5000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function deActivateProductForAll(mpid) {
  $.ajax({
    type: "POST",
    url: "/productV2/deactivate_all",
    data: { mpid: mpid },
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(data.message);
      setTimeout(function () {
        location.reload();
      }, 5000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function saveBranches(mpid) {
  function collectDetails(prefix) {
    const details = {};
    const fields = [
      {
        name: "activated",
        selector: `input[name=${prefix}_activated]`,
        type: "checkbox",
      },
      {
        name: "channelId",
        selector: `input[name=${prefix}_channel_Id]`,
        type: "text",
      },
      {
        name: "is_nc_needed",
        selector: `input[name=${prefix}_is_nc_needed]`,
        type: "checkbox",
      },
      {
        name: "badgeIndicator",
        selector: `select[name=${prefix}_badgeIndicator]`,
        type: "select",
      },
      {
        name: "repricingRule",
        selector: `select[name=${prefix}_reprice_rule_select]`,
        type: "select",
      },
      {
        name: "floorPrice",
        selector: `input[name=${prefix}_floor_price]`,
        type: "text",
      },
      {
        name: "maxPrice",
        selector: `input[name=${prefix}_max_price]`,
        type: "text",
      },
      {
        name: "unitPrice",
        selector: `input[name=${prefix}_unit_price]`,
        type: "text",
      },
    ];

    fields.forEach((field) => {
      const element = document.querySelector(field.selector);
      if (element) {
        const value =
          field.type === "checkbox" ? element.checked : element.value;
        if (value !== null && value !== "") {
          // Include only if not null or empty
          details[field.name] = value;
        }
      }
    });

    return Object.keys(details).length > 0 ? details : null; // Return null if no valid fields
  }

  const tradentDetails = collectDetails("tradent");
  const frontierDetails = collectDetails("frontier");
  const mvpDetails = collectDetails("mvp");
  const topDentDetails = collectDetails("topDent");
  const firstDentDetails = collectDetails("firstDent");
  const triadDetails = collectDetails('triad');

  // console.log('Tradent Details:', tradentDetails);
  // console.log('Frontier Details:', frontierDetails);
  // console.log('MVP Details:', mvpDetails);

  // Only send data if there are valid details
  const payload = {
    mpid,
    ...{ tradentDetails },
    ...{ frontierDetails },
    ...{ mvpDetails },
    ...{ topDentDetails },
    ...{ firstDentDetails },
    ...({ triadDetails }),
  };

  $.ajax({
    type: "POST",
    url: "/productV2/save_branches",
    data: payload,
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(data.message);
      setTimeout(function () {
        location.reload();
      }, 5000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function runSpecificCron() {
  const cronName = $("#cron_to_run_ddl").val().trim();
  $.ajax({
    type: "GET",
    url: `/admin/run_specific_cron/${cronName}`,
    cache: false,
    beforeSend: function () {
      //showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(`${cronName} executed successfully.`);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

if ($("#add_scrape_excel").length > 0) {
  $("#add_scrape_excel")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        input: {
          required: true,
        },
      },
      messages: {
        input: {
          required: "Please Choose Excel File.",
        },
      },
      submitHandler: function (form) {
        var oFile = document.getElementsByName("input")[0].files[0];
        var sFilename = oFile.name;
        var reader = new FileReader();
        reader.onload = function (e) {
          var data = e.target.result;
          data = new Uint8Array(data);
          var workbook = XLSX.read(data, { type: "array" });
          var result = {};
          workbook.SheetNames.forEach(function (sheetName) {
            var roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
              header: 1,
              defval: "",
            });
            if (roa.length) result[sheetName] = roa;
          });
          if (result) {
            if (!result.ScrapeList) {
              alert(
                `Please rename the sheet of the uploading Excel to 'ScrapeList' to import`,
              );
              return;
            }
            var payLoad = {};
            payLoad.temp = [];
            for (var i = 1; i < result.ScrapeList.length; i++) {
              if (result.ScrapeList[i].length > 0) {
                var tempIt = [];
                result.ScrapeList[i].forEach((x) => {
                  tempIt.push(x);
                });
              }
              payLoad.temp.push(tempIt);
            }
            $.ajax({
              type: "POST",
              method: "POST",
              url: "/scrape/add_excel",
              data: { data: payLoad.temp, count: payLoad.temp.length },
              dataType: "json",
              cache: false,
              beforeSend: function () {
                $(".addScrapeExcel").prop("disabled", true);
                $(".addScrapeExcel").html(
                  '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
                );
              },
              success: function (data) {
                $(".addItemExcel").html("Submit");
                $(".addItemExcel").prop("disabled", false);
                if (data.status == 1) {
                  showSuccessToast(data.message);
                  setTimeout(function () {
                    window.location.reload();
                  }, 1000);
                } else {
                  showErrorToast(data.message);
                }
              },
              error: function () {
                $(".addItemExcel").html("Submit");
                $(".addItemExcel").prop("disabled", false);
                showErrorToast("Something went wrong. Please try again");
              },
            });
          }
        };
        reader.readAsArrayBuffer(oFile);
      },
    });
}

if ($("#add_scrape_item").length > 0) {
  $("#add_scrape_item")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        net32_url: {
          required: false,
        },
        mpid: {
          required: true,
        },
      },
      messages: {
        net32_url: "Please enter Net 32 URL",
        mpid: "Please enter MPID",
      },
      submitHandler: function (form) {
        let formData = $("#add_scrape_item").serializeArray();
        const cronName = $("#add-cronname option:selected").data("cronname");
        formData.push({ name: "cronName", value: cronName });
        $.ajax({
          type: "POST",
          url: "/scrape/add_item",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
          },
          success: function (data) {
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                location.reload();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

if ($("#edit_scrape_item").length > 0) {
  $("#edit_scrape_item")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        net32_url: {
          required: true,
        },
        mpid: {
          required: true,
        },
      },
      messages: {
        net32_url: "Please enter Net 32 URL",
        mpid: "Please enter MPID",
      },
      submitHandler: function (form) {
        let formData = $("#edit_scrape_item").serializeArray();
        const cronName = $("#edit-cronname option:selected").data("cronname");
        formData.push({ name: "cronName", value: cronName });
        $.ajax({
          type: "POST",
          url: "/scrape/edit_item",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
          },
          success: function (data) {
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                location.reload();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

function deleteItem(id) {
  if (confirm("Are you sure you want to delete this ?")) {
    $.ajax({
      type: "POST",
      url: "/scrape/delete",
      data: { id: id },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Processing...");
      },
      success: function (data) {
        if (data.status == 1) {
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
function openEditModal(element) {
  const mpId = element.getAttribute("data-mpId");
  const active = element.getAttribute("data-active");
  const net32url = element.getAttribute("data-net32url");
  const cronname = element.getAttribute("data-cronname");
  const badgeItem = element.getAttribute("data-isBadge");

  const modal = document.getElementById("editModal");

  modal.querySelector("#edit-mpId").value = mpId;
  modal.querySelector("#edit-active").checked = active === "true";
  modal.querySelector("#edit-net32url").value = net32url;
  modal.querySelector("#edit-badge").checked = badgeItem === "true";

  const selectElement = modal.querySelector("#edit-cronname");
  selectElement.value = cronname;

  const options = selectElement.options;
  for (let i = 0; i < options.length; i++) {
    if (options[i].value === cronname) {
      options[i].selected = true;
      break;
    }
  }
  $("#editModal").modal("show");
}

function showScrapeData(element) {
  const rawData = element.getAttribute("data-vdata");
  const data = JSON.stringify(rawData);
  const vendor = JSON.parse(data);
  const modal = document.getElementById("showModal");

  modal.querySelector("#edit-data").textContent = JSON.parse(data);
  modal.querySelector("#edit-title").textContent = vendor.vendorName;

  $("#showModal").modal("show");
}

function editSlowCron() {}

function exportShowDetails(paramName) {
  window.open("/cronSettings/export_view/" + paramName, "_blank");
  // $.ajax({
  //     type: "POST",
  //     url: "/cronSettings/export_view/" + paramName,
  //     cache: false
  // });
}

function activateDataScrape(mpid) {
  $.ajax({
    type: "POST",
    url: "/productV2/toggle_data_scrape",
    data: { mpid: mpid, state: true },
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(data.message);
      setTimeout(function () {
        location.reload();
      }, 5000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function deActivateDataScrape(mpid) {
  $.ajax({
    type: "POST",
    url: "/productV2/toggle_data_scrape",
    data: { mpid: mpid, state: false },
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(data.message);
      setTimeout(function () {
        location.reload();
      }, 5000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function saveRootDetails(mpid) {
  function collectRootDetails() {
    const details = {};
    const fields = [
      { name: "net32Url", selector: `input[name=net32_url]`, type: "text" },
      { name: "cronGroup", selector: `select[name=cronGroup]`, type: "select" },
      {
        name: "scrapeOnlyCron",
        selector: `select[name=scrapeOnlyCron]`,
        type: "select",
      },
      {
        name: "isScrapeOnlyActivated",
        selector: `input[name=isScrapeOnlyActivated]`,
        type: "checkbox",
      },
      {
        name: "isBadgeItem",
        selector: `input[name=isBadgeItem]`,
        type: "checkbox",
      },
    ];
    fields.forEach((field) => {
      const element = document.querySelector(field.selector);
      if (element) {
        const value =
          field.type === "checkbox" ? element.checked : element.value;
        if (value !== null && value !== "") {
          // Include only if not null or empty
          details[field.name] = value;
        }
      }
    });

    return Object.keys(details).length > 0 ? details : null; // Return null if no valid fields
  }

  const rootDetailsForPayload = collectRootDetails();
  // Only send data if there are valid details
  const payload = {
    mpid,
    ...{ rootDetailsForPayload },
  };

  $.ajax({
    type: "POST",
    url: "/productV2/save_rootDetails",
    data: payload,
    dataType: "json",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      showSuccessToast(data.message);
      setTimeout(function () {
        location.reload();
      }, 5000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}


function simulateManualReprice() {
  const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
  const payLoadForManualUpdate = [];
  hiddenInputs.forEach((input) => {
    if (input.id == "mpIds") {
      payLoadForManualUpdate.push(input.value.trim());
    }
  });
  if (payLoadForManualUpdate.length > 0) {
    const firstMpId = payLoadForManualUpdate[0];
    $.ajax({
      type: "GET",
      url: `/productV2/simulateManualReprice/${firstMpId}`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (html) {
        // Create a new window/tab to display the HTML
        const newWindow = window.open('', '_blank');
        newWindow.document.write(html);
        newWindow.document.close();
        showSuccessToast("Simulation report opened in new window");
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    showErrorToast("No Product Selected for simulation...");
  }
}

function runManualScrape(isProductPage, isV2Algorithm) {
  const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
  const payLoadForManualUpdate = [];
  hiddenInputs.forEach((input) => {
    if (input.id == "mpIds") {
      payLoadForManualUpdate.push(input.value.trim());
    }
  });
  if (payLoadForManualUpdate.length > 0) {
    $.ajax({
      type: "POST",
      url: "/productV2/runManualCron",
      data: { mpIds: payLoadForManualUpdate},
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
        if (isProductPage == false) {
          setTimeout(function () {
            location.reload();
          }, 1000);
        } else {
          location.replace(
            `/productV2/show_all?tags=${payLoadForManualUpdate[0]}&search=true`,
          );
        }
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    showErrorToast("No Product Selected to be Scraped Manually...");
  }
}

function removeFrom422() {
  const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
  const payLoadForManualUpdate = [];
  hiddenInputs.forEach((input) => {
    if (input.id == "mpIds") {
      payLoadForManualUpdate.push(input.value.trim());
    }
  });
  if (payLoadForManualUpdate.length > 0) {
    $.ajax({
      type: "POST",
      url: "/productV2/removeFrom422",
      data: { mpIds: payLoadForManualUpdate },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
        setTimeout(function () {
          location.reload();
        }, 1000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    showErrorToast("No Product Selected to be Scraped Manually...");
  }
}

function removeFrom422ForAll() {
  $.ajax({
    type: "GET",
    url: "/productV2/removeFrom422ForAll",
    cache: false,
    beforeSend: function () {
      showLoadingToast("Please Wait");
    },
    success: function (data) {
      if (data.status == true) {
        showSuccessToast(data.message);
      } else {
        showErrorToast(data.message);
      }
      setTimeout(function () {
        location.reload();
      }, 1000);
    },
    error: function () {
      showErrorToast("Something went wrong. Please try again");
    },
  });
}

function runManualSyncForAll() {
  if (
    confirm(
      "Are you sure you want to sync all product data with that of Live ?",
    )
  ) {
    $.ajax({
      type: "GET",
      url: "/productV2/runManualSync",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToastWithCustomTimeout(data.message, 10000);
        } else {
          showErrorToast(data.message);
        }
        setTimeout(function () {
          location.reload();
        }, 10000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  }
}

function removeFrom422ById(mpId) {
  if (
    confirm("Are you sure you want to remove the product from the 422 Queue ?")
  ) {
    $.ajax({
      type: "POST",
      url: "/productV2/removeFrom422",
      data: { mpIds: [mpId] },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
        setTimeout(function () {
          location.reload();
        }, 1000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    showErrorToast("No Product Selected to be Scraped Manually...");
  }
}

function runUpdateToMax() {
  const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
  const payLoadForManualUpdate = [];
  hiddenInputs.forEach((input) => {
    if (input.id == "mpIds") {
      payLoadForManualUpdate.push(input.value.trim());
    }
  });
  if (payLoadForManualUpdate.length > 0) {
    $.ajax({
      type: "POST",
      url: "/productV2/updateAllToMax",
      data: { mpIds: payLoadForManualUpdate },
      dataType: "json",
      cache: false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
        location.replace(
          `/productV2/show_all?tags=${payLoadForManualUpdate[0]}&search=true`,
        );
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  } else {
    showErrorToast("No Product Selected to be Updated to Max...");
  }
}

function updateProductQuantity(mpid) {
  $('#quantityUpdateMpId').text(mpid);
  $('.vendor-checkbox').prop('checked', false);
  $('.vendor-quantity').val(0).prop('disabled', true);
  $('#updateQuantityModal').modal('show');
}

// Store original modal content
let originalModalContent = null;

// Restore modal to original state when closed
$('#updateQuantityModal').on('hidden.bs.modal', function () {
  // If we stored the results, restore the original content
  if (originalModalContent) {
      $('#updateQuantityModal .modal-dialog').html(originalModalContent);
      originalModalContent = null;
  }
});

// Enable/disable quantity input based on checkbox state
$(document).on('change', '.vendor-checkbox', function() {
  const vendorId = $(this).attr('id').replace('vendor', '');
  const quantityInput = $('#quantity' + vendorId);

  if ($(this).is(':checked')) {
      quantityInput.prop('disabled', false);
  } else {
      quantityInput.prop('disabled', true).val(0);
      quantityInput.removeClass('is-invalid');
  }
});

// Remove invalid class when user types in the input
$(document).on('input', '.vendor-quantity', function() {
  if ($(this).hasClass('is-invalid')) {
      const value = $(this).val();
      if (/^\d+$/.test(value)) {
          $(this).removeClass('is-invalid');
      }
  }
});

$(document).on('click', '#confirmQuantityUpdate', function() {
  const mpid = $('#quantityUpdateMpId').text();
  const vendorData = [];
  let hasInvalidInput = false;

  $('.vendor-checkbox:checked').each(function() {
      const vendorId = $(this).attr('id').replace('vendor', '');
      const quantityInput = $('#quantity' + vendorId);
      const quantity = quantityInput.val();
      const vendorName = $(this).val();

      // Validate that the input is a valid non-negative integer
      if (quantity === '' || !/^\d+$/.test(quantity)) {
          hasInvalidInput = true;
          quantityInput.addClass('is-invalid');
      } else {
          quantityInput.removeClass('is-invalid');
          vendorData.push({
              vendor: vendorName,
              quantity: parseInt(quantity)
          });
      }
  });

  if (hasInvalidInput) {
      showErrorToast("Please enter valid quantities (0 or positive integers only).");
      return;
  }

  if (vendorData.length === 0) {
      showErrorToast("Please select at least one vendor and enter a quantity.");
      return;
  }

  $.ajax({
      type: "POST",
      url: "/productV2/updateProductQuantity",
      data: { 
          mpid: mpid,
          vendorData: vendorData
      },
      dataType: "json",
      cache: false,
      beforeSend: function () {
          showLoadingToast("Updating quantities...");
      },
      success: function (data) {
          $.toast().reset('all');

          // Store original modal content before modifying
          if (!originalModalContent) {
              originalModalContent = $('#updateQuantityModal .modal-dialog').html();
          }

          const modalBody = $('#updateQuantityModal .modal-body');
          let resultsHtml = '';

          if (data.status == true && data.data && data.data.results) {
              resultsHtml += '<table class="table table-bordered">';
              resultsHtml += '<thead><tr><th>Vendor</th><th>Status</th><th>HTTP Code</th><th>Message</th></tr></thead>';
              resultsHtml += '<tbody>';

              data.data.results.forEach(result => {
                  const statusText = result.success ? 'Success' : 'Failed';
                  const errorMessage = result.data && result.data.message ? result.data.message : 
                                     (result.data && result.data.error ? result.data.error : '-');

                  resultsHtml += `<tr>`;
                  resultsHtml += `<td><strong>${result.vendor.toUpperCase()}</strong></td>`;
                  resultsHtml += `<td>${statusText}</td>`;
                  resultsHtml += `<td>${result.status}</td>`;
                  resultsHtml += `<td>${result.success && result.status === 404 ? errorMessage : (result.success ? 'Updated successfully' : errorMessage)}</td>`;
                  resultsHtml += `</tr>`;
              });

              resultsHtml += '</tbody></table>';

              modalBody.html(resultsHtml);

              // Change the footer buttons
              $('#updateQuantityModal .modal-footer').html(
                  '<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>'
              );
          } else {
              // Error case
              resultsHtml = '<div class="alert alert-danger">' + (data.message || 'An error occurred') + '</div>';
              modalBody.html(resultsHtml);

              setTimeout(function() {
                  $('#updateQuantityModal').modal('hide');
              }, 2000);
          }
      },
      error: function (xhr) {
          let errorMessage = "Something went wrong. Please try again";
          if (xhr.responseJSON && xhr.responseJSON.message) {
              errorMessage = xhr.responseJSON.message;
          }
          showErrorToast(errorMessage);
          $('#updateQuantityModal').modal('hide');
      }
  });
});