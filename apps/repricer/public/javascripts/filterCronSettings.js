function changeCronExpression(cronId) {
  var cronCtrlSelector = `cron_expression_${cronId}`;
  var cronExpressionValue = $(`[name=${cronCtrlSelector}]`).val();
  if (cronExpressionValue) {
    if (
      confirm("Are you sure you want to update the expression for the cron?")
    ) {
      $.ajax({
        type: "POST",
        url: "/filter/update_filter_cron",
        data: {
          id: cronId,
          value: cronExpressionValue,
          type: "cronExpression",
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
    alert(`Cron Expression Cannot be empty!`);
  }
}

function changeCronFilterValue(cronId) {
  var cronCtrlSelector = `cron_filter_value_${cronId}`;
  var cronExpressionValue = $(`[name=${cronCtrlSelector}]`).val();
  if (cronExpressionValue) {
    if (
      confirm("Are you sure you want to update the Filter Value for the cron?")
    ) {
      $.ajax({
        type: "POST",
        url: "/filter/update_filter_cron",
        data: {
          id: cronId,
          value: cronExpressionValue,
          type: "filterValue",
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
    alert(`Cron Expression Cannot be empty!`);
  }
}

function switchOffCron(cronId) {
  if (confirm("Are you sure you want to Switch Off the cron?")) {
    $.ajax({
      type: "POST",
      url: "/filter/toggle_cron_status",
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
        alert("Oops unable to connect with server!!");
      },
    });
  }
}

function switchOnCron(cronId) {
  if (confirm("Are you sure you want to Switch On the cron?")) {
    $.ajax({
      type: "POST",
      url: "/filter/toggle_cron_status",
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

function changeLinkedCronDetails(cronId) {
  var cronCtrlSelector = `s_linked_cron_${cronId}`;
  var linkedCronName = $(`[name=${cronCtrlSelector}]`).val();
  if (linkedCronName) {
    if (
      confirm(
        "Are you sure you want to update the Linked Cron Details for the cron? Please make sure that Same Slow Cron is not linked to multiple filter crons.",
      )
    ) {
      $.ajax({
        type: "POST",
        url: "/filter/update_filter_cron",
        data: {
          id: cronId,
          value: linkedCronName,
          type: "linkedCronName",
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
}
