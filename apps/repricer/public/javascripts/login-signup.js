/**** Login STARTS ****/
if ($("#sign_in_form").length > 0) {
  $("#sign_in_form")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        login_id: {
          required: true,
        },
        password: {
          required: true,
        },
      },
      messages: {
        login_id: "Please enter email id / username id",
        password: "Please enter password",
      },
      submitHandler: function (form) {
        let formData = $("#sign_in_form").serializeArray();
        $.ajax({
          type: "POST",
          url: "/login_post",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".signInButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
          },
          success: function (data) {
            $(".signInButton").html("Login");
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                window.location.href = "/productV2/show_all";
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".signInButton").html("Login");
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}
/**** Login END ****/
if ($("#update_item_form").length > 0) {
  $("#update_item_form")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        product_name: {
          required: false,
        },
        Scrape_on_off: {
          required: true,
        },
        requestInterval: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        net32_url: {
          required: false,
        },
        mpid: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        product_name: "Please enter Product Name",
        Scrape_on_off: "Please Use Scrape Button",
        requestInterval: "Please enter Request Interval Time(in Minutes)",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        net32_url: "Please enter Net 32 URL",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
      },
      submitHandler: function (form) {
        let formData = $("#update_item_form").serializeArray();
        $.ajax({
          type: "POST",
          url: "/masteritem/update_item_post",
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
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                //window.location.reload();
                window.location.href = "/masteritem";
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

if ($("#add_item_excel").length > 0) {
  $("#add_item_excel")
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
        var result = {};
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
            if (!result.ItemList) {
              alert(
                `Please rename the sheet of the uploading Excel to 'ItemList' to import`,
              );
              return;
            }
            var payLoad = {};
            payLoad.temp = [];
            for (var i = 1; i < result.ItemList.length; i++) {
              if (result.ItemList[i].length > 0) {
                var tempIt = [];
                result.ItemList[i].forEach((x) => {
                  tempIt.push(x);
                });
              }
              payLoad.temp.push(tempIt);
            }
            $.ajax({
              type: "POST",
              method: "POST",
              url: "/masteritem/add_excel_V2",
              data: { data: payLoad.temp, count: payLoad.temp.length },
              dataType: "json",
              cache: false,
              beforeSend: function () {
                $(".addItemExcel").prop("disabled", true);
                $(".addItemExcel").html(
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
if ($("#change_password").length > 0) {
  $("#change_password")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        //          channel_name:{
        //     required: true,
        //  },
      },
      messages: {
        // channel_Id: "Please enter Channel ID",
      },
      submitHandler: function (form) {
        let formData = $("#change_password").serializeArray();
        $.ajax({
          type: "POST",
          url: "/change_password",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".changePassword").prop("disabled", true);
            $(".changePassword").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
          },
          success: function (data) {
            $(".changePassword").html("Submit");
            $(".changePassword").prop("disabled", false);
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
            $(".changePassword").html("Submit");
            $(".changePassword").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

function removeItem($id) {
  var rowid = $id;
  var tableName = $("#tableName").val();
  var fieldName = $("#fieldItem").val();
  if (confirm("Are you sure you want to delete this?")) {
    // AJAX code to call page.
    $.ajax({
      type: "POST",
      url: "/masteritem/delete_item",
      data: {
        rowid: rowid,
        tableName: tableName,
        fieldName: fieldName,
      },
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

function deleteAll() {
  if (
    confirm("Are you sure you want to delete all the products in the list?")
  ) {
    $.ajax({
      type: "GET",
      url: "/masteritem/delete_all",
      cache: false,
      //async:false,
      beforeSend: function () {
        showLoadingToast("Please Wait");
      },
      success: function (data) {
        showSuccessToast("All products have been deleted");
        setTimeout(function () {
          window.location.href = "/masteritem";
        }, 5000);
      },
      error: function () {
        showErrorToast("Something went wrong. Please try again");
      },
    });
  }
}
if ($("#update_product_form_tradent").length > 0) {
  $("#update_product_form_tradent")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_tradent").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}
if ($("#update_product_form_frontier").length > 0) {
  $("#update_product_form_frontier")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_frontier").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}
if ($("#update_product_form_mvp").length > 0) {
  $("#update_product_form_mvp")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_mvp").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}
if ($("#update_product_form_topDent").length > 0) {
  $("#update_product_form_topDent")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_topDent").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}
if ($("#update_product_form_firstDent").length > 0) {
  $("#update_product_form_firstDent")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_firstDent").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

if ($("#update_product_form_triad").length > 0) {
  $("#update_product_form_triad")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_triad").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

if ($("#update_product_form_biteSupply").length > 0) {
  $("#update_product_form_biteSupply")
    .submit(function (e) {
      e.preventDefault();
    })
    .validate({
      rules: {
        channel_name: {
          required: true,
        },
        Scrape_on_off: {
          required: true,
        },
        unit_price: {
          required: true,
        },
        floor_price: {
          required: true,
        },
        mpid: {
          required: true,
        },
        secret_key: {
          required: true,
        },
        focus_id: {
          required: true,
        },
        channel_Id: {
          required: false,
        },
        is_nc_needed: {
          required: false,
        },
      },
      messages: {
        channel_name: "Please enter Channel Name",
        Scrape_on_off: "Please Use Scrape Button",
        unit_price: "Please enter Unit Price",
        floor_price: "Please enter Floor Price",
        mpid: "Please enter MPID",
        focus_id: "Please enter Focus ID",
        channel_Id: "Please enter Channel ID",
        secret_key: "Please enter Secret Key",
      },
      submitHandler: function (form) {
        let formData = $("#update_product_form_biteSupply").serializeArray();
        $.ajax({
          type: "POST",
          url: "/productV2/update_product_V2",
          data: formData,
          dataType: "json",
          cache: false,
          beforeSend: function () {
            $(".addItemButton").prop("disabled", true);
            $(".addItemButton").html(
              '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
            );
            showLoadingToast("Processing...");
          },
          success: function (data) {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            if (data.status == 1) {
              showSuccessToast(data.message);
              setTimeout(function () {
                cancelProductEdit();
              }, 1000);
            } else {
              showErrorToast(data.message);
            }
          },
          error: function () {
            $(".addItemButton").html("Submit");
            $(".addItemButton").prop("disabled", false);
            showErrorToast("Something went wrong. Please try again");
          },
        });
      },
    });
}

function syncProductItem($id) {
  var productId = $id.trim();
  if (
    confirm(`Are you sure you want to sync ${productId} with Live Details?`)
  ) {
    // AJAX code to call page.
    $.ajax({
      type: "GET",
      url: `/productV2/sync_product/${productId}`,
      cache: false,
      beforeSend: function () {
        showLoadingToast("Processing...");
      },
      success: function (data) {
        if (data.status == true) {
          showSuccessToast(data.message);
          setTimeout(function () {
            location.reload();
          }, 3000);
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
