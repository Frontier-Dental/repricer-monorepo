let isValid = true;

// Required fields for form validation
const requiredFields = [
  "channel_name",
  "Scrape_on_off",
  "unit_price",
  "floor_price",
  "channel_Id",
  // "is_nc_needed" // Uncomment if required
];

$("#add_product_form_all").click(async function () {
  const details = {};
  const payload = {
    tradentDetails: {},
    frontierDetails: {},
    mvpDetails: {},
    topDentDetails: {},
    firstDentDetails: {},
  };

  const forms = [
    {
      selector: "#add_item_form_tradent",
      prefix: "tradent",
      checkbox: "#checkData_tradent",
    },
    {
      selector: "#add_item_form_frontier",
      prefix: "frontier",
      checkbox: "#checkData_frontier",
    },
    {
      selector: "#add_item_form_mvp",
      prefix: "mvp",
      checkbox: "#checkData_mvp",
    },
    {
      selector: "#add_item_form_topdent",
      prefix: "topdent",
      checkbox: "#checkData_topdent",
    },
    {
      selector: "#add_item_form_firstdent",
      prefix: "firstdent",
      checkbox: "#checkData_firstdent",
    },
  ];

  // Validate each form based on checkbox status
  for (const form of forms) {
    if (!$(form.checkbox).is(":checked")) {
      payload[`${form.prefix}Details`] = await collectDetails(form.prefix);
      validateForm(
        form.selector,
        payload[`${form.prefix}Details`],
        form.prefix,
      );
    }
  }

  // Validate independent fields
  const independentFields = [
    {
      name: "mpid",
      selector: "input[name=mpid]",
      type: "text",
      required: true,
    },
    {
      name: "net32_url",
      selector: "input[name=net32_url]",
      type: "text",
      required: true,
    },
    {
      name: "cronGroup",
      selector: "select[name=cronGroup]",
      type: "select",
      required: true,
    },
    {
      name: "slowCronGroup",
      selector: "select[name=slowCronGroup]",
      type: "select",
      required: false,
    },
    {
      name: "scrapeOnlyCron",
      selector: "select[name=scrapeOnlyCron]",
      type: "select",
      required: false,
    },
    {
      name: "isScrapeOnlyActivated",
      selector: "input[name=isScrapeOnlyActivated]",
      type: "checkbox",
      required: false,
    },
    {
      name: "isBadgeItem",
      selector: "input[name=isBadgeItem]",
      type: "checkbox",
      required: false,
    },
  ];

  independentFields.forEach((field) => {
    const element = document.querySelector(field.selector);
    if (element) {
      const value =
        field.type === "checkbox" ? element.checked : element.value.trim();
      if (field.required && !value) {
        isValid = false;
        element.classList.add("is-invalid");
      } else {
        details[field.name] = value;
        element.classList.remove("is-invalid");
      }
    }
  });

  // Stop execution if validation fails
  if (!isValid) {
    showErrorToast("Please fill all the required fields");
    return;
  }

  // Combine details and payload
  const finalPayload = { ...details, ...payload };
  // console.log(finalPayload);

  // Submit the form via AJAX
  $.ajax({
    type: "POST",
    url: "/productV2/add_item_post",
    data: finalPayload,
    dataType: "json",
    cache: false,
    beforeSend: function () {
      const button = $("#add_product_form_all");
      button
        .prop("disabled", true)
        .html(
          '<i class="ace-icon fa fa-spinner fa-spin bigger-125"></i> Please wait...',
        );
    },
    success: function (data) {
      const button = $("#add_product_form_all");
      button.prop("disabled", false).html("Add Product");

      if (data.status) {
        showSuccessToast(data.message);
        setTimeout(reloadPage, 1000);
      } else {
        showErrorToast(data.message);
      }
    },
    error: function () {
      const button = $("#add_product_form_all");
      button.prop("disabled", false).html("Add Product");
      showErrorToast("Something went wrong. Please try again");
    },
  });
});

// Reload the page
function reloadPage() {
  location.reload();
}

// Validate form function
function validateForm(formSelector, detailsObject, prefix) {
  const formData = $(formSelector).serializeArray();

  formData.forEach((item) => {
    const key = item.name.replace(`${prefix}_`, "");
    const value = item.value.trim();

    if (requiredFields.includes(key) && !value) {
      isValid = false;
      $(`[name="${item.name}"]`).addClass("is-invalid");
    } else {
      $(`[name="${item.name}"]`).removeClass("is-invalid");
    }

    detailsObject[key] = value;
  });
}

// Collect details for a specific prefix
async function collectDetails(prefix) {
  const details = {};
  const fields = [
    {
      name: "activated",
      selector: `input[name=${prefix}_activated]`,
      type: "checkbox",
    },
    {
      name: "channel_Id",
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
      name: "reprice_rule_select",
      selector: `select[name=${prefix}_reprice_rule_select]`,
      type: "select",
    },
    {
      name: "floor_price",
      selector: `input[name=${prefix}_floor_price]`,
      type: "number",
    },
    {
      name: "max_price",
      selector: `input[name=${prefix}_max_price]`,
      type: "number",
    },
    {
      name: "unit_price",
      selector: `input[name=${prefix}_unit_price]`,
      type: "number",
    },
  ];

  fields.forEach((field) => {
    const element = document.querySelector(field.selector);
    if (element) {
      const value = field.type === "checkbox" ? element.checked : element.value;
      if (requiredFields.includes(field.name) && !value) {
        element.classList.add("is-invalid");
        isValid = false;
      } else {
        details[field.name] = value;
        element.classList.remove("is-invalid");
      }
    }
  });
  return details;
}
