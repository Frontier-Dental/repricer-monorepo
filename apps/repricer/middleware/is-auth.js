module.exports = (req, res, next) => {
  const stored_session = req.session;
  const users_id = stored_session.users_id;
  const isDowntimeOn = JSON.parse(process.env.DOWNTIME_ON);
  if (isDowntimeOn == true) {
    res.redirect("/");
  } else {
    if (!users_id) {
      res.redirect("/");
    } else {
      console.log(
        `REQUEST URL : ${req.originalUrl} || USER : ${users_id.userName}`,
      );
      next();
    }
  }
};
