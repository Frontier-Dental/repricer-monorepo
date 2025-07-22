let menuicon = document.querySelector(".menuicn");
let page = document.querySelector(".page");
let nav = document.querySelector(".left_sidebar");

if (menuicon) {
  menuicon.addEventListener("click", () => {
    nav.classList.toggle("navclose");
    page.classList.toggle("page-toggle");
  });
}

function updateThresholdForProvider(providerId) {
  var ctrlSelector = `threshold_count_${providerId}`;
  var thresholdValue = $(`[name=${ctrlSelector}]`).val();
  if (thresholdValue) {
    if (
      confirm(
        "Are you sure you want to update the Failure Count Threshold for the Proxy Provider?",
      )
    ) {
      $.ajax({
        type: "POST",
        url: "/admin/update_threshold_value",
        data: {
          proxyProvider: providerId,
          value: thresholdValue,
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
  } else {
    alert(`Threshold Value Cannot be empty!`);
  }
}

function resetProxyProvider(providerId) {
  if (
    confirm(
      "Are you sure you want to Reset the Failure Count for the Proxy Provider?",
    )
  ) {
    $.ajax({
      type: "GET",
      url: `/admin/reset_proxy_provider/${providerId}`,
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

function getFilterCronLogs() {
  const noOfLogs = $("#txtFilterLogCount").val();
  $.ajax({
    type: "GET",
    url: "/dashboard/get_filter_logs/" + noOfLogs,
    cache: false,
    beforeSend: function () {
      showLoadingToast(`Getting ${noOfLogs} Filter Cron Logs. Please wait...`);
    },
    success: function (data) {
      if (data.status == true) {
        showSuccessToast("Filter Cron Logs fetched successfully.");
        recreateFilterCronTable(data.cronLogs);
      } else {
        showErrorToast(data.message);
      }
    },
    error: function () {
      alert("Oops unable to connect with server!!");
    },
  });
}

function recreateFilterCronTable(cronLogs) {
  let str =
    '<table id="example" class="table table-striped table-bordered" style="width: 100%"><thead><th class="t-head">Start Time</th><th class="t-head">End Time</th><th class="t-head">Cron Name</th><th class="t-head">Cron Run Id</th><th class="t-head">Filter Date</th><th class="t-head">No. Of Products</th><th class="t-head">Action</th></thead><tbody>';
  for (let logs of cronLogs) {
    str += "<tr>";
    str += `<td>${logs.startTime}</td>`;
    str += `<td>${logs.endTime}</td>`;
    str += `<td>${logs.cronName}</td>`;
    str += `<td>${logs._id}</td>`;
    str += `<td>${logs.filterDate}</td>`;
    str += ` <td>${logs.countOfProducts}</td>`;
    str += `<td><a href="/filter/export_log/${logs.cronKey}">Export</a></td>`;
    str += "</tr>";
  }
  str += "</tbody></table>";
  $("#filterCronLogs").html("");
  $("#filterCronLogs").html(str);
}

$("#btnSearchCronHistory").click(function () {
  const fp = {
    cronId: $("#cHcronId").val(),
    cronType: $("#cHcronType").val(),
    pageSize: $("#cHpageSize").val(),
    startDate: $("#cHstartDate").val(),
    endDate: $("#cHendDate").val(),
    totalRecords: $("#cHTotalRecords").val(),
    pgNo: 1,
  };
  const CURL =
    window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname;
  const params =
    "?cronId=" +
    fp.cronId +
    "&cronType=" +
    fp.cronType +
    "&pageSize=" +
    fp.pageSize +
    "&pgno=" +
    fp.pgNo +
    "&fromDate=" +
    fp.startDate +
    "&toDate=" +
    fp.endDate +
    "&totalRecords=" +
    fp.totalRecords;
  window.location.href = CURL + params; // Replace with your desired URL
});

function recreateLogsTable(logList) {
  $("#cronHistoryTable").html("");
  let str =
    '<table id="example" class="table table-striped table-bordered" style="width: 100%"><thead><tr><th class="t-head">Date Time</th><th class="t-head">Cron Completion Time</th><th class="t-head">Cron </th><th class="t-head">Object Id</th><th class="t-head">Active Items</th><th class="t-head">Eligible Count</th><th class="t-head">Scraped-Success</th><th class="t-head">Scraped-Failed</th><th class="t-head">Repriced-Success</th><th class="t-head">Repriced-422</th><th class="t-head">Repriced-Other Errors</th><th class="t-head">Cron Type</th><th class="t-head">Action</th></tr></thead><tbody id="tbodyCronLogsHistory">';
  if (logList && logList.length > 0) {
    for (let item of logList) {
      str += "<tr>";
      str += `<td>${item.logTime}</td>`;
      str += `<td>${item.completionTime}</td>`;
      str += `<td>${item.cronName}</td>`;
      str += `<td>${item.logData._id}-${item.keyRef}</td>`;
      str += `<td>${item.totalActiveCount}</td>`;
      str += `<td>${item.productCount}</td>`;
      str += `<td>${item.successScrapeCount}</td>`;
      str += `<td>${item.failureScrapeCount}</td>`;
      str += `<td>${item.repricedProductCount}</td>`;
      str += `<td>${item.repriceFailure422Count}</td>`;
      str += `<td>${item.repriceFailureOtherCount}</td>`;
      if (item.logData.type) {
        str += `<td><span class="badge badge-warning">${item.logData.type}</span></td>`;
      } else {
        str += `<td><span class="badge badge-success">Regular</span></td>`;
      }
      str += `<td><a href="/dashboard/get_logs_details/${item.logData._id}" target="_blank"><i class="ti-arrow-circle-right"></i></a></td>`;
      str += "</tr>";
    }
  }
  str += "</tbody></table>";
  $("#cronHistoryTable").html(str);
}
