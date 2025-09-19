$(document).ready(function () {
  $('input[type="checkbox"]').on("click", function (e) {
    var checkbox = this;
    var row = $(checkbox).closest("tr");
    var regularCrons = JSON.parse(row.attr("data-regular-crons") || "[]");
    var slowCrons = JSON.parse(row.attr("data-slow-crons") || "[]");
    var scrapeCrons = JSON.parse(row.attr("data-scrape-crons") || "[]");
    var error422Crons = JSON.parse(row.attr("data-error422-crons") || "[]");

    if (
      regularCrons.length +
        slowCrons.length +
        scrapeCrons.length +
        error422Crons.length >
      0
    ) {
      e.preventDefault();
      var alertMessages = [
        "Unable to deactivate the proxy provider as it is associated with the following crons:",
      ];
      if (regularCrons.length > 0)
        alertMessages.push("Regular crons: " + regularCrons.join(", "));
      if (slowCrons.length > 0)
        alertMessages.push("Secondary crons: " + slowCrons.join(", "));
      if (scrapeCrons.length > 0)
        alertMessages.push("Scrape only crons: " + scrapeCrons.join(", "));
      if (error422Crons.length > 0)
        alertMessages.push("422 error crons: " + error422Crons.join(", "));
      alert(alertMessages.join("\n\n"));
    }
  });
});
