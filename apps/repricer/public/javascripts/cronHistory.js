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
    fp.pgNo;
  window.location.href = CURL + params; // Replace with your desired URL

  // getCronHistory(4);
});

function getCronHistory(pageNumber) {
  const fp = {
    cronId: $("#cHcronId").val(),
    cronType: $("#cHcronType").val(),
    pageSize: $("#cHpageSize").val(),
    fromDate: $("#fromDate").val(),
    endDate: $("#toDate").val(),
    pgNo: pageNumber,
  };

  $.ajax({
    type: "GET",
    url:
      "/dashboard/get_cron_history_logs?cronId=" +
      fp.cronId +
      "&cronType=" +
      fp.cronType +
      "&pageSize=" +
      fp.pageSize +
      "&pgno=" +
      fp.pgNo,
    cache: false,
    beforeSend: function () {
      showLoadingToast(
        `Getting ${fp.pageSize} Cron History Logs. Please wait...`,
      );
    },
    success: function (data) {
      if (data.status == true) {
        showSuccessToast("Cron History fetched successfully.");
        recreateCronHistoryTable(data.cronLogs);
        updateCHpagination(
          data.pageNumber,
          data.pageSize,
          data.totalDocs,
          data.totalPages,
        );
      } else {
        showErrorToast(data.message);
      }
    },
    error: function () {
      alert("Oops unable to connect with server!!");
    },
  });
}

function updateCHpagination(pageNumber, pageSize, totalDocs, totalPages) {
  $("#cHpagination").empty();

  $("#cHpagination").append(
    `<li class="page-item p-2 "><a onclick="getCronHistory(${1})"><button class="btn tracknumlisting-pagination-button" >&laquo;</button></a></li>`,
  );
  $("#cHpagination").append(
    `<li class="page-item p-2"><a onclick="getCronHistory(${pageNumber - 1})"><button class="btn tracknumlisting-pagination-button" >Previous</button></a></li>`,
  );

  if (pageNumber > 3) {
    $("#cHpagination").append(
      `<li class="page-item p-2 "><a onclick="getCronHistory(${1})"><button class="btn tracknumlisting-pagination-button" >1</button></a></li>`,
    );
    $("#cHpagination").append(
      `<li class="page-item p-2"><a href="#"><button class="btn tracknumlisting-pagination-button" >...</button></a></li>`,
    );
  }

  for (
    let i = Math.max(1, pageNumber - 2);
    i <= Math.min(totalPages, pageNumber + 2);
    i++
  ) {
    if (i == pageNumber) {
      $("#cHpagination").append(
        `<li class="page-item p-2 active"><a onclick="getCronHistory(${i})"><button class="btn tracknumlisting-pagination-button" >${i}</button></a></li>`,
      );
    } else {
      $("#cHpagination").append(
        `<li class="page-item p-2"><a onclick="getCronHistory(${i})"><button class="btn tracknumlisting-pagination-button" >${i}</button></a></li>`,
      );
    }
  }

  if (pageNumber < totalPages - 2) {
    $("#cHpagination").append(
      `<li class="page-item p-2"><a href="#"><button class="btn tracknumlisting-pagination-button" >...</button></a></li>`,
    );
    $("#cHpagination").append(
      `<li class="page-item p-2"><a  onclick="getCronHistory(${totalPages})"><button class="btn tracknumlisting-pagination-button" >${totalPages}</button></a></li>`,
    );
  }

  $("#cHpagination").append(
    `<li class="page-item p-2 p-2"><a onclick="getCronHistory(${pageNumber + 1})"><button class="btn tracknumlisting-pagination-button" >Next</button></a></li>`,
  );
  $("#cHpagination").append(
    `<li class="page-item p-2 p-2"><a  onclick="getCronHistory(${totalPages})"><button class="btn tracknumlisting-pagination-button" >&raquo;</button></a></li>`,
  );

  // $('.page-link').removeClass('active');
  // $('.page-link').eq(pageNumber - 1).addClass('active');

  // // Disable/enable prev/next buttons
  // $('.prev').toggleClass('disabled', pageNumber === 1);
  // $('.next').toggleClass('disabled', pageNumber === totalPages);
}

function recreateCronHistoryTable(cronLogs) {
  let updtContent = "";
  for (let item of cronLogs) {
    updtContent += "<tr>";
    updtContent += `<td>${item.logTime}</td>`;
    updtContent += `<td>${item.completionTime}</td>`;
    updtContent += `<td>${item.cronName}</td>`;
    updtContent += `<td>${item.logData._id} ( ${item.keyRef} )</td>`;
    updtContent += `<td>${item.totalActiveCount}</td>`;
    updtContent += ` <td>${item.productCount}</td>`;
    updtContent += ` <td>${item.successScrapeCount}</td>`;
    updtContent += ` <td>${item.failureScrapeCount}</td>`;
    updtContent += ` <td>${item.repricedProductCount}</td>`;
    updtContent += ` <td>${item.repriceFailure422Count}</td>`;
    updtContent += ` <td>${item.repriceFailureOtherCount}</td>`;
    if (item.logData.type == "FEED_RUN") {
      updtContent += `<td><span class="badge badge-primary">${item.logData.type}</span></td>`;
    } else if (item.logData.type) {
      updtContent += `<td><span class="badge badge-warning">${item.logData.type}</span></td>`;
    } else {
      updtContent += `<td><span class="badge badge-success">Regular</span></td>`;
    }

    updtContent += `<td><a target="_blank" href="/dashboard/get_logs_details/${item.logData._id}"><i class="ti-arrow-circle-right"></i></a></td>`;
    updtContent += "</tr>";
  }

  $("#tbodyCronLogsHistory").html(updtContent);
}
